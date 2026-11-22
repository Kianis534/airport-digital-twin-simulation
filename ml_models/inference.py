"""Model loading and inference used by the simulation engine and the API.

Each model is optional. When an artifact is missing the engine falls back to a
data-driven alternative and reports which source it used, so a fresh clone runs end to
end before any training happens:

* delay      -> XGBoost regressor, else the empirical delay distribution
* satisfaction -> XGBoost classifier, else a logistic approximation
* demand     -> LSTM 12-month forecast, else the historical seasonal index
"""

from __future__ import annotations

import json
import logging
from functools import cached_property, lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ml_models import paths
from ml_models.features import (
    DELAY_FEATURES,
    SURVEY_COLUMNS,
    build_satisfaction_features,
    load_survey,
)

logger = logging.getLogger(__name__)


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:  # pragma: no cover - corrupt artifact
        logger.warning("Could not read %s: %s", path, exc)
        return None


def _load_xgb(path: Path, kind: str):
    if not path.exists():
        return None
    try:
        import xgboost as xgb

        model = xgb.XGBClassifier() if kind == "classifier" else xgb.XGBRegressor()
        model.load_model(path)
        return model
    except Exception as exc:  # pragma: no cover - depends on local install
        logger.warning("Could not load %s: %s", path.name, exc)
        return None


class PredictiveModels:
    """Lazily loads artifacts once and exposes vectorised prediction helpers."""

    def __init__(self, artifacts_dir: Path | None = None) -> None:
        self.artifacts_dir = Path(artifacts_dir) if artifacts_dir else paths.ARTIFACTS_DIR

    def _artifact(self, path: Path) -> Path:
        return self.artifacts_dir / path.name

    # ---------------------------------------------------------------- artifacts
    @cached_property
    def satisfaction_model(self):
        return _load_xgb(self._artifact(paths.SATISFACTION_MODEL), "classifier")

    @cached_property
    def satisfaction_meta(self) -> dict[str, Any] | None:
        return _read_json(self._artifact(paths.SATISFACTION_META))

    @cached_property
    def delay_model(self):
        return _load_xgb(self._artifact(paths.DELAY_MODEL), "regressor")

    @cached_property
    def delay_meta(self) -> dict[str, Any] | None:
        return _read_json(self._artifact(paths.DELAY_META))

    @cached_property
    def traffic_forecast(self) -> dict[str, Any] | None:
        return _read_json(self._artifact(paths.TRAFFIC_FORECAST))

    @cached_property
    def delay_distribution(self) -> dict[str, Any]:
        stored = _read_json(self._artifact(paths.DELAY_DISTRIBUTION))
        if stored:
            return stored
        if paths.SATISFACTION_TEST_CSV.exists():
            return build_delay_distribution(paths.SATISFACTION_TEST_CSV)
        # Last resort: a coarse shape typical of US departures (55% on time, long tail).
        grid = np.linspace(0, 1, 101)
        quantiles = np.where(grid < 0.55, 0.0, -30.0 * np.log(1 - (grid - 0.55) / 0.45 + 1e-9))
        return {"source": "built-in", "quantiles": np.minimum(quantiles, 300).round(2).tolist()}

    @cached_property
    def passenger_profiles(self) -> pd.DataFrame | None:
        """Real survey respondents used as the passenger population (held-out test split)."""
        if not paths.SATISFACTION_TEST_CSV.exists():
            return None
        return load_survey(paths.SATISFACTION_TEST_CSV)[SURVEY_COLUMNS].reset_index(drop=True)

    # ---------------------------------------------------------------- status
    def status(self) -> dict[str, Any]:
        return {
            "delay": {
                "source": "xgboost" if self.delay_model is not None else "empirical-distribution",
                "metrics": (self.delay_meta or {}).get("metrics"),
            },
            "satisfaction": {
                "source": "xgboost" if self.satisfaction_model is not None else "logistic-fallback",
                "metrics": (self.satisfaction_meta or {}).get("metrics"),
            },
            "demand": {
                "source": "lstm-forecast" if self.traffic_forecast else "seasonal-index",
                "metrics": (self.traffic_forecast or {}).get("metrics"),
            },
        }

    # ---------------------------------------------------------------- delays
    def sample_empirical_delays(self, rng: np.random.Generator, n: int) -> np.ndarray:
        quantiles = np.asarray(self.delay_distribution["quantiles"], dtype=float)
        grid = np.linspace(0, 100, len(quantiles))
        return np.interp(rng.uniform(0, 100, size=n), grid, quantiles)

    def flight_delays(self, rng: np.random.Generator, features: pd.DataFrame) -> tuple[np.ndarray, str]:
        """Departure delay (minutes) for each flight row, plus the name of the source used."""
        n = len(features)
        if self.delay_model is not None:
            predicted = self.delay_model.predict(features[DELAY_FEATURES])
            residuals = (self.delay_meta or {}).get("residual_quantiles")
            noise = np.zeros(n)
            if residuals:
                grid = np.linspace(0, 100, len(residuals))
                noise = np.interp(rng.uniform(0, 100, size=n), grid, residuals)
            return np.clip(predicted + noise, 0, None), "xgboost"
        return np.clip(self.sample_empirical_delays(rng, n), 0, None), "empirical-distribution"

    # ---------------------------------------------------------------- satisfaction
    def sample_profiles(self, rng: np.random.Generator, n: int) -> tuple[pd.DataFrame | None, np.ndarray]:
        profiles = self.passenger_profiles
        if profiles is None or profiles.empty:
            return None, np.full(n, -1)
        idx = rng.integers(0, len(profiles), size=n)
        return profiles.iloc[idx].reset_index(drop=True), idx

    def satisfaction_probability(
        self,
        profiles: pd.DataFrame | None,
        process_wait: np.ndarray,
        departure_delay: np.ndarray,
    ) -> tuple[np.ndarray, str]:
        """Probability that each passenger reports being satisfied."""
        from ml_models.features import apply_journey_experience

        if self.satisfaction_model is not None and profiles is not None:
            adjusted = apply_journey_experience(profiles, process_wait, departure_delay)
            features = build_satisfaction_features(adjusted)
            return self.satisfaction_model.predict_proba(features)[:, 1], "xgboost"
        return heuristic_satisfaction(process_wait, departure_delay), "logistic-fallback"

    # ---------------------------------------------------------------- demand
    def demand_multiplier(self, month: int | None) -> tuple[float, str]:
        """Seasonal demand factor for a calendar month (1.0 = average month)."""
        if month is None:
            return 1.0, "baseline"
        forecast = self.traffic_forecast
        if forecast and forecast.get("forecast"):
            values = {int(row["month"][5:7]): float(row["passengers"]) for row in forecast["forecast"]}
            mean = float(np.mean(list(values.values())))
            if month in values and mean > 0:
                return values[month] / mean, "lstm-forecast"
        if forecast and forecast.get("seasonal_index"):
            return float(forecast["seasonal_index"][str(month)]), "seasonal-index"
        return 1.0, "baseline"


def heuristic_satisfaction(process_wait: np.ndarray, departure_delay: np.ndarray) -> np.ndarray:
    """Logistic stand-in used only when the trained classifier is unavailable.

    Roughly matches the trained model's averages: ~51% satisfied with no queues, falling
    towards ~41% as queueing and delays grow.
    """
    wait = np.asarray(process_wait, dtype=float)
    delay = np.asarray(departure_delay, dtype=float)
    logits = 0.04 - 0.4 / (1 + np.exp(-(wait - 20) / 6)) - 0.0004 * delay
    return 1.0 / (1.0 + np.exp(-logits))


def build_delay_distribution(survey_csv: Path) -> dict[str, Any]:
    """Empirical departure-delay quantiles from the passenger survey's recorded flights."""
    delays = pd.read_csv(survey_csv, usecols=["Departure Delay in Minutes"])["Departure Delay in Minutes"]
    delays = delays.dropna().clip(lower=0, upper=600)
    grid = np.linspace(0, 1, 101)
    return {
        "source": f"empirical ({survey_csv.name}, n={len(delays)})",
        "n": int(len(delays)),
        "mean": round(float(delays.mean()), 2),
        "on_time_share": round(float((delays <= 15).mean()), 4),
        "quantiles": np.quantile(delays, grid).round(2).tolist(),
    }


@lru_cache(maxsize=1)
def get_models() -> PredictiveModels:
    """Process-wide model registry (artifacts are read from disk once)."""
    return PredictiveModels()
