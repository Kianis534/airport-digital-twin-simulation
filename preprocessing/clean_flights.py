"""Clean the 2015 US DOT flight on-time dataset (Kaggle "2015 Flight Delays and Cancellations").

The raw file is ~565 MB and not stored in git. Download ``flights.csv`` and place it at
``datasets/raw/flights.csv`` (see datasets/README.md).
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from preprocessing.report import StepReport

COLUMNS = [
    "YEAR",
    "MONTH",
    "DAY",
    "DAY_OF_WEEK",
    "AIRLINE",
    "ORIGIN_AIRPORT",
    "DESTINATION_AIRPORT",
    "SCHEDULED_DEPARTURE",
    "DEPARTURE_DELAY",
    "DISTANCE",
    "DIVERTED",
    "CANCELLED",
]

DTYPES = {
    "YEAR": "int16",
    "MONTH": "int8",
    "DAY": "int8",
    "DAY_OF_WEEK": "int8",
    "AIRLINE": "category",
    "ORIGIN_AIRPORT": "string",
    "DESTINATION_AIRPORT": "string",
    "SCHEDULED_DEPARTURE": "int16",
    "DEPARTURE_DELAY": "float32",
    "DISTANCE": "float32",
    "DIVERTED": "int8",
    "CANCELLED": "int8",
}

DELAY_CLIP = (-60.0, 600.0)


def clean_flights(path: Path, sample_rows: int | None = None, seed: int = 42) -> tuple[pd.DataFrame, StepReport]:
    """Load only the columns the model needs and drop rows that cannot be labelled.

    * cancelled and diverted flights have no meaningful departure delay
    * delays are clipped to [-60, 600] minutes to tame a handful of data-entry outliers
    * ``sample_rows`` keeps training fast on laptops; the full file has ~5.8M rows
    """
    report = StepReport("flights")
    df = pd.read_csv(path, usecols=COLUMNS, dtype=DTYPES, low_memory=False)
    report.rows_in = len(df)

    df = df[(df["CANCELLED"] == 0) & (df["DIVERTED"] == 0)]
    report.note("removed cancelled/diverted", report.rows_in - len(df))

    before = len(df)
    df = df.dropna(subset=["DEPARTURE_DELAY", "DISTANCE"])
    report.note("removed missing delay/distance", before - len(df))

    before = len(df)
    df = df.drop_duplicates()
    report.note("removed duplicates", before - len(df))

    df["DEPARTURE_DELAY"] = df["DEPARTURE_DELAY"].clip(*DELAY_CLIP)
    df = df.drop(columns=["CANCELLED", "DIVERTED"])

    if sample_rows and len(df) > sample_rows:
        df = df.sample(n=sample_rows, random_state=seed)
        report.note("sampled rows", sample_rows)

    report.rows_out = len(df)
    return df.reset_index(drop=True), report
