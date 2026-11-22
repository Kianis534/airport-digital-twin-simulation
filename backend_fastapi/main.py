"""FastAPI application: simulation runs, model inference and forecasts.

uvicorn backend_fastapi.main:app --reload
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend_fastapi.config import get_settings
from backend_fastapi.routes import predictions, simulations
from backend_fastapi.schemas.responses import Health
from backend_fastapi.services.model_service import ModelService
from backend_fastapi.services.simulation_service import SimulationService
from simulation import ENGINE_VERSION

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.model_service = ModelService()
        app.state.simulation_service = SimulationService(settings.max_jobs, settings.job_workers)
        # Load artifacts at startup so the first request is not slow.
        app.state.model_service.status()
        _ = app.state.model_service.models.passenger_profiles
        yield
        app.state.simulation_service.shutdown()

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=(
            "Discrete-event airport simulation (SimPy) with machine-learning models for flight "
            "delay, passenger satisfaction and traffic demand. Run what-if scenarios, compare "
            "them against a baseline, or call the models directly."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health", response_model=Health, tags=["Health"])
    def health() -> dict:
        return {
            "status": "ok",
            "version": settings.version,
            "engine_version": ENGINE_VERSION,
            "models": app.state.model_service.status(),
        }

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"name": settings.app_name, "docs": "/docs", "health": "/health"}

    app.include_router(simulations.router, prefix=API_PREFIX)
    app.include_router(predictions.router, prefix=API_PREFIX)
    return app


app = create_app()


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("backend_fastapi.main:app", host="0.0.0.0", port=8000)
