"""Feature contracts shared by training and inference.

Training and serving call the same functions, so a model can never see differently
encoded inputs at prediction time (the most common way these pipelines break).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from ml_models.paths import AIRLINES_CSV, AIRPORTS_CSV

# --------------------------------------------------------------------------------------
# Passenger satisfaction (Kaggle "Airline Passenger Satisfaction" survey, ~130k rows)
# --------------------------------------------------------------------------------------

RATING_COLUMNS: dict[str, str] = {
    "Inflight wifi service": "inflight_wifi_service",
    "Departure/Arrival time convenient": "departure_arrival_time_convenient",
    "Ease of Online booking": "ease_of_online_booking",
    "Gate location": "gate_location",
    "Food and drink": "food_and_drink",
    "Online boarding": "online_boarding",
    "Seat comfort": "seat_comfort",
    "Inflight entertainment": "inflight_entertainment",
    "On-board service": "onboard_service",
    "Leg room service": "leg_room_service",
    "Baggage handling": "baggage_handling",
    "Checkin service": "checkin_service",
    "Inflight service": "inflight_service",
    "Cleanliness": "cleanliness",
}

SURVEY_COLUMNS: list[str] = [
    "Gender",
    "Customer Type",
    "Age",
    "Type of Travel",
    "Class",
    "Flight Distance",
    *RATING_COLUMNS.keys(),
    "Departure Delay in Minutes",
    "Arrival Delay in Minutes",
]

SATISFACTION_FEATURES: list[str] = [
    "age",
    "flight_distance",
    "departure_delay_min",
    "arrival_delay_min",
    "is_male",
    "is_loyal_customer",
    "is_business_travel",
    "class_business",
    "class_eco_plus",
    *RATING_COLUMNS.values(),
    "service_quality_score",
    "delay_impact_score",
    "customer_tolerance_index",
]

SATISFACTION_TARGET = "satisfaction"


def load_survey(path: Path) -> pd.DataFrame:
    """Read the raw survey CSV, drop index columns and repair missing arrival delays.

    About 0.3% of rows have no arrival delay. Departure and arrival delay correlate at
    0.96 in this data, so the departure delay is a far better fill value than zero.
    """
    df = pd.read_csv(path)
    df = df.drop(columns=[c for c in ("Unnamed: 0", "id") if c in df.columns])
    df["Arrival Delay in Minutes"] = df["Arrival Delay in Minutes"].fillna(df["Departure Delay in Minutes"])
    return df


def satisfaction_target(df: pd.DataFrame) -> pd.Series:
    return (df[SATISFACTION_TARGET].str.strip().str.lower() == "satisfied").astype(int)


def build_satisfaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """Turn raw survey columns into the model's numeric feature matrix."""
    missing = [c for c in SURVEY_COLUMNS if c not in df.columns]
    if missing:
        raise KeyError(f"Survey frame is missing columns: {missing}")

    out = pd.DataFrame(index=df.index)
    out["age"] = df["Age"].astype(float)
    out["flight_distance"] = df["Flight Distance"].astype(float)
    out["departure_delay_min"] = df["Departure Delay in Minutes"].astype(float)
    out["arrival_delay_min"] = df["Arrival Delay in Minutes"].astype(float)
    out["is_male"] = (df["Gender"] == "Male").astype(int)
    out["is_loyal_customer"] = (df["Customer Type"] == "Loyal Customer").astype(int)
    out["is_business_travel"] = (df["Type of Travel"] == "Business travel").astype(int)
    out["class_business"] = (df["Class"] == "Business").astype(int)
    out["class_eco_plus"] = (df["Class"] == "Eco Plus").astype(int)
    for raw, snake in RATING_COLUMNS.items():
        out[snake] = df[raw].astype(float)

    ratings = out[list(RATING_COLUMNS.values())]
    out["service_quality_score"] = ratings.mean(axis=1)
    out["delay_impact_score"] = out["arrival_delay_min"] / (out["flight_distance"] + 1.0)
    out["customer_tolerance_index"] = out["service_quality_score"] * (out["is_loyal_customer"] + 1)
    return out[SATISFACTION_FEATURES]


# Upper bounds (minutes of queueing) for a 5, 4, 3 and 2 star process rating; above -> 1.
EXPERIENCE_BANDS: tuple[float, ...] = (5.0, 10.0, 20.0, 35.0)


def experience_rating(process_wait: np.ndarray | float) -> np.ndarray:
    """Map total check-in + security queueing time to a 1-5 star rating."""
    wait = np.asarray(process_wait, dtype=float)
    stars_lost = np.searchsorted(np.asarray(EXPERIENCE_BANDS), wait, side="right")
    return (5 - stars_lost).astype(float)


def apply_journey_experience(
    profiles: pd.DataFrame,
    process_wait: np.ndarray,
    departure_delay: np.ndarray,
) -> pd.DataFrame:
    """Overlay simulated airport experience onto sampled survey profiles.

    Each simulated passenger borrows a real survey respondent's demographics and in-flight
    ratings. The survey has one rating for the airport process itself ("Checkin service");
    it is replaced by a rating derived from the passenger's simulated queueing time, and
    the flight's simulated departure delay replaces the recorded delays. The model then
    answers: how would this traveller rate the trip after this airport experience?
    """
    adjusted = profiles.copy()
    adjusted["Checkin service"] = experience_rating(process_wait)
    delay = np.maximum(np.asarray(departure_delay, dtype=float), 0.0)
    adjusted["Departure Delay in Minutes"] = delay
    adjusted["Arrival Delay in Minutes"] = delay
    return adjusted


# --------------------------------------------------------------------------------------
# Flight delay (2015 US DOT on-time performance data)
# --------------------------------------------------------------------------------------

DELAY_FEATURES: list[str] = [
    "month",
    "day_of_week",
    "dep_hour",
    "airline_code",
    "origin_code",
    "distance",
    "rush_hour",
    "is_weekend",
    "congestion_score",
]

# TAXI_OUT, ARRIVAL_DELAY and the delay-cause columns are only known after departure,
# so they are deliberately excluded to avoid target leakage.
DELAY_TARGET = "DEPARTURE_DELAY"


@lru_cache(maxsize=1)
def airline_vocabulary() -> tuple[str, ...]:
    return tuple(sorted(pd.read_csv(AIRLINES_CSV)["IATA_CODE"].astype(str)))


@lru_cache(maxsize=1)
def airport_vocabulary() -> tuple[str, ...]:
    return tuple(sorted(pd.read_csv(AIRPORTS_CSV)["IATA_CODE"].astype(str)))


def encode_codes(values: pd.Series, vocabulary: tuple[str, ...]) -> pd.Series:
    """Map IATA codes to stable integer ids. Unknown codes (e.g. numeric ids) become -1."""
    lookup = {code: idx for idx, code in enumerate(vocabulary)}
    return values.astype(str).map(lookup).fillna(-1).astype(int)


def is_rush_hour(hour: pd.Series | np.ndarray) -> np.ndarray:
    hour = np.asarray(hour)
    return (((hour >= 6) & (hour <= 9)) | ((hour >= 16) & (hour <= 19))).astype(int)


def build_delay_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build delay-model features from cleaned flight rows.

    Expects MONTH, DAY_OF_WEEK, SCHEDULED_DEPARTURE (HHMM), AIRLINE, ORIGIN_AIRPORT,
    DISTANCE and a precomputed ``congestion_score`` column.
    """
    out = pd.DataFrame(index=df.index)
    out["month"] = df["MONTH"].astype(int)
    out["day_of_week"] = df["DAY_OF_WEEK"].astype(int)
    out["dep_hour"] = (df["SCHEDULED_DEPARTURE"].astype(int) // 100).clip(0, 23)
    out["airline_code"] = encode_codes(df["AIRLINE"], airline_vocabulary())
    out["origin_code"] = encode_codes(df["ORIGIN_AIRPORT"], airport_vocabulary())
    out["distance"] = df["DISTANCE"].astype(float)
    out["rush_hour"] = is_rush_hour(out["dep_hour"])
    out["is_weekend"] = df["DAY_OF_WEEK"].isin([6, 7]).astype(int)
    out["congestion_score"] = df["congestion_score"].astype(float)
    return out[DELAY_FEATURES]
