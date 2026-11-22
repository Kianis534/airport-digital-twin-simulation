"""Train the passenger satisfaction classifier (XGBoost).

Data: the "Airline Passenger Satisfaction" survey (datasets/dataset_2_*.csv). The
published train/test split is kept as is, so the reported metrics are on rows the model
never saw.

    python -m ml_models.train_satisfaction_model
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from datetime import datetime, timezone

import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from ml_models import paths
from ml_models.features import (
    SATISFACTION_FEATURES,
    build_satisfaction_features,
    satisfaction_target,
)
from preprocessing.clean_survey import clean_survey

logger = logging.getLogger("train_satisfaction")


def train(n_estimators: int = 400, max_depth: int = 7, learning_rate: float = 0.08, seed: int = 42) -> dict:
    paths.ensure_dirs()
    train_df, _ = clean_survey(paths.SATISFACTION_TRAIN_CSV, "survey_train")
    test_df, _ = clean_survey(paths.SATISFACTION_TEST_CSV, "survey_test")
    x_train, y_train = build_satisfaction_features(train_df), satisfaction_target(train_df)
    x_test, y_test = build_satisfaction_features(test_df), satisfaction_target(test_df)
    logger.info("Train %s, test %s, positive rate %.3f", x_train.shape, x_test.shape, y_train.mean())

    model = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=learning_rate,
        subsample=0.9,
        colsample_bytree=0.8,
        min_child_weight=2,
        tree_method="hist",
        eval_metric="logloss",
        random_state=seed,
        n_jobs=-1,
    )
    started = time.perf_counter()
    model.fit(x_train, y_train, eval_set=[(x_test, y_test)], verbose=False)
    train_seconds = time.perf_counter() - started

    proba = model.predict_proba(x_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    # Majority-class baseline, so the headline accuracy has a reference point.
    baseline = float(max(y_test.mean(), 1 - y_test.mean()))
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, pred)), 4),
        "precision": round(float(precision_score(y_test, pred)), 4),
        "recall": round(float(recall_score(y_test, pred)), 4),
        "f1": round(float(f1_score(y_test, pred)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, proba)), 4),
        "baseline_accuracy": round(baseline, 4),
    }

    started = time.perf_counter()
    model.predict_proba(x_test.iloc[:1000])
    latency_ms = (time.perf_counter() - started) / 1000 * 1000

    importance = pd.Series(model.feature_importances_, index=SATISFACTION_FEATURES).sort_values(ascending=False)
    model.save_model(paths.SATISFACTION_MODEL)

    meta = {
        "model": "XGBClassifier",
        "task": "binary classification (satisfied vs. neutral/dissatisfied)",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "xgboost_version": xgb.__version__,
        "dataset": "Airline Passenger Satisfaction survey",
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "features": SATISFACTION_FEATURES,
        "hyperparameters": {
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "learning_rate": learning_rate,
            "subsample": 0.9,
            "colsample_bytree": 0.8,
        },
        "metrics": metrics,
        "train_seconds": round(train_seconds, 2),
        "inference_ms_per_row": round(latency_ms, 4),
        "feature_importance": [
            {"feature": name, "importance": round(float(value), 4)} for name, value in importance.head(12).items()
        ],
    }
    paths.SATISFACTION_META.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    logger.info("Saved %s (%.1f KB)", paths.SATISFACTION_MODEL.name, paths.SATISFACTION_MODEL.stat().st_size / 1024)
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--n-estimators", type=int, default=400)
    parser.add_argument("--max-depth", type=int, default=7)
    parser.add_argument("--learning-rate", type=float, default=0.08)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    meta = train(args.n_estimators, args.max_depth, args.learning_rate)
    print(json.dumps(meta["metrics"], indent=2))
    print("Top drivers:", ", ".join(row["feature"] for row in meta["feature_importance"][:5]))


if __name__ == "__main__":
    main()
