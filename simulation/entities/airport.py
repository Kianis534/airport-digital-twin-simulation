"""The airport system: shared resources plus the flight and passenger processes."""

from __future__ import annotations

import random
from collections.abc import Generator
from typing import Any

import simpy

from simulation.config import SimulationConfig
from simulation.entities.flight import Flight, FlightStatus
from simulation.entities.passenger import Passenger, PassengerOutcome
from simulation.parameters import PARAMS, ProcessParameters
from simulation.services.gate_manager import GateManager
from simulation.services.queue_manager import QueueManager


class Airport:
    """Discrete-event model of one terminal.

    Passengers flow arrival -> (check-in) -> security -> walk to gate -> boarding.
    Flights claim a gate, open boarding, close the gate and push back. A passenger who
    reaches the gate after it closes misses the flight.
    """

    def __init__(
        self,
        env: simpy.Environment,
        config: SimulationConfig,
        rng: random.Random,
        params: ProcessParameters = PARAMS,
    ) -> None:
        self.env = env
        self.config = config
        self.rng = rng
        self.params = params
        self.checkin = QueueManager(env, "Check-in", config.checkin_counters)
        self.security = QueueManager(env, "Security", config.security_lanes)
        self.gates = GateManager(env, config.boarding_gates)
        self.flights: list[Flight] = []
        self.passengers: list[Passenger] = []
        self.in_terminal = 0
        self.at_gate = 0
        self.boarded = 0
        self.missed = 0
        self.departed = 0
        self.all_departed = env.event()
        self.snapshots: list[dict[str, Any]] = []

    # ------------------------------------------------------------------ timings
    def checkin_time(self) -> float:
        low, mode, high = self.params.checkin_service
        return self.rng.triangular(low, high, mode)

    def security_time(self) -> float:
        low, mode, high = self.params.security_service
        return self.rng.triangular(low, high, mode) * self.config.security_service_factor

    def walk_time(self, international: bool) -> float:
        low, high = self.params.walk_to_gate
        extra = self.params.passport_control if international else 0.0
        return self.rng.uniform(low, high) + extra

    def boarding_time(self) -> float:
        low, high = self.params.boarding_service
        slowdown = 1.0 + self.params.weather_boarding_slowdown * self.config.weather_severity / 100
        return self.rng.uniform(low, high) * slowdown

    # ------------------------------------------------------------------ processes
    def register(self, flight: Flight) -> None:
        flight.boarding_open = self.env.event()
        flight.boarding_lanes = simpy.Resource(self.env, capacity=self.params.boarding_lanes_per_gate)
        self.flights.append(flight)

    def _wait_until(self, time: float) -> Generator[simpy.Event, Any, None]:
        if time > self.env.now:
            yield self.env.timeout(time - self.env.now)

    def flight_process(self, flight: Flight) -> Generator[simpy.Event, Any, None]:
        p = self.params
        yield from self._wait_until(flight.planned_departure - p.gate_request_lead)
        request, _ = yield from self.gates.acquire()
        occupied_since = self.env.now
        flight.status = FlightStatus.AT_GATE

        # A late gate pushes the departure back so the aircraft still gets its turnaround.
        departure = max(flight.planned_departure, self.env.now + p.min_gate_time)
        flight.gate_wait = departure - flight.planned_departure

        yield from self._wait_until(departure - p.boarding_lead)
        flight.status = FlightStatus.BOARDING
        flight.boarding_open.succeed()

        yield from self._wait_until(departure - p.gate_close_lead)
        flight.gate_closed = True
        flight.status = FlightStatus.GATE_CLOSED

        yield from self._wait_until(departure)
        while flight.boarding_active > 0:  # finish boarding whoever is already in the lane
            yield self.env.timeout(0.5)
        flight.actual_departure = self.env.now
        flight.status = FlightStatus.DEPARTED

        yield self.env.timeout(p.pushback)
        self.gates.release(request, occupied_since)
        self.departed += 1
        if self.departed == len(self.flights) and not self.all_departed.triggered:
            self.all_departed.succeed()

    def passenger_process(self, pax: Passenger, flight: Flight) -> Generator[simpy.Event, Any, None]:
        yield from self._wait_until(pax.arrival_time)
        self.in_terminal += 1

        if pax.needs_checkin:
            pax.checkin_wait = yield from self.checkin.serve(self.checkin_time())

        pax.security_entry = self.env.now
        pax.security_wait = yield from self.security.serve(self.security_time())

        yield self.env.timeout(self.walk_time(flight.international))
        pax.gate_arrival = self.env.now

        if flight.gate_closed:
            pax.outcome = PassengerOutcome.MISSED
            flight.missed += 1
            self.missed += 1
            self.in_terminal -= 1
            return

        self.at_gate += 1
        if not flight.boarding_open.triggered:
            yield flight.boarding_open
        flight.boarding_active += 1
        with flight.boarding_lanes.request() as lane:
            yield lane
            yield self.env.timeout(self.boarding_time())
        flight.boarding_active -= 1

        pax.boarded_time = self.env.now
        pax.outcome = PassengerOutcome.BOARDED
        flight.boarded += 1
        self.boarded += 1
        self.at_gate -= 1
        self.in_terminal -= 1

    def monitor_process(self) -> Generator[simpy.Event, Any, None]:
        """Sample the system state at a fixed interval for the time-series charts."""
        while not self.all_departed.triggered:
            self.snapshots.append(
                {
                    "t": round(self.env.now, 2),
                    "checkin_queue": self.checkin.queue_length,
                    "security_queue": self.security.queue_length,
                    "checkin_busy": self.checkin.in_service,
                    "security_busy": self.security.in_service,
                    "in_terminal": self.in_terminal,
                    "at_gate": self.at_gate,
                    "boarded": self.boarded,
                    "missed": self.missed,
                    "gates_in_use": self.gates.in_use,
                }
            )
            yield self.env.timeout(self.params.monitor_interval)
