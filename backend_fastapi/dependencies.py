from __future__ import annotations

from fastapi import Request

from backend_fastapi.services.model_service import ModelService
from backend_fastapi.services.simulation_service import SimulationService


def get_simulation_service(request: Request) -> SimulationService:
    return request.app.state.simulation_service


def get_model_service(request: Request) -> ModelService:
    return request.app.state.model_service
