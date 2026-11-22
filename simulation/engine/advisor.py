"""Rule-based operations advisor.

Staffing advice uses the classic sizing rule: servers needed = ceil(peak arrival rate x
mean service time / target utilisation). Peak rates come from the simulated passengers,
so the advice reacts to the scenario rather than to fixed thresholds.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from simulation.config import SimulationConfig
from simulation.entities.passenger import Passenger
from simulation.parameters import PARAMS

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2, "ok": 3}


def peak_hourly_rate(times: list[float]) -> float:
    """Highest number of arrivals in any rolling 60-minute window, per minute."""
    if not times:
        return 0.0
    values = np.sort(np.asarray(times, dtype=float))
    # For each arrival, count arrivals in [t, t + 60).
    ends = np.searchsorted(values, values + 60.0, side="left")
    return float((ends - np.arange(len(values))).max()) / 60.0


def required_servers(rate_per_min: float, mean_service: float) -> int:
    return max(1, math.ceil(rate_per_min * mean_service / PARAMS.target_utilization))


def build_recommendations(
    config: SimulationConfig, result: dict[str, Any], passengers: list[Passenger]
) -> list[dict[str, Any]]:
    k = result["kpis"]
    recs: list[dict[str, Any]] = []

    security_service = PARAMS.triangular_mean(PARAMS.security_service) * config.security_service_factor
    security_peak = peak_hourly_rate([p.security_entry for p in passengers if p.security_entry is not None])
    lanes_needed = required_servers(security_peak, security_service)

    checkin_service = PARAMS.triangular_mean(PARAMS.checkin_service)
    checkin_peak = peak_hourly_rate([p.arrival_time for p in passengers if p.needs_checkin])
    counters_needed = required_servers(checkin_peak, checkin_service)

    if k["p95_security_wait_min"] > PARAMS.sla_security_p95 and lanes_needed > config.security_lanes:
        extra = lanes_needed - config.security_lanes
        recs.append(
            {
                "severity": "critical" if k["p95_security_wait_min"] > 2 * PARAMS.sla_security_p95 else "warning",
                "area": "security",
                "title": "Security is the bottleneck",
                "detail": (
                    f"95th percentile wait is {k['p95_security_wait_min']:.0f} min. Peak demand reaches "
                    f"{security_peak * 60:.0f} passengers/hour against {config.security_lanes} lanes."
                ),
                "action": f"Open {extra} more lane{'s' if extra > 1 else ''} ({lanes_needed} total) for the peak.",
            }
        )
    elif config.security_lanes > lanes_needed + 1 and k["p95_security_wait_min"] < 3:
        recs.append(
            {
                "severity": "info",
                "area": "security",
                "title": "Security has spare capacity",
                "detail": f"Lanes run at {k['security_utilization']:.0%} utilisation with almost no queue.",
                "action": f"{lanes_needed} lanes would still meet the wait-time target.",
            }
        )

    if k["p95_checkin_wait_min"] > PARAMS.sla_checkin_p95 and counters_needed > config.checkin_counters:
        extra = counters_needed - config.checkin_counters
        recs.append(
            {
                "severity": "warning",
                "area": "check-in",
                "title": "Check-in queues are building",
                "detail": (
                    f"95th percentile check-in wait is {k['p95_checkin_wait_min']:.0f} min at a peak of "
                    f"{checkin_peak * 60:.0f} passengers/hour."
                ),
                "action": f"Staff {extra} more counter{'s' if extra > 1 else ''} or push online check-in.",
            }
        )

    if k["gate_conflicts"] > 0:
        recs.append(
            {
                "severity": "warning",
                "area": "gates",
                "title": "Aircraft are waiting for gates",
                "detail": f"{k['gate_conflicts']} flights had to wait for a free gate, adding delay.",
                "action": "Add gates or remote stands, or spread departures more evenly.",
            }
        )

    if k["missed_rate"] > PARAMS.sla_missed_rate:
        recs.append(
            {
                "severity": "critical",
                "area": "passengers",
                "title": "Passengers are missing flights",
                "detail": (
                    f"{k['missed_passengers']} passengers ({k['missed_rate']:.1%}) reached the gate after it "
                    f"closed, across {k['flights_with_missed_passengers']} flights."
                ),
                "action": "Cut processing queues first; a fast-track lane for late flights also helps.",
            }
        )

    if k["on_time_departure_rate"] < PARAMS.sla_on_time_rate:
        recs.append(
            {
                "severity": "warning",
                "area": "flights",
                "title": "On-time performance below target",
                "detail": (
                    f"Only {k['on_time_departure_rate']:.0%} of departures leave within 15 minutes; "
                    f"average delay is {k['avg_departure_delay_min']:.0f} min."
                ),
                "action": "Delay is mostly exogenous (weather, inbound aircraft). Pre-plan gate swaps and crew buffers.",
            }
        )

    if not recs:
        recs.append(
            {
                "severity": "ok",
                "area": "operations",
                "title": "Operations within targets",
                "detail": "Queues, missed connections and departures all meet their service levels.",
                "action": "No change needed for this scenario.",
            }
        )

    return sorted(recs, key=lambda r: SEVERITY_ORDER[r["severity"]])
