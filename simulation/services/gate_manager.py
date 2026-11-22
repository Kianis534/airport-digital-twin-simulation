"""Gate allocation. When every gate is occupied, the next aircraft waits and departs late."""

from __future__ import annotations

from collections.abc import Generator
from typing import Any

import simpy
from simpy.resources.resource import Request


class GateManager:
    def __init__(self, env: simpy.Environment, num_gates: int) -> None:
        if num_gates < 1:
            raise ValueError("The airport needs at least one gate")
        self.env = env
        self.num_gates = num_gates
        self.resource = simpy.Resource(env, capacity=num_gates)
        self.occupied_time = 0.0
        self.conflicts = 0
        self.total_wait = 0.0

    @property
    def in_use(self) -> int:
        return self.resource.count

    def acquire(self) -> Generator[simpy.Event, Any, tuple[Request, float]]:
        """Request a gate and return ``(request, wait_minutes)``. Release with :meth:`release`."""
        requested = self.env.now
        request = self.resource.request()
        yield request
        wait = self.env.now - requested
        if wait > 1e-9:
            self.conflicts += 1
            self.total_wait += wait
        return request, wait

    def release(self, request: Request, occupied_since: float) -> None:
        self.occupied_time += self.env.now - occupied_since
        self.resource.release(request)

    def utilization(self, horizon: float) -> float:
        if horizon <= 0:
            return 0.0
        return min(1.0, self.occupied_time / (self.num_gates * horizon))
