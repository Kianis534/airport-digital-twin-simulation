from __future__ import annotations

import pytest

from simulation import ConfigError, SimulationConfig, run_simulation
from simulation.engine.advisor import peak_hourly_rate, required_servers


class TestConfig:
    def test_defaults_are_valid(self):
        config = SimulationConfig()
        assert config.security_lanes == 6
        assert config.security_service_factor == 1.0

    @pytest.mark.parametrize(
        "field,value",
        [("security_lanes", 0), ("checkin_counters", 99), ("weather_severity", 101), ("traffic_increase_pct", -80)],
    )
    def test_out_of_range_values_are_rejected(self, field, value):
        with pytest.raises(ConfigError):
            SimulationConfig(**{field: value})

    def test_bad_enum_and_month(self):
        with pytest.raises(ConfigError):
            SimulationConfig(security_tech="laser")
        with pytest.raises(ConfigError):
            SimulationConfig(forecast_month=13)

    def test_from_dict_ignores_unknown_keys_and_keeps_null_seed(self):
        config = SimulationConfig.from_dict({"security_lanes": 4, "unknown": 1, "seed": None})
        assert config.security_lanes == 4
        assert config.seed is None


class TestEngine:
    def test_result_shape(self, baseline_result):
        assert set(baseline_result) >= {
            "kpis",
            "time_series",
            "wait_distribution",
            "flights",
            "recommendations",
            "service_levels",
            "engine",
            "scenario",
        }
        k = baseline_result["kpis"]
        assert k["flights"] > 10
        assert k["passengers"] == k["boarded"] + k["missed_passengers"]
        assert 0 <= k["avg_satisfaction"] <= 1
        assert 0 <= k["security_utilization"] <= 1
        assert len(baseline_result["flights"]) == k["flights"]

    def test_wait_distribution_counts_every_passenger(self, baseline_result):
        total = sum(row["security"] for row in baseline_result["wait_distribution"])
        assert total == baseline_result["kpis"]["passengers"]

    def test_time_series_is_ordered(self, baseline_result):
        times = [row["t"] for row in baseline_result["time_series"]]
        assert times == sorted(times)
        assert baseline_result["time_series"][-1]["boarded"] <= baseline_result["kpis"]["boarded"]

    def test_same_seed_is_reproducible(self):
        a = run_simulation(SimulationConfig(seed=7))
        b = run_simulation(SimulationConfig(seed=7))
        assert a["kpis"] == b["kpis"]

    def test_fewer_security_lanes_means_longer_waits(self):
        relaxed = run_simulation(SimulationConfig(security_lanes=8, seed=5))["kpis"]
        tight = run_simulation(SimulationConfig(security_lanes=3, seed=5))["kpis"]
        assert tight["p95_security_wait_min"] > relaxed["p95_security_wait_min"] + 10
        assert tight["missed_rate"] >= relaxed["missed_rate"]
        assert tight["avg_satisfaction"] < relaxed["avg_satisfaction"]

    def test_more_traffic_means_more_passengers(self):
        base = run_simulation(SimulationConfig(seed=9))["kpis"]
        busy = run_simulation(SimulationConfig(seed=9, traffic_increase_pct=50))["kpis"]
        assert busy["passengers"] > base["passengers"] * 1.25

    def test_weather_and_offsets_raise_delays(self):
        base = run_simulation(SimulationConfig(seed=4))["kpis"]
        storm = run_simulation(SimulationConfig(seed=4, weather_severity=90, delay_offset_min=20))["kpis"]
        assert storm["avg_departure_delay_min"] > base["avg_departure_delay_min"] + 20
        assert storm["on_time_departure_rate"] < base["on_time_departure_rate"]

    def test_gate_shortage_creates_conflicts(self):
        result = run_simulation(SimulationConfig(seed=2, boarding_gates=2))
        assert result["kpis"]["gate_conflicts"] > 0
        assert any(r["area"] == "gates" for r in result["recommendations"])

    def test_advanced_security_is_faster(self):
        standard = run_simulation(SimulationConfig(seed=3, security_lanes=4))["kpis"]
        advanced = run_simulation(SimulationConfig(seed=3, security_lanes=4, security_tech="advanced"))["kpis"]
        assert advanced["avg_security_wait_min"] < standard["avg_security_wait_min"]

    def test_seasonal_demand_changes_load(self):
        july = run_simulation(SimulationConfig(seed=1, forecast_month=7))
        january = run_simulation(SimulationConfig(seed=1, forecast_month=1))
        assert july["engine"]["demand_multiplier"] > january["engine"]["demand_multiplier"]
        assert july["kpis"]["passengers"] > january["kpis"]["passengers"]

    def test_accepts_plain_dict(self):
        result = run_simulation({"security_lanes": 5, "seed": 1, "duration_minutes": 120})
        assert result["scenario"]["security_lanes"] == 5


class TestAdvisor:
    def test_peak_hourly_rate(self):
        assert peak_hourly_rate([]) == 0
        # 120 arrivals in the first hour, 10 in the next: peak is 2 per minute.
        times = [i * 0.5 for i in range(120)] + [60 + i * 6 for i in range(10)]
        assert peak_hourly_rate(times) == pytest.approx(2.0)

    def test_required_servers_uses_target_utilisation(self):
        # 2 pax/min * 0.5 min = 1 server busy; at 85% target that needs 2 servers.
        assert required_servers(2.0, 0.5) == 2
        assert required_servers(0.0, 1.0) == 1

    def test_stressed_security_triggers_advice(self):
        result = run_simulation(SimulationConfig(security_lanes=3, seed=8))
        top = result["recommendations"][0]
        assert top["severity"] == "critical"
        assert any(r["area"] == "security" for r in result["recommendations"])
