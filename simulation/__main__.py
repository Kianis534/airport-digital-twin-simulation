"""Command-line runner: ``python -m simulation --security-lanes 3 --traffic 30``."""

from __future__ import annotations

import argparse
import json
import logging
import sys

from simulation.config import ConfigError, SimulationConfig
from simulation.engine import run_simulation


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one airport digital twin scenario.")
    parser.add_argument("--name", default="CLI scenario", help="Scenario label")
    parser.add_argument("--checkin-counters", type=int, default=12)
    parser.add_argument("--security-lanes", type=int, default=6)
    parser.add_argument("--gates", type=int, default=8)
    parser.add_argument("--traffic", type=float, default=0.0, help="Traffic change in percent")
    parser.add_argument("--delay", type=float, default=0.0, help="Extra delay added to every flight (min)")
    parser.add_argument("--weather", type=float, default=0.0, help="Weather severity 0-100")
    parser.add_argument("--advanced-security", action="store_true", help="Use CT scanners")
    parser.add_argument("--hours", type=float, default=8, help="Length of the departure window")
    parser.add_argument("--month", type=int, default=None, help="Apply the LSTM seasonal demand for a month")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--json", action="store_true", help="Print the full result as JSON")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=logging.WARNING)
    try:
        config = SimulationConfig(
            scenario_name=args.name,
            checkin_counters=args.checkin_counters,
            security_lanes=args.security_lanes,
            boarding_gates=args.gates,
            traffic_increase_pct=args.traffic,
            delay_offset_min=args.delay,
            weather_severity=args.weather,
            security_tech="advanced" if args.advanced_security else "standard",
            duration_minutes=int(args.hours * 60),
            forecast_month=args.month,
            seed=args.seed,
        )
    except ConfigError as exc:
        print(f"Invalid scenario: {exc}", file=sys.stderr)
        return 2

    result = run_simulation(config)
    if args.json:
        print(json.dumps(result, indent=2))
        return 0

    k = result["kpis"]
    engine = result["engine"]
    print(f"\n{config.scenario_name}  (seed {engine['seed']}, {engine['runtime_ms']:.0f} ms)")
    print("-" * 60)
    print(f"Flights / passengers      {k['flights']} / {k['passengers']}")
    print(f"Security wait avg / p95   {k['avg_security_wait_min']:.1f} / {k['p95_security_wait_min']:.1f} min")
    print(f"Check-in wait avg / p95   {k['avg_checkin_wait_min']:.1f} / {k['p95_checkin_wait_min']:.1f} min")
    print(f"Missed flights            {k['missed_passengers']} passengers ({k['missed_rate']:.2%})")
    print(
        f"On-time departures        {k['on_time_departure_rate']:.0%} (avg delay {k['avg_departure_delay_min']:.1f} min)"
    )
    print(f"Predicted satisfaction    {k['avg_satisfaction']:.1%}")
    print(
        f"Utilisation chk/sec/gate  {k['checkin_utilization']:.0%} / {k['security_utilization']:.0%} / {k['gate_utilization']:.0%}"
    )
    print(
        f"Models                    delay={engine['delay_model']}, satisfaction={engine['satisfaction_model']}, demand={engine['demand_model']}"
    )
    print("\nAdvisor")
    for rec in result["recommendations"]:
        print(f"  [{rec['severity'].upper():8}] {rec['title']}: {rec['action']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
