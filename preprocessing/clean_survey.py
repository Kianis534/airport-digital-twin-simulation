"""Clean the Airline Passenger Satisfaction survey (Kaggle, 129,880 respondents)."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ml_models.features import RATING_COLUMNS, SURVEY_COLUMNS, load_survey
from preprocessing.report import StepReport

VALID_CATEGORIES = {
    "Gender": {"Male", "Female"},
    "Customer Type": {"Loyal Customer", "disloyal Customer"},
    "Type of Travel": {"Business travel", "Personal Travel"},
    "Class": {"Business", "Eco", "Eco Plus"},
    "satisfaction": {"satisfied", "neutral or dissatisfied"},
}


def clean_survey(path: Path, name: str = "survey") -> tuple[pd.DataFrame, StepReport]:
    report = StepReport(name)
    raw = pd.read_csv(path)
    report.rows_in = len(raw)
    report.note("missing arrival delays filled from departure delay", int(raw["Arrival Delay in Minutes"].isna().sum()))

    df = load_survey(path)[[*SURVEY_COLUMNS, "satisfaction"]]

    before = len(df)
    for column, allowed in VALID_CATEGORIES.items():
        df = df[df[column].isin(allowed)]
    report.note("removed rows with unknown categories", before - len(df))

    before = len(df)
    rating_cols = list(RATING_COLUMNS)
    df = df[df[rating_cols].apply(lambda col: col.between(0, 5)).all(axis=1)]
    report.note("removed out-of-range ratings", before - len(df))

    report.rows_out = len(df)
    return df.reset_index(drop=True), report
