from __future__ import annotations

import pandas as pd

from ml_models import paths
from ml_models.features import DELAY_FEATURES, build_delay_features
from ml_models.inference import PredictiveModels
from preprocessing.clean_flights import clean_flights
from preprocessing.clean_survey import clean_survey
from preprocessing.clean_traffic import clean_traffic, monthly_series
from preprocessing.feature_engineering import add_flight_context


def test_clean_survey_keeps_valid_rows():
    df, report = clean_survey(paths.SATISFACTION_TEST_CSV)
    assert report.rows_in == report.rows_out == len(df)
    assert df["Arrival Delay in Minutes"].notna().all()
    assert "id" not in df.columns


def test_monthly_traffic_series_is_continuous():
    df, _ = clean_traffic(paths.TRAFFIC_CSV)
    monthly = monthly_series(df)
    assert len(monthly) == 129
    assert monthly["Date"].is_monotonic_increasing
    assert (monthly["passengers"] > 1_000_000).all()


def test_clean_flights_drops_unlabelled_rows(synthetic_flights_csv):
    df, report = clean_flights(synthetic_flights_csv)
    raw = pd.read_csv(synthetic_flights_csv)
    assert report.rows_in == len(raw)
    assert len(df) < len(raw)
    assert df["DEPARTURE_DELAY"].notna().all()
    assert {"CANCELLED", "DIVERTED", "TAXI_OUT", "ARRIVAL_DELAY"}.isdisjoint(df.columns)


def test_flight_features_and_congestion(synthetic_flights_csv):
    df, _ = clean_flights(synthetic_flights_csv)
    df = add_flight_context(df)
    assert df["congestion_score"].between(0, 1).all()
    features = build_delay_features(df)
    assert list(features.columns) == DELAY_FEATURES
    assert (features.loc[df["ORIGIN_AIRPORT"] == "13930", "origin_code"] == -1).all()


def test_delay_model_trains_and_serves(synthetic_flights_csv, tmp_path):
    from ml_models.train_delay_model import train

    meta = train(flights_csv=synthetic_flights_csv, artifacts_dir=tmp_path, sample_rows=None, n_estimators=20)
    assert (tmp_path / "delay_model.ubj").exists()
    assert {"mae", "rmse", "r2", "baseline_mae"} <= set(meta["metrics"])
    assert len(meta["residual_quantiles"]) == 101

    models = PredictiveModels(artifacts_dir=tmp_path)
    assert models.status()["delay"]["source"] == "xgboost"
