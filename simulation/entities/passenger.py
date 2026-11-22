"""Passenger agent and the timestamps recorded along its journey."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class PassengerOutcome(str, Enum):
    IN_PROGRESS = "IN_PROGRESS"
    BOARDED = "BOARDED"
    MISSED = "MISSED"


@dataclass(slots=True)
class Passenger:
    """One traveller. Wait times are queueing time only, service time is excluded."""

    passenger_id: int
    flight_index: int
    profile_index: int
    arrival_time: float
    needs_checkin: bool
    checkin_wait: float = 0.0
    security_wait: float = 0.0
    security_entry: float | None = None
    gate_arrival: float | None = None
    boarded_time: float | None = None
    outcome: PassengerOutcome = PassengerOutcome.IN_PROGRESS

    @property
    def process_wait(self) -> float:
        """Total time spent standing in check-in and security queues."""
        return self.checkin_wait + self.security_wait

    @property
    def time_to_gate(self) -> float | None:
        if self.gate_arrival is None:
            return None
        return self.gate_arrival - self.arrival_time
