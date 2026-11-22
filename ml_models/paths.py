"""Filesystem locations shared by the data pipeline, training scripts and inference.

All paths resolve from the repository root, so scripts work no matter which directory
they are launched from. ``AIRPORT_TWIN_ARTIFACTS`` overrides the artifact folder (handy
for experiments and tests).
"""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = PROJECT_ROOT / "datasets"
RAW_DIR = DATASETS_DIR / "raw"
OUTPUTS_DIR = Path(os.getenv("AIRPORT_TWIN_OUTPUTS", PROJECT_ROOT / "outputs"))
ARTIFACTS_DIR = Path(os.getenv("AIRPORT_TWIN_ARTIFACTS", PROJECT_ROOT / "ml_models" / "artifacts"))
FRONTEND_DATA_DIR = PROJECT_ROOT / "frontend_nextjs" / "data"

# Source datasets (see datasets/README.md for provenance).
FLIGHTS_CSV = RAW_DIR / "flights.csv"  # 2015 US DOT on-time data, downloaded separately (565 MB)
AIRLINES_CSV = DATASETS_DIR / "dataset_1_airlines.csv"
AIRPORTS_CSV = DATASETS_DIR / "dataset_1_airports.csv"
SATISFACTION_TRAIN_CSV = DATASETS_DIR / "dataset_2_train.csv"
SATISFACTION_TEST_CSV = DATASETS_DIR / "dataset_2_test.csv"
TRAFFIC_CSV = DATASETS_DIR / "dataset_3_passenger_traffic.csv"

# Model artifacts. XGBoost models use the native UBJSON format, which is portable across
# XGBoost versions, unlike pickled estimators.
SATISFACTION_MODEL = ARTIFACTS_DIR / "satisfaction_model.ubj"
SATISFACTION_META = ARTIFACTS_DIR / "satisfaction_model.meta.json"
DELAY_MODEL = ARTIFACTS_DIR / "delay_model.ubj"
DELAY_META = ARTIFACTS_DIR / "delay_model.meta.json"
DELAY_DISTRIBUTION = ARTIFACTS_DIR / "delay_distribution.json"
TRAFFIC_MODEL = ARTIFACTS_DIR / "traffic_lstm.keras"
TRAFFIC_FORECAST = ARTIFACTS_DIR / "traffic_forecast.json"
SATISFACTION_SURFACE = ARTIFACTS_DIR / "satisfaction_surface.json"


def ensure_dirs() -> None:
    for directory in (OUTPUTS_DIR, ARTIFACTS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
