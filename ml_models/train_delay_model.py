"""Train the flight departure-delay regressor (XGBoost).

Needs the 2015 US DOT on-time dataset at ``datasets/raw/flights.csv`` (565 MB, not in
git). Without it the simulation samples delays from the empirical distribution instead.

The holdout is time based (train Jan-Oct, test Nov-Dec), which is closer to how the model
would be used than a random split.

    python -m ml_models.train_delay_model --sample 1000000
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from ml_models import paths
from ml_models.features import DELAY_FEATURES, DELAY_TARGET, build_delay_features
from preprocessing.clean_flights import clean_flights
from preprocessing.feature_engineering import add_flight_context

logger = logging.getLogger("train_delay")
TARGET_CLIP = (-30.0, 300.0)


def load_training_frame(flights_csv: Path, sample_rows: int | None) -> pd.DataFrame:
    prepared = paths.OUTPUTS_DIR / "flights_model_data.csv"
    if flights_csv == paths.FLIGHTS_CSV and prepared.exists():
        logger.info("Using prepared data %s", prepared)
        df = pd.read_csv(prepared, dtype={"ORIGIN_AIRPORT": str})
        if sample_rows and len(df) > sample_rows:
            df = df.sample(n=sample_rows, random_state=42)
        return df
    df, report = clean_flights(flights_csv, sample_rows=sample_rows)
    logger.info("Cleaned flights: %s", report.to_dict())
    return add_flight_context(df)


def train(
    flights_csv: Path = paths.FLIGHTS_CSV,
    artifacts_dir: Path = paths.ARTIFACTS_DIR,
    sample_rows: int | None = 1_000_000,
    n_estimators: int = 600,
    seed: int = 42,
) -> dict:
    if not flights_csv.exists():
        raise FileNotFoundError(
            f"{flights_csv} not found. Download flights.csv from the Kaggle dataset "
            "'usdot/flight-delays' and place it in datasets/raw/."
        )
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    df = load_training_frame(flights_csv, sample_rows)
    features = build_delay_features(df)
    target = df[DELAY_TARGET].clip(*TARGET_CLIP)

    test_mask = df["MONTH"] >= 11
    if test_mask.sum() == 0 or (~test_mask).sum() == 0:  # small samples: fall back to random split
        test_mask = pd.Series(np.random.default_rng(seed).random(len(df)) < 0.2, index=df.index)
    x_train, x_test = features[~test_mask], features[test_mask]
    y_train, y_test = target[~test_mask], target[test_mask]
    logger.info("Train %s, test %s", x_train.shape, x_test.shape)

    model = xgb.XGBRegressor(
        n_estimators=n_estimators,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=20,
        tree_method="hist",
        objective="reg:squarederror",
        random_state=seed,
        n_jobs=-1,
    )
    started = time.perf_counter()
    model.fit(x_train, y_train, eval_set=[(x_test, y_test)], verbose=False)
    train_seconds = time.perf_counter() - started

    pred = model.predict(x_test)
    baseline = np.full(len(y_test), float(np.median(y_train)))
    metrics = {
        "mae": round(float(mean_absolute_error(y_test, pred)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, pred))), 3),
        "r2": round(float(r2_score(y_test, pred)), 4),
        "baseline_mae": round(float(mean_absolute_error(y_test, baseline)), 3),
    }
    residuals = (y_test.to_numpy() - pred).clip(-60, 300)

    model.save_model(artifacts_dir / paths.DELAY_MODEL.name)
    importance = pd.Series(model.feature_importances_, index=DELAY_FEATURES).sort_values(ascending=False)
    meta = {
        "model": "XGBRegressor",
        "task": "regression (departure delay, minutes)",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "xgboost_version": xgb.__version__,
        "dataset": "2015 US DOT flight on-time performance",
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "split": "time-based (Nov-Dec holdout)" if (df["MONTH"] >= 11).any() else "random 80/20",
        "features": DELAY_FEATURES,
        "metrics": metrics,
        "train_seconds": round(train_seconds, 2),
        "residual_quantiles": np.quantile(residuals, np.linspace(0, 1, 101)).round(2).tolist(),
        "feature_importance": [{"feature": k, "importance": round(float(v), 4)} for k, v in importance.items()],
    }
    (artifacts_dir / paths.DELAY_META.name).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sample", type=int, default=1_000_000, help="rows to train on (0 = all)")
    parser.add_argument("--n-estimators", type=int, default=600)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    meta = train(sample_rows=args.sample or None, n_estimators=args.n_estimators)
    print(json.dumps(meta["metrics"], indent=2))


if __name__ == "__main__":
    main()
