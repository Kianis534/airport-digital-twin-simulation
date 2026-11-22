"""Response models. They document the API in /docs and guard the wire format."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Kpis(BaseModel):
    flights: int
    passengers: int
    boarded: int
    missed_passengers: int
    missed_rate: float = Field(..., description="Share of passengers who reached the gate after it closed")
    flights_with_missed_passengers: int
    avg_checkin_wait_min: float
    p95_checkin_wait_min: float
    avg_security_wait_min: float
    p95_security_wait_min: float
    max_security_wait_min: float
    max_checkin_queue: int
    max_security_queue: int
    avg_time_to_gate_min: float
    avg_departure_delay_min: float
    on_time_departure_rate: float = Field(..., description="Departures leaving within 15 minutes of schedule")
    gate_conflicts: int = Field(..., description="Flights that had to wait for a free gate")
    checkin_utilization: float
    security_utilization: float
    gate_utilization: float
    avg_satisfaction: float = Field(..., description="Mean predicted probability of a satisfied passenger")
    satisfied_share: float
    throughput_per_hour: float
    operating_window_min: float


class ServiceLevel(BaseModel):
    name: str
    target: str
    value: float
    met: bool


class Snapshot(BaseModel):
    t: float
    clock: str
    checkin_queue: int
    security_queue: int
    checkin_busy: int
    security_busy: int
    in_terminal: int
    at_gate: int
    boarded: int
    missed: int
    gates_in_use: int


class WaitBucket(BaseModel):
    bucket: str
    checkin: int
    security: int


class FlightRecord(BaseModel):
    flight_id: str
    airline: str
    international: bool
    scheduled: str
    departed: str
    delay_min: float
    gate_wait_min: float
    passengers: int
    boarded: int
    missed: int


class Recommendation(BaseModel):
    severity: Literal["critical", "warning", "info", "ok"]
    area: str
    title: str
    detail: str
    action: str


class EngineInfo(BaseModel):
    version: str
    seed: int
    runtime_ms: float
    delay_model: str
    satisfaction_model: str
    demand_model: str
    demand_multiplier: float


class SimulationResult(BaseModel):
    scenario: dict[str, Any]
    kpis: Kpis
    service_levels: list[ServiceLevel]
    time_series: list[Snapshot]
    wait_distribution: list[WaitBucket]
    flights: list[FlightRecord]
    recommendations: list[Recommendation]
    engine: EngineInfo


class ComparisonResult(BaseModel):
    baseline: SimulationResult
    scenario: SimulationResult
    delta: dict[str, float] = Field(..., description="scenario minus baseline, per KPI")


class JobStatus(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    submitted_at: str
    finished_at: str | None = None
    error: str | None = None
    result: SimulationResult | None = None


class SatisfactionPrediction(BaseModel):
    probability_satisfied: float
    satisfied: bool
    model: str


class DelayPrediction(BaseModel):
    predicted_delay_min: float
    model: str


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    engine_version: str
    models: dict[str, Any]
