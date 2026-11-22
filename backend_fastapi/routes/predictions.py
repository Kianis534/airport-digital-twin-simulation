from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from backend_fastapi.dependencies import get_model_service
from backend_fastapi.schemas.requests import DelayRequest, SatisfactionRequest
from backend_fastapi.schemas.responses import DelayPrediction, SatisfactionPrediction
from backend_fastapi.services.model_service import ModelService, ModelUnavailableError

router = APIRouter(tags=["Models"])


@router.get("/models", summary="Which model backs each prediction, with test-set metrics")
def model_status(service: ModelService = Depends(get_model_service)) -> dict:
    return service.status()


@router.post("/predict/satisfaction", response_model=SatisfactionPrediction)
def predict_satisfaction(body: SatisfactionRequest, service: ModelService = Depends(get_model_service)) -> dict:
    return service.predict_satisfaction(body)


@router.post(
    "/predict/delay",
    response_model=DelayPrediction,
    responses={503: {"description": "Delay model not trained"}},
)
def predict_delay(body: DelayRequest, service: ModelService = Depends(get_model_service)) -> dict:
    try:
        return service.predict_delay(body)
    except ModelUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@router.get("/forecast/traffic", summary="LSTM monthly passenger forecast with backtest")
def traffic_forecast(service: ModelService = Depends(get_model_service)) -> dict:
    try:
        return service.traffic_forecast()
    except ModelUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
