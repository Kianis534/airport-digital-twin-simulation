"""Exploratory analysis and model figures used in the README.

    python notebooks/eda_report.py

Writes PNGs to docs/images/. Needs matplotlib (installed via requirements-dev.txt).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from ml_models import paths  # noqa: E402
from simulation import SimulationConfig, run_simulation  # noqa: E402

OUT = ROOT / "docs" / "images"
INK, MUTED, ACCENT, ACCENT_2, WARN = "#0f172a", "#64748b", "#7c3aed", "#0ea5e9", "#f97316"

plt.rcParams.update(
    {
        "figure.dpi": 140,
        "font.size": 10,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.edgecolor": "#cbd5e1",
        "axes.labelcolor": INK,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "axes.titleweight": "bold",
        "axes.titlesize": 12,
        "axes.grid": True,
        "grid.color": "#eef2f7",
    }
)


def save(fig, name: str) -> None:
    fig.tight_layout()
    fig.savefig(OUT / name, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("wrote", OUT / name)


def satisfaction_drivers() -> None:
    meta = json.loads(paths.SATISFACTION_META.read_text(encoding="utf-8"))
    rows = pd.DataFrame(meta["feature_importance"]).iloc[::-1]
    fig, ax = plt.subplots(figsize=(7, 4.2))
    ax.barh(rows["feature"].str.replace("_", " "), rows["importance"], color=ACCENT)
    m = meta["metrics"]
    ax.set_title(f"What drives passenger satisfaction (XGBoost, accuracy {m['accuracy']:.1%}, AUC {m['roc_auc']:.3f})")
    ax.set_xlabel("Gain-based feature importance")
    ax.grid(axis="y", visible=False)
    save(fig, "satisfaction_drivers.png")


def traffic_forecast() -> None:
    data = json.loads(paths.TRAFFIC_FORECAST.read_text(encoding="utf-8"))
    hist = pd.DataFrame(data["history"])
    back = pd.DataFrame(data["backtest"])
    fc = pd.DataFrame(data["forecast"])
    for df in (hist, back, fc):
        df["month"] = pd.to_datetime(df["month"])
    fig, ax = plt.subplots(figsize=(8, 3.8))
    ax.plot(hist["month"], hist["passengers"] / 1e6, color=INK, lw=1.6, label="Actual (SFO)")
    ax.plot(back["month"], back["lstm"] / 1e6, color=ACCENT, lw=2, label="LSTM backtest")
    ax.plot(back["month"], back["seasonal_naive"] / 1e6, color=MUTED, lw=1.2, ls=":", label="Seasonal naive")
    ax.plot(fc["month"], fc["passengers"] / 1e6, color=WARN, lw=2.2, ls="--", label="12-month forecast")
    m = data["metrics"]
    ax.set_title(f"Monthly passengers: LSTM MAPE {m['lstm']['mape']}% vs seasonal naive {m['seasonal_naive']['mape']}%")
    ax.set_ylabel("Passengers (millions)")
    ax.legend(frameon=False, ncol=4, loc="upper left", fontsize=8)
    save(fig, "traffic_forecast.png")


def delay_distribution() -> None:
    delays = pd.read_csv(paths.SATISFACTION_TRAIN_CSV, usecols=["Departure Delay in Minutes"])[
        "Departure Delay in Minutes"
    ]
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.hist(delays.clip(upper=180), bins=60, color=ACCENT_2)
    ax.set_yscale("log")
    ax.set_title(f"Departure delays: {(delays <= 15).mean():.0%} within 15 min, long tail beyond")
    ax.set_xlabel("Minutes (clipped at 180)")
    ax.set_ylabel("Flights (log scale)")
    save(fig, "delay_distribution.png")


def security_sensitivity() -> None:
    lanes = list(range(3, 10))
    rows = []
    for n in lanes:
        k = run_simulation(SimulationConfig(security_lanes=n, seed=11))["kpis"]
        rows.append(
            {
                "lanes": n,
                "p95": k["p95_security_wait_min"],
                "missed": k["missed_rate"] * 100,
                "sat": k["avg_satisfaction"] * 100,
            }
        )
    df = pd.DataFrame(rows)
    fig, (left, right) = plt.subplots(1, 2, figsize=(9, 3.6))
    colors = [WARN if v > 15 else ACCENT for v in df["p95"]]
    left.bar(df["lanes"], df["p95"], color=colors)
    left.axhline(15, color=MUTED, ls=":", lw=1.2)
    left.text(df["lanes"].iloc[-1] + 0.4, 17, "15-min SLA", color=MUTED, ha="right", fontsize=8)
    left.set_title("Security wait, 95th percentile")
    left.set_xlabel("Open security lanes")
    left.set_ylabel("Minutes")
    left.grid(axis="x", visible=False)
    right.plot(df["lanes"], df["missed"], marker="o", color=WARN, lw=2, label="Missed flights (%)")
    right.plot(df["lanes"], df["sat"], marker="o", color=ACCENT_2, lw=2, label="Predicted satisfaction (%)")
    right.set_title("Passenger outcomes")
    right.set_xlabel("Open security lanes")
    right.set_ylim(0, 60)
    right.legend(frameon=False, fontsize=8)
    fig.suptitle(
        "What-if: how many security lanes does the day need? (same seed, only lanes change)",
        fontsize=11,
        fontweight="bold",
    )
    save(fig, "security_sensitivity.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    satisfaction_drivers()
    traffic_forecast()
    delay_distribution()
    security_sensitivity()
