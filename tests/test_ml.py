from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from ml_models import paths
from ml_models.features import (
    SATISFACTION_FEATURES,
    apply_journey_experience,
    build_satisfaction_features,
    encode_codes,
    experience_rating,
    load_survey,
)
from ml_models.inference import PredictiveModels, build_delay_distribution, heuristic_satisfaction


@pytest.fixture(scope="module")
def survey_sample() -> pd.DataFrame:
    return load_survey(paths.SATISFACTION_TEST_CSV).head(200)


def test_feature_matrix_matches_contract(survey_sample):
    features = build_satisfaction_features(survey_sample)
    assert list(features.columns) == SATISFACTION_FEATURES
    assert not features.isna().any().any()
    assert set(features["is_male"].unique()) <= {0, 1}


def test_missing_columns_raise(survey_sample):
    with pytest.raises(KeyError):
        build_satisfaction_features(survey_sample.drop(columns=["Age"]))


def test_experience_rating_bands():
    assert experience_rating([0, 4.9, 5, 12, 25, 40]).tolist() == [5, 5, 4, 3, 2, 1]


def test_journey_experience_overrides_rating_and_delay(survey_sample):
    adjusted = apply_journey_experience(
        survey_sample, np.full(len(survey_sample), 50.0), np.full(len(survey_sample), 30.0)
    )
    assert (adjusted["Checkin service"] == 1).all()
    assert (adjusted["Departure Delay in Minutes"] == 30).all()
    assert (survey_sample["Checkin service"] != 1).any()  # original untouched


def test_encode_codes_handles_unknowns():
    encoded = encode_codes(pd.Series(["UA", "ZZ", "13930"]), ("AA", "UA"))
    assert encoded.tolist() == [1, -1, -1]


def test_shipped_satisfaction_model_is_accurate():
    meta = json.loads(paths.SATISFACTION_META.read_text(encoding="utf-8"))
    assert meta["metrics"]["accuracy"] > 0.9
    assert meta["metrics"]["accuracy"] > meta["metrics"]["baseline_accuracy"]
    assert meta["features"] == SATISFACTION_FEATURES


def test_shipped_model_predicts_probabilities(survey_sample):
    models = PredictiveModels()
    proba, source = models.satisfaction_probability(
        survey_sample, np.zeros(len(survey_sample)), np.zeros(len(survey_sample))
    )
    assert source == "xgboost"
    assert ((proba >= 0) & (proba <= 1)).all()


def test_fallbacks_when_artifacts_are_missing(tmp_path):
    models = PredictiveModels(artifacts_dir=tmp_path)
    rng = np.random.default_rng(0)
    status = models.status()
    assert status["satisfaction"]["source"] == "logistic-fallback"
    assert status["delay"]["source"] == "empirical-distribution"
    assert status["demand"]["source"] == "seasonal-index"
    delays, source = models.flight_delays(rng, pd.DataFrame({"x": range(50)}))
    assert source == "empirical-distribution" and (delays >= 0).all()
    proba, source = models.satisfaction_probability(None, np.array([0.0, 60.0]), np.array([0.0, 0.0]))
    assert source == "logistic-fallback" and proba[0] > proba[1]
    assert models.demand_multiplier(7) == (1.0, "baseline")


def test_heuristic_is_monotonic():
    proba = heuristic_satisfaction(np.array([0, 10, 30, 60]), np.zeros(4))
    assert np.all(np.diff(proba) < 0)


def test_delay_distribution_from_survey():
    dist = build_delay_distribution(paths.SATISFACTION_TEST_CSV)
    assert len(dist["quantiles"]) == 101
    assert dist["quantiles"] == sorted(dist["quantiles"])
    assert 0.6 < dist["on_time_share"] < 0.95


def test_traffic_forecast_artifact():
    data = json.loads(paths.TRAFFIC_FORECAST.read_text(encoding="utf-8"))
    assert len(data["forecast"]) == 12
    assert data["metrics"]["lstm"]["mape"] < 15
    models = PredictiveModels()
    july, source = models.demand_multiplier(7)
    assert source == "lstm-forecast" and july > 1.0
