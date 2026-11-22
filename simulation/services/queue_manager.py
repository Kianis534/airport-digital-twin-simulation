"""Instrumented SimPy resource used for check-in counters and security lanes."""

from __future__ import annotations

from collections.abc import Generator
from typing import Any

import simpy


class QueueManager:
    """A FIFO multi-server queue that keeps the statistics the KPIs need.

    Use it from a SimPy process with ``wait = yield from queue.serve(service_time)``.
    """

    def __init__(self, env: simpy.Environment, name: str, capacity: int) -> None:
        if capacity < 1:
            raise ValueError(f"{name} needs at least one server")
        self.env = env
        self.name = name
        self.capacity = capacity
        self.resource = simpy.Resource(env, capacity=capacity)
        self.max_queue = 0
        self.busy_time = 0.0
        self.served = 0

    @property
    def queue_length(self) -> int:
        return len(self.resource.queue)

    @property
    def in_service(self) -> int:
        return self.resource.count

    def serve(self, service_time: float) -> Generator[simpy.Event, Any, float]:
        """Queue, get served for ``service_time`` minutes and return the queueing time."""
        joined = self.env.now
        with self.resource.request() as request:
            self.max_queue = max(self.max_queue, len(self.resource.queue))
            yield request
            wait = self.env.now - joined
            yield self.env.timeout(service_time)
        self.busy_time += service_time
        self.served += 1
        return wait

    def utilization(self, horizon: float) -> float:
        """Share of available server-minutes spent serving passengers."""
        if horizon <= 0:
            return 0.0
        return min(1.0, self.busy_time / (self.capacity * horizon))
