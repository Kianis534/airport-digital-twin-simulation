"""Scenario configuration for the airport digital twin.

Every what-if lever exposed by the API, the Streamlit app and the web dashboard
maps onto a field of :class:`SimulationConfig`. Validation lives here so all
entry points reject bad input the same way.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields
from typing import Any, Literal

SecurityTech = Literal["standard", "advanced"]

# (min, max) bounds for numeric fields. Shared with the API schema and the UI sliders.
BOUNDS: dict[str, tuple[float, float]] = {
    "checkin_counters": (1, 40),
    "security_lanes": (1, 25),
    "boarding_gates": (1, 40),
    "traffic_increase_pct": (-50, 200),
    "delay_offset_min": (0, 180),
    "weather_severity": (0, 100),
    "duration_minutes": (60, 1440),
    "base_departures_per_hour": (1, 30),
    "international_share": (0.0, 1.0),
}


class ConfigError(ValueError):
    """Raised when a scenario configuration is out of range or malformed."""


@dataclass(frozen=True)
class SimulationConfig:
    """Inputs for one simulation run.

    Times are in minutes. The simulated clock starts at ``start_hour`` and the first
    departure leaves three hours later, so early passengers have time to arrive.
    """

    scenario_name: str = "Baseline"
    checkin_counters: int = 12
    security_lanes: int = 6
    boarding_gates: int = 8
    traffic_increase_pct: float = 0.0
    delay_offset_min: float = 0.0
    weather_severity: float = 0.0
    security_tech: SecurityTech = "standard"
    duration_minutes: int = 480
    base_departures_per_hour: float = 3.0
    international_share: float = 0.3
    forecast_month: int | None = None
    start_hour: int = 3
    seed: int | None = 42

    def __post_init__(self) -> None:
        for name, (low, high) in BOUNDS.items():
            value = getattr(self, name)
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                raise ConfigError(f"{name} must be a number, got {value!r}")
            if not low <= value <= high:
                raise ConfigError(f"{name}={value} is outside the allowed range [{low}, {high}]")
        if self.security_tech not in ("standard", "advanced"):
            raise ConfigError("security_tech must be 'standard' or 'advanced'")
        if self.forecast_month is not None and not 1 <= int(self.forecast_month) <= 12:
            raise ConfigError("forecast_month must be between 1 and 12")
        if not 0 <= self.start_hour <= 23:
            raise ConfigError("start_hour must be between 0 and 23")

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SimulationConfig:
        """Build a config from a plain dict, ignoring unknown keys."""
        known = {f.name for f in fields(cls)}
        nullable = {"seed", "forecast_month"}
        kwargs = {key: value for key, value in data.items() if key in known and (value is not None or key in nullable)}
        return cls(**kwargs)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def security_service_factor(self) -> float:
        """Advanced CT scanners let passengers keep liquids and laptops in bags."""
        return 0.75 if self.security_tech == "advanced" else 1.0
