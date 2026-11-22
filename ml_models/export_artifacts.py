"""Export lightweight artifacts derived from the trained models.

* ``delay_distribution.json``  empirical departure-delay quantiles (129,880 flights)
* ``satisfaction_surface.json`` the classifier's average response to queueing and delay,
  computed over a sample of real survey respondents
* ``frontend_nextjs/data/model-artifacts.json`` everything the in-browser simulation and the
  dashboard need: process parameters, scenario bounds, model metrics, the surface, the delay
  distribution and the traffic forecast

    python -m ml_models.export_artifacts
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from ml_models import paths
from ml_models.features import (
    EXPERIENCE_BANDS,
    airline_vocabulary,
    apply_journey_experience,
    build_satisfaction_features,
)
from ml_models.inference import PredictiveModels, build_delay_distribution
from simulation.config import BOUNDS, SimulationConfig
from simulation.parameters import PARAMS

logger = logging.getLogger("export")

SURFACE_DELAYS = [0, 15, 30, 45, 60, 90, 120, 180, 240]
# One representative queueing time inside each experience band (5 stars ... 1 star).
SURFACE_WAITS = [0.0, 7.5, 15.0, 27.5, 45.0]


def export_delay_distribution() -> dict[str, Any]:
    combined = pd.concat(
        [
            pd.read_csv(p, usecols=["Departure Delay in Minutes"])
            for p in (paths.SATISFACTION_TRAIN_CSV, paths.SATISFACTION_TEST_CSV)
        ]
    )
    tmp = paths.OUTPUTS_DIR / "_all_delays.csv"
    paths.ensure_dirs()
    combined.to_csv(tmp, index=False)
    dist = build_delay_distribution(tmp)
    dist["source"] = f"empirical (passenger survey flights, n={dist['n']})"
    tmp.unlink(missing_ok=True)
    paths.DELAY_DISTRIBUTION.write_text(json.dumps(dist, indent=2), encoding="utf-8")
    return dist


def export_satisfaction_surface(models: PredictiveModels, sample: int = 3000, seed: int = 7) -> dict[str, Any] | None:
    if models.satisfaction_model is None or models.passenger_profiles is None:
        logger.warning("Satisfaction model not trained; skipping surface export")
        return None
    profiles = models.passenger_profiles.sample(n=min(sample, len(models.passenger_profiles)), random_state=seed)
    profiles = profiles.reset_index(drop=True)
    mean_p, share = [], []
    for wait in SURFACE_WAITS:
        row_mean, row_share = [], []
        for delay in SURFACE_DELAYS:
            adjusted = apply_journey_experience(
                profiles, np.full(len(profiles), wait), np.full(len(profiles), float(delay))
            )
            proba = models.satisfaction_model.predict_proba(build_satisfaction_features(adjusted))[:, 1]
            row_mean.append(round(float(proba.mean()), 4))
            row_share.append(round(float((proba >= 0.5).mean()), 4))
        mean_p.append(row_mean)
        share.append(row_share)
    surface = {
        "description": "Average P(satisfied) by process rating (rows: 5..1 stars) and departure delay (columns)",
        "experience_bands": list(EXPERIENCE_BANDS),
        "delays": SURFACE_DELAYS,
        "mean_probability": mean_p,
        "satisfied_share": share,
        "profiles_sampled": len(profiles),
    }
    paths.SATISFACTION_SURFACE.write_text(json.dumps(surface, indent=2), encoding="utf-8")
    return surface


def export_frontend_bundle(models: PredictiveModels, surface: dict | None, delays: dict) -> dict[str, Any]:
    defaults = SimulationConfig().to_dict()
    sat_meta = models.satisfaction_meta or {}
    forecast = models.traffic_forecast or {}
    bundle = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "parameters": PARAMS.to_dict(),
        "defaults": defaults,
        "bounds": {k: list(v) for k, v in BOUNDS.items()},
        "airlines": list(airline_vocabulary()),
        "delay_distribution": {k: delays[k] for k in ("source", "n", "mean", "on_time_share", "quantiles")},
        "satisfaction_surface": surface,
        "models": {
            "satisfaction": {
                k: sat_meta.get(k)
                for k in (
                    "model",
                    "task",
                    "dataset",
                    "train_rows",
                    "test_rows",
                    "metrics",
                    "train_seconds",
                    "inference_ms_per_row",
                    "feature_importance",
                    "hyperparameters",
                    "trained_at",
                )
            },
            "delay": models.delay_meta
            and {k: models.delay_meta.get(k) for k in ("model", "metrics", "train_rows", "test_rows", "split")},
            "traffic": {
                k: forecast.get(k)
                for k in (
                    "model",
                    "airport",
                    "look_back_months",
                    "test_months",
                    "epochs_run",
                    "train_seconds",
                    "metrics",
                    "trained_at",
                )
            },
        },
        "traffic": {
            "history": forecast.get("history", []),
            "backtest": forecast.get("backtest", []),
            "forecast": forecast.get("forecast", []),
            "seasonal_index": forecast.get("seasonal_index", {}),
        },
    }
    paths.FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
    target = paths.FRONTEND_DATA_DIR / "model-artifacts.json"
    target.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    return bundle


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    models = PredictiveModels()
    delays = export_delay_distribution()
    surface = export_satisfaction_surface(models)
    export_frontend_bundle(models, surface, delays)
    print(f"Delay distribution: mean {delays['mean']} min, on-time share {delays['on_time_share']:.1%}")
    if surface:
        print("Satisfaction (no delay) by rating 5..1:", [row[0] for row in surface["mean_probability"]])
    print("Wrote", paths.FRONTEND_DATA_DIR / "model-artifacts.json")


if __name__ == "__main__":
    main()
