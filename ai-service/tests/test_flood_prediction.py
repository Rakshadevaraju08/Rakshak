from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def valid_payload():
    return {
        "latitude": 26.14,
        "longitude": 91.73,
        "rainfallCurrent": 52.4,
        "rainfall1h": 75.2,
        "rainfall3h": 120.5,
        "rainfall6h": 165.3,
        "rainfall24h": 210.0,
        "rainfallTrend": 3.2,
        "elevation": 48.2,
    }


def test_flood_prediction_does_not_use_demo_model():
    response = client.post("/api/ai/predict-flood-risk", json=valid_payload())
    assert response.status_code == 503
    assert "non-demo" in response.json()["detail"].lower() or "unavailable" in response.json()["detail"].lower()


def test_flood_prediction_requires_measured_24h_and_trend_inputs():
    payload = valid_payload()
    payload.pop("rainfall24h")
    payload.pop("rainfallTrend")
    response = client.post("/api/ai/predict-flood-risk", json=payload)

    assert response.status_code == 422
    assert "rainfall24h" in response.json()["detail"]
    assert "rainfallTrend" in response.json()["detail"]


def test_flood_prediction_rejects_invalid_input():
    payload = valid_payload()
    payload["latitude"] = "invalid_string"
    response = client.post("/api/ai/predict-flood-risk", json=payload)

    assert response.status_code == 422


def test_flood_prediction_does_not_return_a_fabricated_low_risk():
    payload = valid_payload()
    payload.update({
        "rainfallCurrent": 0.0,
        "rainfall1h": 0.0,
        "rainfall3h": 0.0,
        "rainfall6h": 0.0,
        "rainfall24h": 0.0,
        "rainfallTrend": 0.0,
        "elevation": 200.0,
    })
    response = client.post("/api/ai/predict-flood-risk", json=payload)

    assert response.status_code == 503
    assert "riskLevel" not in response.json()
