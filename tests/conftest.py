from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def baseline_result():
    from simulation import SimulationConfig, run_simulation

    return run_simulation(SimulationConfig(seed=123))


@pytest.fixture()
def synthetic_flights_csv(tmp_path: Path) -> Path:
    """A small file with the exact schema of the Kaggle 2015 flights.csv."""
    rng = np.random.default_rng(0)
    n = 3000
    airlines = ["AA", "DL", "UA", "WN", "B6"]
    airports = ["SFO", "LAX", "ATL", "ORD", "JFK", "13930"]  # numeric ids exist in the real data
    df = pd.DataFrame(
        {
            "YEAR": 2015,
            "MONTH": rng.integers(1, 13, n),
            "DAY": rng.integers(1, 29, n),
            "DAY_OF_WEEK": rng.integers(1, 8, n),
            "AIRLINE": rng.choice(airlines, n),
            "FLIGHT_NUMBER": rng.integers(1, 5000, n),
            "TAIL_NUMBER": "N000",
            "ORIGIN_AIRPORT": rng.choice(airports, n),
            "DESTINATION_AIRPORT": rng.choice(airports, n),
            "SCHEDULED_DEPARTURE": rng.integers(5, 23, n) * 100 + rng.integers(0, 60, n),
            "DEPARTURE_DELAY": rng.exponential(12, n) - 3,
            "TAXI_OUT": rng.uniform(5, 30, n),
            "DISTANCE": rng.uniform(100, 3000, n),
            "ARRIVAL_DELAY": rng.normal(5, 20, n),
            "DIVERTED": (rng.random(n) < 0.01).astype(int),
            "CANCELLED": (rng.random(n) < 0.02).astype(int),
        }
    )
    df.loc[df.sample(frac=0.01, random_state=1).index, "DEPARTURE_DELAY"] = np.nan
    path = tmp_path / "flights.csv"
    df.to_csv(path, index=False)
    return path
