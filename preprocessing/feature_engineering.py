"""Context features that need the whole dataset (not just one row) to compute."""

from __future__ import annotations

import pandas as pd

from simulation.parameters import PARAMS


def add_flight_context(df: pd.DataFrame) -> pd.DataFrame:
    """Add ``congestion_score``: departures from the same airport in the same hour.

    Scores are divided by a fixed reference (90 departures/hour, roughly the busiest US
    hubs) instead of the sample maximum, so training and simulation share one scale.
    """
    out = df.copy()
    hour = (out["SCHEDULED_DEPARTURE"].astype(int) // 100).clip(0, 23)
    keys = [out["ORIGIN_AIRPORT"], out["YEAR"], out["MONTH"], out["DAY"], hour]
    hourly = out.groupby(keys, observed=True)["DISTANCE"].transform("size")
    out["congestion_score"] = (hourly / PARAMS.congestion_reference).clip(0, 1)
    return out
