from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from backend_fastapi.dependencies import get_simulation_service
from backend_fastapi.schemas.requests import CompareRequest, ScenarioRequest
from backend_fastapi.schemas.responses import ComparisonResult, JobStatus, SimulationResult
from backend_fastapi.services.simulation_service import SimulationService
from simulation import ConfigError

router = APIRouter(prefix="/simulations", tags=["Simulation"])


@router.post("", response_model=SimulationResult, summary="Run a scenario and wait for the result")
def run_scenario(
    body: ScenarioRequest | None = None,
    service: SimulationService = Depends(get_simulation_service),
) -> dict:
    try:
        return service.run((body or ScenarioRequest()).to_config())
    except ConfigError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.post("/compare", response_model=ComparisonResult, summary="Run a baseline and a what-if scenario")
def compare_scenarios(body: CompareRequest, service: SimulationService = Depends(get_simulation_service)) -> dict:
    try:
        return service.compare(body.baseline.to_config(), body.scenario.to_config())
    except ConfigError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.post(
    "/jobs",
    response_model=JobStatus,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue a scenario to run in the background",
)
def submit_job(
    body: ScenarioRequest | None = None, service: SimulationService = Depends(get_simulation_service)
) -> dict:
    try:
        return service.submit((body or ScenarioRequest()).to_config())
    except ConfigError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.get("/jobs/{job_id}", response_model=JobStatus, summary="Poll a background job")
def get_job(job_id: str, service: SimulationService = Depends(get_simulation_service)) -> dict:
    job = service.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job {job_id} not found")
    return job
