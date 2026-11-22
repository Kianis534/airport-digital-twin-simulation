"""Calibrated process parameters for the airport model.

These are the assumptions behind every run. They are kept in one place (and mirrored
in ``frontend_nextjs/lib/simulation/parameters.ts``) so the Python engine and the
in-browser engine describe the same airport. Times are minutes.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ProcessParameters:
    # Schedule
    first_departure: float = 180.0  # the clock starts 3h before the first departure
    peak_profile: tuple[float, ...] = (1.25, 1.35, 1.15, 0.90, 0.75, 0.85, 1.00, 1.10)
    seat_options: tuple[int, ...] = (150, 180, 220)
    seat_weights: tuple[float, ...] = (0.45, 0.35, 0.20)
    load_factor_range: tuple[float, float] = (0.72, 0.95)
    domestic_distance: tuple[float, float] = (250.0, 2500.0)
    international_distance: tuple[float, float] = (2500.0, 4900.0)
    congestion_reference: float = 90.0  # departures/hour that counts as fully congested

    # Passenger arrival profile (minutes before scheduled departure)
    arrival_mean_domestic: float = 95.0
    arrival_mean_international: float = 120.0
    arrival_sd: float = 25.0
    arrival_bounds: tuple[float, float] = (45.0, 210.0)

    # Processing
    checkin_share_domestic: float = 0.30  # the rest check in online with carry-on only
    checkin_share_international: float = 0.55
    checkin_service: tuple[float, float, float] = (1.2, 2.0, 3.6)  # triangular low/mode/high
    security_service: tuple[float, float, float] = (0.25, 0.40, 0.80)
    walk_to_gate: tuple[float, float] = (6.0, 14.0)
    passport_control: float = 8.0  # extra time for international passengers
    boarding_service: tuple[float, float] = (0.08, 0.16)
    boarding_lanes_per_gate: int = 2

    # Gate timeline relative to departure
    gate_request_lead: float = 55.0
    min_gate_time: float = 45.0  # aircraft needs this long at the gate before pushback
    boarding_lead: float = 40.0
    gate_close_lead: float = 10.0
    pushback: float = 8.0

    # Disruption effects
    weather_delay_max: float = 40.0  # average extra delay at weather_severity = 100
    weather_boarding_slowdown: float = 0.25  # +25% boarding time at weather_severity = 100

    # Service level targets used by the advisor
    target_utilization: float = 0.85
    sla_security_p95: float = 15.0
    sla_checkin_p95: float = 20.0
    sla_missed_rate: float = 0.01
    sla_on_time_rate: float = 0.70  # US carriers averaged ~79% in 2015
    monitor_interval: float = 5.0

    @staticmethod
    def triangular_mean(params: tuple[float, float, float]) -> float:
        return sum(params) / 3.0

    def to_dict(self) -> dict:
        return asdict(self)


PARAMS = ProcessParameters()
