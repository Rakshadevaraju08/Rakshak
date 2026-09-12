from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_flood_prediction_valid_input():
    payload = {
        "latitude": 26.14,
        "longitude": 91.73,
        "rainfallCurrent": 52.4,
        "rainfall1h": 75.2,
        "rainfall3h": 120.5,
        "rainfall6h": 165.3,
        "elevation": 48.2
    }
    response = client.post("/api/ai/predict-flood-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "riskLevel" in data
    assert "probability" in data
    assert "predictionHorizonMinutes" in data
    assert "factors" in data
    assert data["predictionHorizonMinutes"] == 30
    assert type(data["factors"]) == list

def test_flood_prediction_missing_input():
    payload = {
        "latitude": 26.14,
        "elevation": 48.2
        # Missing rainfall fields
    }
    response = client.post("/api/ai/predict-flood-risk", json=payload)
    assert response.status_code == 422 # Validation Error

def test_flood_prediction_invalid_input():
    payload = {
        "latitude": "invalid_string",
        "longitude": 91.73,
        "rainfallCurrent": 52.4,
        "rainfall1h": 75.2,
        "rainfall3h": 120.5,
        "rainfall6h": 165.3,
        "elevation": 48.2
    }
    response = client.post("/api/ai/predict-flood-risk", json=payload)
    assert response.status_code == 422

def test_flood_prediction_low_risk_edge_case():
    payload = {
        "latitude": 26.14,
        "longitude": 91.73,
        "rainfallCurrent": 0.0,
        "rainfall1h": 0.0,
        "rainfall3h": 0.0,
        "rainfall6h": 0.0,
        "elevation": 200.0 # High elevation, no rain
    }
    response = client.post("/api/ai/predict-flood-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["riskLevel"] == "LOW"
