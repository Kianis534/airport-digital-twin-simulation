from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from backend_fastapi.main import create_app


@pytest.fixture(scope="module")
def client():
    with TestClient(create_app()) as c:
        yield c


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["models"]["satisfaction"]["source"] == "xgboost"


def test_run_default_scenario(client):
    response = client.post("/api/v1/simulations")
    assert response.status_code == 200
    body = response.json()
    assert body["kpis"]["passengers"] > 0
    assert body["engine"]["satisfaction_model"] == "xgboost"


def test_run_custom_scenario(client):
    body = client.post("/api/v1/simulations", json={"security_lanes": 3, "seed": 1}).json()
    assert body["scenario"]["security_lanes"] == 3
    assert body["kpis"]["p95_security_wait_min"] > 15


@pytest.mark.parametrize(
    "payload",
    [{"security_lanes": 0}, {"weather_severity": 500}, {"security_tech": "laser"}, {"unknown_field": 1}],
)
def test_invalid_scenarios_are_rejected(client, payload):
    assert client.post("/api/v1/simulations", json=payload).status_code == 422


def test_compare_uses_common_random_numbers(client):
    body = client.post("/api/v1/simulations/compare", json={"scenario": {"security_lanes": 4}}).json()
    assert body["delta"]["passengers"] == 0  # same seed, same demand
    assert body["delta"]["p95_security_wait_min"] > 0


def test_background_job_lifecycle(client):
    job = client.post("/api/v1/simulations/jobs", json={"duration_minutes": 120}).json()
    assert job["status"] in {"queued", "running"}
    deadline = time.time() + 30
    while time.time() < deadline:
        state = client.get(f"/api/v1/simulations/jobs/{job['job_id']}").json()
        if state["status"] == "completed":
            break
        time.sleep(0.1)
    assert state["status"] == "completed"
    assert state["result"]["kpis"]["flights"] > 0


def test_unknown_job_is_404(client):
    assert client.get("/api/v1/simulations/jobs/does-not-exist").status_code == 404


def test_satisfaction_prediction(client):
    payload = {
        "gender": "Female",
        "customer_type": "Loyal Customer",
        "age": 41,
        "type_of_travel": "Business travel",
        "travel_class": "Business",
        "flight_distance": 1450,
        "ratings": {"online_boarding": 5, "inflight_wifi_service": 5},
    }
    happy = client.post("/api/v1/predict/satisfaction", json=payload).json()
    unhappy_payload = payload | {
        "type_of_travel": "Personal Travel",
        "travel_class": "Eco",
        "ratings": {"online_boarding": 1, "inflight_wifi_service": 1},
    }
    unhappy = client.post("/api/v1/predict/satisfaction", json=unhappy_payload).json()
    assert happy["probability_satisfied"] > unhappy["probability_satisfied"]
    assert happy["model"] == "xgboost"


def test_delay_prediction_without_model_is_503(client):
    payload = {"month": 7, "day_of_week": 3, "dep_hour": 8, "airline": "UA", "distance": 800}
    response = client.post("/api/v1/predict/delay", json=payload)
    assert response.status_code in (200, 503)
    if response.status_code == 503:
        assert "not trained" in response.json()["detail"]


def test_traffic_forecast_and_models(client):
    forecast = client.get("/api/v1/forecast/traffic").json()
    assert len(forecast["forecast"]) == 12
    models = client.get("/api/v1/models").json()
    assert set(models) == {"delay", "satisfaction", "demand"}


def test_openapi_documents_endpoints(client):
    spec = client.get("/openapi.json").json()
    assert "/api/v1/simulations" in spec["paths"]
    assert "/api/v1/predict/satisfaction" in spec["paths"]
