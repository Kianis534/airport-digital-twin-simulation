"""Clean SFO Air Traffic Passenger Statistics and build the monthly passenger series."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from preprocessing.report import StepReport


def clean_traffic(path: Path) -> tuple[pd.DataFrame, StepReport]:
    report = StepReport("traffic")
    df = pd.read_csv(path)
    report.rows_in = len(df)

    df = df.drop(columns=[c for c in ("index",) if c in df.columns])
    before = len(df)
    df = df.drop_duplicates()
    report.note("removed duplicates", before - len(df))

    before = len(df)
    df = df.dropna(subset=["Activity Period", "Passenger Count"])
    report.note("removed rows without period/count", before - len(df))

    df["Date"] = pd.to_datetime(df["Activity Period"].astype(str), format="%Y%m")
    for column in ("Operating Airline", "GEO Region", "GEO Summary", "Activity Type Code"):
        df[column] = df[column].astype(str).str.strip()
    df = df.sort_values("Date")

    report.rows_out = len(df)
    return df.reset_index(drop=True), report


def monthly_series(df: pd.DataFrame) -> pd.DataFrame:
    """Total passengers per month (enplaned + deplaned + transit), with calendar features."""
    monthly = df.groupby("Date", as_index=False)["Passenger Count"].sum()
    monthly = monthly.rename(columns={"Passenger Count": "passengers"}).sort_values("Date")
    full_range = pd.date_range(monthly["Date"].min(), monthly["Date"].max(), freq="MS")
    if len(full_range) != len(monthly):
        monthly = monthly.set_index("Date").reindex(full_range).interpolate().rename_axis("Date").reset_index()
    monthly["month"] = monthly["Date"].dt.month
    monthly["yoy_growth"] = monthly["passengers"].pct_change(12)
    rolling_mean = monthly["passengers"].rolling(12, min_periods=12).mean()
    monthly["seasonality_index"] = monthly["passengers"] / rolling_mean
    return monthly.reset_index(drop=True)
