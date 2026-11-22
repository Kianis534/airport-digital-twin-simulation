"""Request bodies. Bounds come from the simulation config so the API and engine agree."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from simulation.config import BOUNDS, SimulationConfig

_D = SimulationConfig()


def _bounded(name: str, default: float, description: str):
    low, high = BOUNDS[name]
    return Field(default, ge=low, le=high, description=description)


class ScenarioRequest(BaseModel):
    """A what-if scenario. Every field is optional; omitted fields use the baseline."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "scenario_name": "Summer peak, one lane closed",
                    "security_lanes": 5,
                    "traffic_increase_pct": 20,
                    "forecast_month": 7,
                    "seed": 7,
                }
            ]
        },
    )

    scenario_name: str = Field(_D.scenario_name, max_length=80)
    checkin_counters: int = _bounded("checkin_counters", _D.checkin_counters, "Staffed check-in counters")
    security_lanes: int = _bounded("security_lanes", _D.security_lanes, "Open security lanes")
    boarding_gates: int = _bounded("boarding_gates", _D.boarding_gates, "Contact gates available")
    traffic_increase_pct: float = _bounded("traffic_increase_pct", _D.traffic_increase_pct, "Change in departures, %")
    delay_offset_min: float = _bounded("delay_offset_min", _D.delay_offset_min, "Minutes added to every flight")
    weather_severity: float = _bounded("weather_severity", _D.weather_severity, "0 = clear, 100 = severe storm")
    security_tech: Literal["standard", "advanced"] = Field(_D.security_tech, description="'advanced' = CT scanners")
    duration_minutes: int = _bounded("duration_minutes", _D.duration_minutes, "Length of the departure window")
    base_departures_per_hour: float = _bounded(
        "base_departures_per_hour", _D.base_departures_per_hour, "Average departures per hour before changes"
    )
    international_share: float = _bounded(
        "international_share", _D.international_share, "Share of international flights"
    )
    forecast_month: int | None = Field(None, ge=1, le=12, description="Apply LSTM seasonal demand for this month")
    seed: int | None = Field(_D.seed, ge=0, le=2**31 - 1, description="Random seed; null for a fresh draw")

    def to_config(self) -> SimulationConfig:
        return SimulationConfig.from_dict(self.model_dump())


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    baseline: ScenarioRequest = Field(default_factory=ScenarioRequest)
    scenario: ScenarioRequest


class ServiceRatings(BaseModel):
    """Survey ratings on a 0-5 scale (0 = not applicable)."""

    inflight_wifi_service: int = Field(3, ge=0, le=5)
    departure_arrival_time_convenient: int = Field(3, ge=0, le=5)
    ease_of_online_booking: int = Field(3, ge=0, le=5)
    gate_location: int = Field(3, ge=0, le=5)
    food_and_drink: int = Field(3, ge=0, le=5)
    online_boarding: int = Field(3, ge=0, le=5)
    seat_comfort: int = Field(3, ge=0, le=5)
    inflight_entertainment: int = Field(3, ge=0, le=5)
    onboard_service: int = Field(3, ge=0, le=5)
    leg_room_service: int = Field(3, ge=0, le=5)
    baggage_handling: int = Field(3, ge=0, le=5)
    checkin_service: int = Field(3, ge=0, le=5)
    inflight_service: int = Field(3, ge=0, le=5)
    cleanliness: int = Field(3, ge=0, le=5)


class SatisfactionRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "gender": "Female",
                    "customer_type": "Loyal Customer",
                    "age": 41,
                    "type_of_travel": "Business travel",
                    "travel_class": "Business",
                    "flight_distance": 1450,
                    "departure_delay_min": 25,
                    "arrival_delay_min": 18,
                    "ratings": {"online_boarding": 5, "inflight_wifi_service": 4, "checkin_service": 2},
                }
            ]
        },
    )

    gender: Literal["Male", "Female"]
    customer_type: Literal["Loyal Customer", "disloyal Customer"]
    age: int = Field(..., ge=5, le=100)
    type_of_travel: Literal["Business travel", "Personal Travel"]
    travel_class: Literal["Business", "Eco", "Eco Plus"]
    flight_distance: float = Field(..., ge=0, le=10000, description="Miles")
    departure_delay_min: float = Field(0, ge=0, le=1600)
    arrival_delay_min: float = Field(0, ge=0, le=1600)
    ratings: ServiceRatings = Field(default_factory=ServiceRatings)


class DelayRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month: int = Field(..., ge=1, le=12)
    day_of_week: int = Field(..., ge=1, le=7, description="1 = Monday")
    dep_hour: int = Field(..., ge=0, le=23)
    airline: str = Field(..., min_length=2, max_length=3, description="IATA airline code, e.g. UA")
    origin: str = Field("SFO", min_length=3, max_length=4, description="IATA airport code")
    distance: float = Field(..., gt=0, le=6000, description="Miles")
    congestion_score: float = Field(0.3, ge=0, le=1, description="Departures this hour / 90")
