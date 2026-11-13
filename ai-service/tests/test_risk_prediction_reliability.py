from fastapi.testclient import TestClient

from app.agents.predictive_agent import PredictiveAgent
from app.agents.risk_agent import RiskAgent
from app.main import app
from app.schemas.domain import (
    DisasterAnalysisRequest,
    DisasterAnalysisState,
    Environment,
    Incident,
    IncidentType,
    Observation,
    RiskLevel,
    RoadAccessStatus,
)


client = TestClient(app)


def assess(
    incident_type=IncidentType.OTHER,
    victim_count=0,
    water_level=None,
    rainfall=0.0,
    road_access=RoadAccessStatus.OPEN,
    critical_victim_count=0,
    elderly_count=0,
    children_count=0,
    disabled_count=0,
):
    incident = Incident(
        id="risk-test",
        type=incident_type,
        latitude=12.97,
        longitude=77.59,
        victim_count=victim_count,
        critical_victim_count=critical_victim_count,
        elderly_count=elderly_count,
        children_count=children_count,
        disabled_count=disabled_count,
        water_level=Observation(value=water_level) if water_level is not None else None,
        rainfall=Observation(value=rainfall) if rainfall is not None else None,
        road_access=road_access,
    )
    return RiskAgent().analyze(DisasterAnalysisState(
        request=DisasterAnalysisRequest(incident=incident)
    )).risk


def test_flood_risk_explanation_uses_reported_people_water_and_rainfall():
    risk = assess(
        incident_type=IncidentType.FLOOD,
        victim_count=7,
        water_level=2.5,
        rainfall=120.0,
    )

    assert risk.score == 85.0
    explanation = risk.reasons[0].lower()
    assert "people reported needing help: 7" in explanation
    assert "dangerously high water level" in explanation
    assert "extreme rainfall" in explanation


def test_fire_risk_explanation_uses_actual_victim_count():
    risk = assess(incident_type=IncidentType.FIRE, victim_count=4)

    assert risk.score == 40.0
    assert "people reported needing help: 4" in risk.reasons[0]
    assert "fire incident type" in risk.reasons[0]


def test_explicit_zero_and_complete_inputs_can_support_low_classification():
    risk = assess()

    assert risk.score == 0.0
    assert risk.risk_level == RiskLevel.LOW
    assert "reported victim count: 0" in risk.reasons[0]
    assert "rainfall=0mm" in risk.reasons[0]
    assert "road_access=OPEN" in risk.reasons[0]


def test_missing_victim_count_is_not_treated_as_zero_or_low():
    risk = assess(victim_count=None)

    assert risk.score is None
    assert risk.risk_level == RiskLevel.UNDETERMINED
    assert "victim count is unreported" in risk.reasons[0]


def test_blocked_road_is_a_visible_risk_contributor():
    risk = assess(road_access=RoadAccessStatus.BLOCKED)

    assert risk.score == 15.0
    assert "road access is blocked" in risk.reasons[0]


def test_flood_with_missing_environmental_observations_is_undetermined():
    risk = assess(
        incident_type=IncidentType.FLOOD,
        victim_count=0,
        rainfall=None,
        water_level=None,
    )

    assert risk.score is None
    assert risk.risk_level == RiskLevel.UNDETERMINED
    assert "water_level" in risk.reasons[0]
    assert "rainfall" in risk.reasons[0]


def test_prediction_without_observed_trends_is_unavailable_not_stable():
    risk = assess()
    state = DisasterAnalysisState(request=DisasterAnalysisRequest(
        incident=Incident(
            id="prediction-test",
            type=IncidentType.FLOOD,
            latitude=12.97,
            longitude=77.59,
            victim_count=0,
            critical_victim_count=0,
            elderly_count=0,
            children_count=0,
            disabled_count=0,
            rainfall=Observation(value=0.0),
            water_level=Observation(value=0.0),
            road_access=RoadAccessStatus.OPEN,
        )
    ))
    state.risk = risk
    result = PredictiveAgent().analyze(state).prediction

    assert result.prediction_available is False
    assert result.forecast == []
    assert result.escalation_detected is False
    assert any("unavailable" in message.lower() for message in result.explanation)


def test_analysis_endpoint_returns_evidence_and_requires_human_review():
    payload = {
        "incident": {
            "id": "api-flood-7",
            "type": "FLOOD",
            "latitude": 12.97,
            "longitude": 77.59,
            "victim_count": 7,
            "critical_victim_count": 0,
            "elderly_count": 0,
            "children_count": 0,
            "disabled_count": 0,
            "water_level": {"value": 2.5, "source": "TEST_SENSOR"},
            "rainfall": {"value": 120.0, "source": "TEST_SENSOR"},
            "road_access": "OPEN",
        }
    }

    response = client.post("/api/ai/analyze", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["risk"]["score"] == 85.0
    assert body["risk"]["risk_level"] != "LOW"
    assert body["prediction"]["prediction_available"] is False
    assert body["prediction"]["forecast"] == []
    assert body["human_review_required"] is True
    assert body["autonomy_decision"]["human_review_required"] is True


def test_analysis_endpoint_keeps_missing_victims_unknown():
    payload = {
        "incident": {
            "id": "api-missing-victims",
            "type": "OTHER",
            "latitude": 12.97,
            "longitude": 77.59,
            "victim_count": None,
            "critical_victim_count": 0,
            "elderly_count": 0,
            "children_count": 0,
            "disabled_count": 0,
            "rainfall": {"value": 0.0, "source": "TEST_SENSOR"},
            "road_access": "OPEN",
        }
    }

    response = client.post("/api/ai/analyze", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["risk"]["risk_level"] == "UNDETERMINED"
    assert body["risk"]["score"] is None
    assert body["human_review_required"] is True


def test_analysis_endpoint_returns_fire_evidence_without_fake_prediction():
    payload = {
        "incident": {
            "id": "api-fire-4",
            "type": "FIRE",
            "latitude": 12.97,
            "longitude": 77.59,
            "victim_count": 4,
            "critical_victim_count": 0,
            "elderly_count": 0,
            "children_count": 0,
            "disabled_count": 0,
            "rainfall": {"value": 0.0, "source": "TEST_SENSOR"},
            "road_access": "OPEN",
        }
    }

    response = client.post("/api/ai/analyze", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["risk"]["score"] == 40.0
    assert "fire incident type" in body["risk"]["reasons"][0]
    assert body["prediction"]["prediction_available"] is False
    assert "no validated mapping" in " ".join(body["prediction"]["explanation"]).lower()
    assert body["human_review_required"] is True


def test_prediction_baseline_labels_its_method_and_confidence():
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="trend-test",
            type=IncidentType.FLOOD,
            latitude=12.97,
            longitude=77.59,
            victim_count=0,
            critical_victim_count=0,
            elderly_count=0,
            children_count=0,
            disabled_count=0,
            rainfall=Observation(value=0.0),
            water_level=Observation(value=0.0),
            road_access=RoadAccessStatus.OPEN,
        ),
        environment=Environment(
            rainfall_trend_mm_per_hour=0.0,
            water_level_trend_m_per_hour=0.0,
        ),
    )
    state = DisasterAnalysisState(request=request)
    state.risk = assess()
    result = PredictiveAgent().analyze(state).prediction

    assert result.prediction_available is True
    assert result.decision_provenance.method == "deterministic_trend_estimate"
    assert result.confidence == 1.0
    assert any("not a trained" in message.lower() for message in result.explanation)
