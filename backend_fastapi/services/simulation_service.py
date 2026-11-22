"""Runs scenarios synchronously or as background jobs."""

from __future__ import annotations

import logging
import threading
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from simulation import SimulationConfig, run_simulation

logger = logging.getLogger(__name__)

DELTA_KPIS = (
    "passengers",
    "missed_passengers",
    "missed_rate",
    "avg_security_wait_min",
    "p95_security_wait_min",
    "avg_checkin_wait_min",
    "p95_checkin_wait_min",
    "avg_departure_delay_min",
    "on_time_departure_rate",
    "security_utilization",
    "checkin_utilization",
    "gate_utilization",
    "avg_satisfaction",
    "throughput_per_hour",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class SimulationService:
    """In-memory job store. Swap for Redis/RQ or Celery if you run several API replicas."""

    def __init__(self, max_jobs: int = 200, workers: int = 2) -> None:
        self._jobs: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._lock = threading.Lock()
        self._max_jobs = max_jobs
        self._executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="sim")

    def run(self, config: SimulationConfig) -> dict[str, Any]:
        return run_simulation(config)

    def compare(self, baseline: SimulationConfig, scenario: SimulationConfig) -> dict[str, Any]:
        # Share the seed so the comparison isolates the effect of the changed levers.
        if scenario.seed is None or baseline.seed is None:
            seed = baseline.seed if baseline.seed is not None else scenario.seed
            if seed is None:
                seed = 42
            baseline = SimulationConfig.from_dict(baseline.to_dict() | {"seed": seed})
            scenario = SimulationConfig.from_dict(scenario.to_dict() | {"seed": seed})
        base = run_simulation(baseline)
        what_if = run_simulation(scenario)
        delta = {k: round(what_if["kpis"][k] - base["kpis"][k], 4) for k in DELTA_KPIS}
        return {"baseline": base, "scenario": what_if, "delta": delta}

    # ------------------------------------------------------------------ jobs
    def submit(self, config: SimulationConfig) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        job = {
            "job_id": job_id,
            "status": "queued",
            "submitted_at": _now(),
            "finished_at": None,
            "error": None,
            "result": None,
        }
        with self._lock:
            self._jobs[job_id] = job
            while len(self._jobs) > self._max_jobs:
                self._jobs.popitem(last=False)
        self._executor.submit(self._execute, job_id, config)
        return dict(job)

    def _execute(self, job_id: str, config: SimulationConfig) -> None:
        self._update(job_id, status="running")
        try:
            result = run_simulation(config)
            self._update(job_id, status="completed", result=result, finished_at=_now())
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Simulation job %s failed", job_id)
            self._update(job_id, status="failed", error=str(exc), finished_at=_now())

    def _update(self, job_id: str, **changes: Any) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].update(changes)

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
