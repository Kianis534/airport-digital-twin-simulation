"""Build a flight schedule, run the discrete-event model and summarise the outcome."""

from __future__ import annotations

import logging
import math
import random
import secrets
import time
from typing import Any

import numpy as np
import pandas as pd
import simpy

from simulation.config import SimulationConfig
from simulation.engine.advisor import build_recommendations
from simulation.engine.metrics import summarise
from simulation.entities.airport import Airport
from simulation.entities.flight import Flight
from simulation.entities.passenger import Passenger, PassengerOutcome
from simulation.parameters import PARAMS, ProcessParameters

logger = logging.getLogger(__name__)

ENGINE_VERSION = "2.0.0"
TWIN_AIRPORT = "SFO"  # the traffic history comes from San Francisco International
FALLBACK_AIRLINES = ("AA", "AS", "B6", "DL", "UA", "WN")


def _models():
    from ml_models.inference import get_models

    return get_models()


def _airlines() -> tuple[str, ...]:
    try:
        from ml_models.features import airline_vocabulary

        return airline_vocabulary()
    except Exception:  # pragma: no cover - datasets folder missing
        return FALLBACK_AIRLINES


def _origin_code() -> int:
    try:
        from ml_models.features import airport_vocabulary

        return airport_vocabulary().index(TWIN_AIRPORT)
    except Exception:  # pragma: no cover
        return -1


def build_schedule(
    config: SimulationConfig,
    rng: random.Random,
    np_rng: np.random.Generator,
    models,
    demand_multiplier: float,
    params: ProcessParameters = PARAMS,
) -> tuple[list[Flight], str]:
    """Create the day's departures with predicted delays."""
    rate = config.base_departures_per_hour * (1 + config.traffic_increase_pct / 100) * demand_multiplier
    airlines = _airlines()
    hours = math.ceil(config.duration_minutes / 60)

    rows: list[dict[str, Any]] = []
    for hour in range(hours):
        window = min(60.0, config.duration_minutes - hour * 60)
        expected = rate * params.peak_profile[hour % len(params.peak_profile)] * window / 60
        count = int(expected) + (1 if rng.random() < expected - int(expected) else 0)
        start = params.first_departure + hour * 60
        times = sorted(start + rng.uniform(0, window) for _ in range(count))
        for departure in times:
            international = rng.random() < config.international_share
            low, high = params.international_distance if international else params.domestic_distance
            seats = rng.choices(params.seat_options, weights=params.seat_weights)[0]
            rows.append(
                {
                    "scheduled": departure,
                    "airline": rng.choice(airlines),
                    "international": international,
                    "distance": rng.uniform(low, high),
                    "seats": seats,
                    "passengers": round(seats * rng.uniform(*params.load_factor_range)),
                    "hourly_departures": count,
                }
            )

    if not rows:
        return [], "none"

    frame = pd.DataFrame(rows)
    airline_index = {code: idx for idx, code in enumerate(airlines)}
    clock_hour = ((config.start_hour * 60 + frame["scheduled"]) // 60 % 24).astype(int)
    features = pd.DataFrame(
        {
            "month": config.forecast_month or 7,
            "day_of_week": 3,
            "dep_hour": clock_hour,
            "airline_code": frame["airline"].map(airline_index).fillna(-1).astype(int),
            "origin_code": _origin_code(),
            "distance": frame["distance"],
            "rush_hour": (((clock_hour >= 6) & (clock_hour <= 9)) | ((clock_hour >= 16) & (clock_hour <= 19))).astype(
                int
            ),
            "is_weekend": 0,
            "congestion_score": (frame["hourly_departures"] / params.congestion_reference).clip(0, 1),
        }
    )
    base_delay, source = models.flight_delays(np_rng, features)
    weather = config.weather_severity / 100 * params.weather_delay_max * np_rng.uniform(0.5, 1.5, len(frame))
    delays = base_delay + weather + config.delay_offset_min

    flights = [
        Flight(
            flight_id=f"{row.airline}{100 + i * 7 % 900}",
            airline=row.airline,
            scheduled_departure=float(row.scheduled),
            seats=int(row.seats),
            passenger_count=int(row.passengers),
            international=bool(row.international),
            distance_miles=float(row.distance),
            predicted_delay=float(delays[i]),
        )
        for i, row in enumerate(frame.itertuples())
    ]
    return flights, source


def generate_passengers(
    flights: list[Flight], config: SimulationConfig, rng: random.Random, params: ProcessParameters = PARAMS
) -> list[Passenger]:
    passengers: list[Passenger] = []
    low, high = params.arrival_bounds
    for index, flight in enumerate(flights):
        mean = params.arrival_mean_international if flight.international else params.arrival_mean_domestic
        share = params.checkin_share_international if flight.international else params.checkin_share_domestic
        for _ in range(flight.passenger_count):
            lead = min(high, max(low, rng.gauss(mean, params.arrival_sd)))
            passengers.append(
                Passenger(
                    passenger_id=len(passengers),
                    flight_index=index,
                    profile_index=-1,
                    arrival_time=max(0.0, flight.scheduled_departure - lead),
                    needs_checkin=rng.random() < share,
                )
            )
    passengers.sort(key=lambda p: p.arrival_time)
    return passengers


def run_simulation(config: SimulationConfig | dict[str, Any] | None = None, models=None) -> dict[str, Any]:
    """Run one scenario and return KPIs, time series, flight log and recommendations."""
    if config is None:
        config = SimulationConfig()
    elif isinstance(config, dict):
        config = SimulationConfig.from_dict(config)

    started = time.perf_counter()
    seed = config.seed if config.seed is not None else secrets.randbelow(2**31 - 1)
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    models = models or _models()

    demand_multiplier, demand_source = models.demand_multiplier(config.forecast_month)
    env = simpy.Environment()
    airport = Airport(env, config, rng)
    flights, delay_source = build_schedule(config, rng, np_rng, models, demand_multiplier)
    passengers = generate_passengers(flights, config, rng)

    for flight in flights:
        airport.register(flight)
        env.process(airport.flight_process(flight))
    for pax in passengers:
        env.process(airport.passenger_process(pax, flights[pax.flight_index]))
    airport.passengers = passengers

    if flights:
        env.process(airport.monitor_process())
        env.run(until=airport.all_departed)

    # Score every passenger with the satisfaction model, using their simulated experience.
    profiles, profile_idx = models.sample_profiles(np_rng, len(passengers))
    for pax, idx in zip(passengers, profile_idx, strict=True):
        pax.profile_index = int(idx)
    process_wait = np.array([p.process_wait for p in passengers], dtype=float)
    delays = np.array([flights[p.flight_index].total_delay for p in passengers], dtype=float)
    satisfaction, satisfaction_source = models.satisfaction_probability(profiles, process_wait, delays)
    missed_mask = np.array([p.outcome == PassengerOutcome.MISSED for p in passengers], dtype=bool)
    if len(satisfaction):
        satisfaction = np.where(missed_mask, 0.0, satisfaction)

    result = summarise(config, airport, flights, passengers, satisfaction)
    result["recommendations"] = build_recommendations(config, result, passengers)
    result["engine"] = {
        "version": ENGINE_VERSION,
        "seed": seed,
        "runtime_ms": round((time.perf_counter() - started) * 1000, 1),
        "delay_model": delay_source,
        "satisfaction_model": satisfaction_source,
        "demand_model": demand_source,
        "demand_multiplier": round(demand_multiplier, 4),
    }
    result["scenario"] = config.to_dict() | {"seed": seed}
    logger.info(
        "Scenario '%s': %d flights, %d passengers, %.0f ms",
        config.scenario_name,
        len(flights),
        len(passengers),
        result["engine"]["runtime_ms"],
    )
    return result


# Backwards-compatible name used by earlier versions of the API.
sim_runner = run_simulation
