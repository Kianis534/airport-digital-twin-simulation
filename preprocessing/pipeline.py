"""Run every cleaning step and write model-ready datasets to ``outputs/``.

    python -m preprocessing.pipeline               # survey + traffic (+ flights if present)
    python -m preprocessing.pipeline --flights-sample 1000000

Writes:
    outputs/survey_train.csv, outputs/survey_test.csv
    outputs/traffic_monthly.csv
    outputs/flights_model_data.csv   (only when datasets/raw/flights.csv exists)
    outputs/data_quality_report.json
"""

from __future__ import annotations

import argparse
import json
import logging

from ml_models import paths
from preprocessing.clean_flights import clean_flights
from preprocessing.clean_survey import clean_survey
from preprocessing.clean_traffic import clean_traffic, monthly_series
from preprocessing.feature_engineering import add_flight_context

logger = logging.getLogger("pipeline")


def run(flights_sample: int | None = 1_000_000) -> dict:
    paths.ensure_dirs()
    reports = []

    for source, target in (
        (paths.SATISFACTION_TRAIN_CSV, "survey_train.csv"),
        (paths.SATISFACTION_TEST_CSV, "survey_test.csv"),
    ):
        df, report = clean_survey(source, name=target.removesuffix(".csv"))
        df.to_csv(paths.OUTPUTS_DIR / target, index=False)
        reports.append(report.to_dict())
        logger.info("%s: %d rows", target, len(df))

    traffic, report = clean_traffic(paths.TRAFFIC_CSV)
    monthly = monthly_series(traffic)
    monthly.to_csv(paths.OUTPUTS_DIR / "traffic_monthly.csv", index=False)
    reports.append(report.to_dict() | {"monthly_points": len(monthly)})
    logger.info("traffic_monthly.csv: %d months", len(monthly))

    if paths.FLIGHTS_CSV.exists():
        flights, report = clean_flights(paths.FLIGHTS_CSV, sample_rows=flights_sample)
        flights = add_flight_context(flights)
        flights.to_csv(paths.OUTPUTS_DIR / "flights_model_data.csv", index=False)
        reports.append(report.to_dict())
        logger.info("flights_model_data.csv: %d rows", len(flights))
    else:
        logger.warning("Skipping flights: %s not found (see datasets/README.md)", paths.FLIGHTS_CSV)

    summary = {"steps": reports}
    (paths.OUTPUTS_DIR / "data_quality_report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean the raw datasets.")
    parser.add_argument("--flights-sample", type=int, default=1_000_000, help="0 = use every row")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    summary = run(args.flights_sample or None)
    for step in summary["steps"]:
        print(f"{step['dataset']:<14} {step['rows_in']:>9,} -> {step['rows_out']:>9,} rows  {step['actions']}")


if __name__ == "__main__":
    main()
