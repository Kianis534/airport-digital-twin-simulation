"""Flight entity: schedule, delay and gate state for one departure."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import simpy


class FlightStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    AT_GATE = "AT_GATE"
    BOARDING = "BOARDING"
    GATE_CLOSED = "GATE_CLOSED"
    DEPARTED = "DEPARTED"


@dataclass(slots=True)
class Flight:
    """A departing flight.

    ``predicted_delay`` comes from the delay model (or the empirical fallback) plus the
    scenario's weather and manual offsets. ``gate_wait`` is extra delay that only shows up
    during the run, when every gate is busy and the aircraft has to wait for one.
    """

    flight_id: str
    airline: str
    scheduled_departure: float
    seats: int
    passenger_count: int
    international: bool
    distance_miles: float
    predicted_delay: float
    status: FlightStatus = FlightStatus.SCHEDULED
    gate_wait: float = 0.0
    actual_departure: float | None = None
    gate_closed: bool = False
    boarding_active: int = 0
    boarded: int = 0
    missed: int = 0
    # SimPy handles, attached by the airport when the flight process starts.
    boarding_open: simpy.Event | None = field(default=None, repr=False)
    boarding_lanes: simpy.Resource | None = field(default=None, repr=False)

    @property
    def planned_departure(self) -> float:
        """Departure time once the predicted delay is applied (before any gate wait)."""
        return self.scheduled_departure + self.predicted_delay

    @property
    def total_delay(self) -> float:
        if self.actual_departure is None:
            return self.predicted_delay + self.gate_wait
        return max(0.0, self.actual_departure - self.scheduled_departure)
