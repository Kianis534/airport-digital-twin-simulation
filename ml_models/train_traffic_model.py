"""Train the monthly passenger-traffic forecaster (LSTM) on SFO traffic, 2005-2016.

The scaler is fitted on the training window only (no look-ahead), and the LSTM is
compared with a seasonal-naive baseline (same month last year) on the last 24 months.
The model then forecasts the next 12 months; the forecast is saved as JSON so the API,
the simulation and the browser demo can use it without TensorFlow installed.

    python -m ml_models.train_traffic_model
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from ml_models import paths
from preprocessing.clean_traffic import clean_traffic, monthly_series

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
logger = logging.getLogger("train_traffic")

LOOK_BACK = 12
TEST_MONTHS = 24
HORIZON = 12


def _metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    error = predicted - actual
    return {
        "mae": round(float(np.abs(error).mean()), 1),
        "rmse": round(float(np.sqrt((error**2).mean())), 1),
        "mape": round(float((np.abs(error) / actual).mean() * 100), 2),
    }


def _windows(series: np.ndarray, look_back: int) -> tuple[np.ndarray, np.ndarray]:
    x = np.stack([series[i : i + look_back] for i in range(len(series) - look_back)])
    y = series[look_back:]
    return x[..., np.newaxis], y


def build_model(look_back: int):
    import tensorflow as tf

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(look_back, 1)),
            tf.keras.layers.LSTM(64, return_sequences=True),
            tf.keras.layers.Dropout(0.1),
            tf.keras.layers.LSTM(32),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.005), loss="mse")
    return model


def train(epochs: int = 300, seed: int = 42) -> dict:
    import tensorflow as tf

    tf.keras.utils.set_random_seed(seed)
    paths.ensure_dirs()
    traffic, _ = clean_traffic(paths.TRAFFIC_CSV)
    monthly = monthly_series(traffic)
    values = monthly["passengers"].to_numpy(dtype=float)
    dates = monthly["Date"]

    split = len(values) - TEST_MONTHS
    low, high = values[:split].min(), values[:split].max()
    scale = lambda v: (v - low) / (high - low)  # noqa: E731
    unscale = lambda v: v * (high - low) + low  # noqa: E731
    scaled = scale(values)

    x_all, y_all = _windows(scaled, LOOK_BACK)
    target_index = np.arange(LOOK_BACK, len(values))
    train_mask = target_index < split
    x_train, y_train = x_all[train_mask], y_all[train_mask]
    x_test = x_all[~train_mask]

    model = build_model(LOOK_BACK)
    early_stop = tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=40, restore_best_weights=True)
    started = time.perf_counter()
    history = model.fit(
        x_train,
        y_train,
        epochs=epochs,
        batch_size=8,
        validation_split=0.15,
        shuffle=True,
        callbacks=[early_stop],
        verbose=0,
    )
    train_seconds = time.perf_counter() - started

    lstm_pred = unscale(model.predict(x_test, verbose=0).ravel())
    actual = values[split:]
    naive_pred = values[split - 12 : len(values) - 12]
    metrics = {"lstm": _metrics(actual, lstm_pred), "seasonal_naive": _metrics(actual, naive_pred)}
    logger.info("Backtest: %s", metrics)

    # Recursive 12-month forecast from the latest observed window.
    window = list(scaled[-LOOK_BACK:])
    forecast_scaled = []
    for _ in range(HORIZON):
        nxt = float(model.predict(np.array(window[-LOOK_BACK:])[np.newaxis, :, np.newaxis], verbose=0)[0, 0])
        forecast_scaled.append(nxt)
        window.append(nxt)
    future_dates = pd.date_range(dates.iloc[-1] + pd.offsets.MonthBegin(1), periods=HORIZON, freq="MS")
    forecast = unscale(np.array(forecast_scaled))

    recent = monthly.tail(36)
    seasonal = recent.groupby("month")["passengers"].mean() / recent["passengers"].mean()

    model.save(paths.TRAFFIC_MODEL)
    payload = {
        "model": "LSTM (64 -> 32 units)",
        "airport": "SFO",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tensorflow_version": tf.__version__,
        "look_back_months": LOOK_BACK,
        "test_months": TEST_MONTHS,
        "epochs_run": len(history.history["loss"]),
        "train_seconds": round(train_seconds, 2),
        "metrics": metrics,
        "history": [{"month": d.strftime("%Y-%m"), "passengers": int(v)} for d, v in zip(dates, values, strict=True)],
        "backtest": [
            {
                "month": d.strftime("%Y-%m"),
                "actual": int(a),
                "lstm": int(p),
                "seasonal_naive": int(n),
            }
            for d, a, p, n in zip(dates.iloc[split:], actual, lstm_pred, naive_pred, strict=True)
        ],
        "forecast": [
            {"month": d.strftime("%Y-%m"), "passengers": int(v)} for d, v in zip(future_dates, forecast, strict=True)
        ],
        "seasonal_index": {str(k): round(float(v), 4) for k, v in seasonal.items()},
    }
    paths.TRAFFIC_FORECAST.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--epochs", type=int, default=300)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    payload = train(args.epochs)
    print(json.dumps(payload["metrics"], indent=2))
    print("Next 12 months:", [row["passengers"] for row in payload["forecast"]])


if __name__ == "__main__":
    main()
