"""Inference endpoints' business logic: thin wrapper over the shared model registry."""

from __future__ import annotations

from typing import Any

import pandas as pd

from backend_fastapi.schemas.requests import DelayRequest, SatisfactionRequest
from ml_models.features import (
    DELAY_FEATURES,
    RATING_COLUMNS,
    airline_vocabulary,
    airport_vocabulary,
    build_satisfaction_features,
    is_rush_hour,
)
from ml_models.inference import PredictiveModels, get_models, heuristic_satisfaction


class ModelUnavailableError(RuntimeError):
    """Raised when a request needs a model that has not been trained yet."""


class ModelService:
    def __init__(self, models: PredictiveModels | None = None) -> None:
        self.models = models or get_models()

    def status(self) -> dict[str, Any]:
        return self.models.status()

    def predict_satisfaction(self, req: SatisfactionRequest) -> dict[str, Any]:
        snake_to_raw = {snake: raw for raw, snake in RATING_COLUMNS.items()}
        row = {
            "Gender": req.gender,
            "Customer Type": req.customer_type,
            "Age": req.age,
            "Type of Travel": req.type_of_travel,
            "Class": req.travel_class,
            "Flight Distance": req.flight_distance,
            "Departure Delay in Minutes": req.departure_delay_min,
            "Arrival Delay in Minutes": req.arrival_delay_min,
        }
        row.update({snake_to_raw[k]: v for k, v in req.ratings.model_dump().items()})
        frame = pd.DataFrame([row])

        model = self.models.satisfaction_model
        if model is not None:
            probability = float(model.predict_proba(build_satisfaction_features(frame))[0, 1])
            source = "xgboost"
        else:
            probability = float(heuristic_satisfaction([0.0], [req.departure_delay_min])[0])
            source = "logistic-fallback"
        return {"probability_satisfied": round(probability, 4), "satisfied": probability >= 0.5, "model": source}

    def predict_delay(self, req: DelayRequest) -> dict[str, Any]:
        model = self.models.delay_model
        if model is None:
            raise ModelUnavailableError(
                "The delay model is not trained. Download the 2015 DOT flights data and run "
                "`python -m ml_models.train_delay_model` (see README)."
            )
        airlines = {code: i for i, code in enumerate(airline_vocabulary())}
        airports = {code: i for i, code in enumerate(airport_vocabulary())}
        features = pd.DataFrame(
            [
                {
                    "month": req.month,
                    "day_of_week": req.day_of_week,
                    "dep_hour": req.dep_hour,
                    "airline_code": airlines.get(req.airline.upper(), -1),
                    "origin_code": airports.get(req.origin.upper(), -1),
                    "distance": req.distance,
                    "rush_hour": int(is_rush_hour([req.dep_hour])[0]),
                    "is_weekend": int(req.day_of_week >= 6),
                    "congestion_score": req.congestion_score,
                }
            ]
        )[DELAY_FEATURES]
        delay = float(model.predict(features)[0])
        return {"predicted_delay_min": round(max(delay, 0.0), 2), "model": "xgboost"}

    def traffic_forecast(self) -> dict[str, Any]:
        forecast = self.models.traffic_forecast
        if not forecast:
            raise ModelUnavailableError("No traffic forecast found. Run `python -m ml_models.train_traffic_model`.")
        return forecast
