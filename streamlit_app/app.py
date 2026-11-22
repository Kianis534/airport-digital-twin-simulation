"""Streamlit control room for the airport digital twin.

    streamlit run streamlit_app/app.py

Runs the same SimPy engine and ML models as the API, without Node.js or a server.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from simulation import SimulationConfig, run_simulation  # noqa: E402
from simulation.config import BOUNDS  # noqa: E402

st.set_page_config(page_title="Airport Digital Twin", page_icon="✈️", layout="wide")

DEFAULTS = SimulationConfig()
MONTHS = ["Average"] + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@st.cache_data(show_spinner=False, max_entries=64)
def simulate(config: dict) -> dict:
    return run_simulation(SimulationConfig.from_dict(config))


def slider(label: str, key: str, default: float, step: float = 1.0, **kwargs):
    low, high = BOUNDS[key]
    cast = int if isinstance(default, int) else float
    return st.slider(label, cast(low), cast(high), cast(default), step=cast(step), key=key, **kwargs)


with st.sidebar:
    st.header("Scenario")
    traffic = slider("Traffic change (%)", "traffic_increase_pct", 0, 5)
    checkin = slider("Check-in counters", "checkin_counters", DEFAULTS.checkin_counters)
    security = slider("Security lanes", "security_lanes", DEFAULTS.security_lanes)
    gates = slider("Boarding gates", "boarding_gates", DEFAULTS.boarding_gates)
    weather = slider("Weather severity", "weather_severity", 0, 10)
    delay = slider("Extra delay per flight (min)", "delay_offset_min", 0, 5)
    tech = st.radio("Security technology", ["standard", "advanced"], horizontal=True)
    month = st.selectbox("Seasonal demand (LSTM forecast)", MONTHS, index=0)
    seed = st.number_input("Random seed", min_value=0, max_value=2**31 - 1, value=42, step=1)
    compare = st.toggle("Compare with baseline", value=True)

scenario = {
    "scenario_name": "What-if",
    "traffic_increase_pct": traffic,
    "checkin_counters": checkin,
    "security_lanes": security,
    "boarding_gates": gates,
    "weather_severity": weather,
    "delay_offset_min": delay,
    "security_tech": tech,
    "forecast_month": None if month == "Average" else MONTHS.index(month),
    "seed": int(seed),
}

st.title("Airport Digital Twin")
st.caption(
    "Discrete-event simulation of one terminal day (SimPy), with an XGBoost satisfaction model "
    "and an LSTM demand forecast. Move a lever in the sidebar and the day is re-simulated."
)

with st.spinner("Simulating the day..."):
    result = simulate(scenario)
    base = simulate({"scenario_name": "Baseline", "seed": int(seed)}) if compare else None

k = result["kpis"]
bk = base["kpis"] if base else None


def delta(key: str, fmt: str = "{:+.1f}", scale: float = 1.0):
    if not bk:
        return None
    value = round((k[key] - bk[key]) * scale, 1) or 0.0  # avoid "-0.0"
    return fmt.format(value)


cols = st.columns(6)
cols[0].metric("Passengers", f"{k['passengers']:,}", delta("passengers", "{:+,.0f}"))
cols[1].metric(
    "Security wait p95", f"{k['p95_security_wait_min']:.1f} min", delta("p95_security_wait_min"), delta_color="inverse"
)
cols[2].metric(
    "Check-in wait p95", f"{k['p95_checkin_wait_min']:.1f} min", delta("p95_checkin_wait_min"), delta_color="inverse"
)
cols[3].metric(
    "Missed flights", f"{k['missed_rate']:.1%}", delta("missed_rate", "{:+.1f} pts", 100), delta_color="inverse"
)
cols[4].metric(
    "On-time departures", f"{k['on_time_departure_rate']:.0%}", delta("on_time_departure_rate", "{:+.0f} pts", 100)
)
cols[5].metric("Predicted satisfaction", f"{k['avg_satisfaction']:.1%}", delta("avg_satisfaction", "{:+.1f} pts", 100))

left, right = st.columns([3, 2])
with left:
    ts = pd.DataFrame(result["time_series"])
    fig = go.Figure()
    fig.add_scatter(x=ts["clock"], y=ts["security_queue"], name="Security queue", line=dict(width=3))
    fig.add_scatter(x=ts["clock"], y=ts["checkin_queue"], name="Check-in queue", line=dict(width=3))
    fig.add_scatter(x=ts["clock"], y=ts["at_gate"], name="Waiting at gates", line=dict(dash="dot"))
    fig.update_layout(
        title="Queues through the day", height=380, margin=dict(l=10, r=10, t=50, b=10), legend=dict(orientation="h")
    )
    st.plotly_chart(fig, width="stretch")

with right:
    st.subheader("Advisor")
    icons = {"critical": "🔴", "warning": "🟠", "info": "🔵", "ok": "🟢"}
    for rec in result["recommendations"]:
        st.markdown(f"{icons[rec['severity']]} **{rec['title']}**  \n{rec['detail']}  \n_{rec['action']}_")

c1, c2 = st.columns(2)
with c1:
    waits = pd.DataFrame(result["wait_distribution"])
    fig = go.Figure()
    fig.add_bar(x=waits["bucket"], y=waits["security"], name="Security")
    fig.add_bar(x=waits["bucket"], y=waits["checkin"], name="Check-in")
    fig.update_layout(
        title="Queue time distribution (minutes)", barmode="group", height=320, margin=dict(l=10, r=10, t=50, b=10)
    )
    st.plotly_chart(fig, width="stretch")
with c2:
    st.subheader("Service levels")
    st.dataframe(pd.DataFrame(result["service_levels"]), hide_index=True, width="stretch")
    engine = result["engine"]
    st.caption(
        f"Engine {engine['version']} · {engine['runtime_ms']:.0f} ms · delay: {engine['delay_model']} · "
        f"satisfaction: {engine['satisfaction_model']} · demand: {engine['demand_model']} (x{engine['demand_multiplier']})"
    )

with st.expander("Flight log"):
    st.dataframe(pd.DataFrame(result["flights"]), hide_index=True, width="stretch")
