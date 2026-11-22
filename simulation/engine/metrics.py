"""Turn raw simulation state into KPIs and chart-ready series."""

from __future__ import annotations

from typing import Any

import numpy as np

from simulation.config import SimulationConfig
from simulation.entities.airport import Airport
from simulation.entities.flight import Flight
from simulation.entities.passenger import Passenger, PassengerOutcome
from simulation.parameters import PARAMS

WAIT_BUCKETS: list[tuple[float, float, str]] = [
    (0, 5, "0-5"),
    (5, 10, "5-10"),
    (10, 15, "10-15"),
    (15, 20, "15-20"),
    (20, 30, "20-30"),
    (30, 45, "30-45"),
    (45, 60, "45-60"),
    (60, float("inf"), "60+"),
]


def clock(config: SimulationConfig, minutes: float) -> str:
    total = int(round(config.start_hour * 60 + minutes)) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def _stat(values: np.ndarray, fn: str) -> float:
    if values.size == 0:
        return 0.0
    if fn == "mean":
        return round(float(values.mean()), 2)
    if fn == "p95":
        return round(float(np.percentile(values, 95)), 2)
    if fn == "max":
        return round(float(values.max()), 2)
    raise ValueError(fn)


def wait_distribution(checkin: np.ndarray, security: np.ndarray) -> list[dict[str, Any]]:
    rows = []
    for low, high, label in WAIT_BUCKETS:
        rows.append(
            {
                "bucket": label,
                "checkin": int(((checkin >= low) & (checkin < high)).sum()),
                "security": int(((security >= low) & (security < high)).sum()),
            }
        )
    return rows


def summarise(
    config: SimulationConfig,
    airport: Airport,
    flights: list[Flight],
    passengers: list[Passenger],
    satisfaction: np.ndarray,
) -> dict[str, Any]:
    boarded = [p for p in passengers if p.outcome == PassengerOutcome.BOARDED]
    missed = [p for p in passengers if p.outcome == PassengerOutcome.MISSED]
    checkin_waits = np.array([p.checkin_wait for p in passengers if p.needs_checkin], dtype=float)
    security_waits = np.array([p.security_wait for p in passengers], dtype=float)
    time_to_gate = np.array([p.time_to_gate for p in passengers if p.time_to_gate is not None], dtype=float)
    delays = np.array([f.total_delay for f in flights], dtype=float)

    first_arrival = min((p.arrival_time for p in passengers), default=0.0)
    last_departure = max((f.actual_departure or 0.0 for f in flights), default=0.0)
    horizon = max(1.0, last_departure - first_arrival)
    on_time = float((delays <= 15).mean()) if delays.size else 1.0
    n = len(passengers)

    kpis = {
        "flights": len(flights),
        "passengers": n,
        "boarded": len(boarded),
        "missed_passengers": len(missed),
        "missed_rate": round(len(missed) / n, 4) if n else 0.0,
        "flights_with_missed_passengers": sum(1 for f in flights if f.missed > 0),
        "avg_checkin_wait_min": _stat(checkin_waits, "mean"),
        "p95_checkin_wait_min": _stat(checkin_waits, "p95"),
        "avg_security_wait_min": _stat(security_waits, "mean"),
        "p95_security_wait_min": _stat(security_waits, "p95"),
        "max_security_wait_min": _stat(security_waits, "max"),
        "max_checkin_queue": airport.checkin.max_queue,
        "max_security_queue": airport.security.max_queue,
        "avg_time_to_gate_min": _stat(time_to_gate, "mean"),
        "avg_departure_delay_min": _stat(delays, "mean"),
        "on_time_departure_rate": round(on_time, 4),
        "gate_conflicts": airport.gates.conflicts,
        "checkin_utilization": round(airport.checkin.utilization(horizon), 4),
        "security_utilization": round(airport.security.utilization(horizon), 4),
        "gate_utilization": round(airport.gates.utilization(horizon), 4),
        "avg_satisfaction": round(float(satisfaction.mean()), 4) if satisfaction.size else 0.0,
        "satisfied_share": round(float((satisfaction >= 0.5).mean()), 4) if satisfaction.size else 0.0,
        "throughput_per_hour": round(len(boarded) / (horizon / 60), 1),
        "operating_window_min": round(horizon, 1),
    }

    start = PARAMS.monitor_interval * int(first_arrival // PARAMS.monitor_interval)
    time_series = [{**snap, "clock": clock(config, snap["t"])} for snap in airport.snapshots if snap["t"] >= start]

    flight_log = [
        {
            "flight_id": f.flight_id,
            "airline": f.airline,
            "international": f.international,
            "scheduled": clock(config, f.scheduled_departure),
            "departed": clock(config, f.actual_departure or f.planned_departure),
            "delay_min": round(f.total_delay, 1),
            "gate_wait_min": round(f.gate_wait, 1),
            "passengers": f.passenger_count,
            "boarded": f.boarded,
            "missed": f.missed,
        }
        for f in sorted(flights, key=lambda fl: fl.scheduled_departure)
    ]

    service_levels = [
        {
            "name": "Security wait (p95)",
            "target": f"<= {PARAMS.sla_security_p95:.0f} min",
            "value": kpis["p95_security_wait_min"],
            "met": kpis["p95_security_wait_min"] <= PARAMS.sla_security_p95,
        },
        {
            "name": "Check-in wait (p95)",
            "target": f"<= {PARAMS.sla_checkin_p95:.0f} min",
            "value": kpis["p95_checkin_wait_min"],
            "met": kpis["p95_checkin_wait_min"] <= PARAMS.sla_checkin_p95,
        },
        {
            "name": "Missed-flight rate",
            "target": f"<= {PARAMS.sla_missed_rate:.0%}",
            "value": kpis["missed_rate"],
            "met": kpis["missed_rate"] <= PARAMS.sla_missed_rate,
        },
        {
            "name": "On-time departures",
            "target": f">= {PARAMS.sla_on_time_rate:.0%}",
            "value": kpis["on_time_departure_rate"],
            "met": kpis["on_time_departure_rate"] >= PARAMS.sla_on_time_rate,
        },
    ]

    return {
        "kpis": kpis,
        "service_levels": service_levels,
        "time_series": time_series,
        "wait_distribution": wait_distribution(checkin_waits, security_waits),
        "flights": flight_log,
    }
