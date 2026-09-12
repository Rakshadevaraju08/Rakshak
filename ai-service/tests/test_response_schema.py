"""
tests/test_response_schema.py

API-level tests verifying that POST /api/ai/analyze returns a
well-structured, fully-typed FullResponsePlan with all required
frontend-consumable fields present, correctly typed, and safe
(no stack traces, no internal paths).

Covers:
  - Successful response: field presence & types
  - Degraded response (OSRM down): fallback flags, warnings, degraded=True
  - Security: no stack traces in 4xx/5xx
  - Schema completeness checklist
"""

import pytest
from unittest.mock import patch, Mock
import requests as req_lib
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Resource,
    ResourceType,
    ResourceStatus,
    Hospital,
    Observation,
    RoadAccessStatus,
    RecommendedAction,
    SafetyStatus,
    AutonomyMode,
)

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _osrm_ok():
    m = Mock()
    m.json.return_value = {
        "code": "Ok",
        "routes": [{"distance": 3000.0, "duration": 360.0}],
    }
    m.raise_for_status = Mock()
    return m


def _base_payload(*, victim_count: int = 5, water_level: float = 1.5) -> dict:
    state = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_SCHEMA_TEST",
            type=IncidentType.FLOOD,
            latitude=12.97,
            longitude=77.59,
            victim_count=victim_count,
            water_level=Observation(value=water_level),
            rainfall=Observation(value=30.0),
            road_access=RoadAccessStatus.OPEN,
        ),
        resources=[
            Resource(
                id="AMB_01",
                type=ResourceType.AMBULANCE,
                status=ResourceStatus.AVAILABLE,
                latitude=12.98,
                longitude=77.60,
            ),
        ],
        hospitals=[
            Hospital(
                id="HOSP_01",
                name="District Hospital",
                latitude=12.99,
                longitude=77.61,
                total_beds=80,
                available_beds=20,
            )
        ],
    )
    return state.model_dump(mode="json")


# ---------------------------------------------------------------------------
# 1. Successful response — field presence & types
# ---------------------------------------------------------------------------

class TestSuccessfulResponse:

    REQUIRED_TOP_LEVEL_FIELDS = [
        "incident_id",
        "situation",
        "risk",
        "prediction",
        "assignments",
        "recommended_action",
        "explanation",
        "warnings",
        "data_quality",
        "safety_check",
        "autonomy_decision",
        "overall_confidence",
        "trace_id",
        "human_review_required",
        "fallback_used",
        "provenance",
        "degraded",
        "trace",
    ]

    @patch("app.services.routing_service.requests.get")
    def test_returns_200(self, mock_get):
        mock_get.return_value = _osrm_ok()
        resp = client.post("/api/ai/analyze", json=_base_payload())
        assert resp.status_code == 200

    @patch("app.services.routing_service.requests.get")
    def test_all_required_fields_present(self, mock_get):
        mock_get.return_value = _osrm_ok()
        resp = client.post("/api/ai/analyze", json=_base_payload())
        body = resp.json()
        for field in self.REQUIRED_TOP_LEVEL_FIELDS:
            assert field in body, f"Missing top-level field: '{field}'"

    @patch("app.services.routing_service.requests.get")
    def test_incident_id_matches_request(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["incident_id"] == "INC_SCHEMA_TEST"

    @patch("app.services.routing_service.requests.get")
    def test_overall_confidence_is_float_in_range(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        conf = body["overall_confidence"]
        assert isinstance(conf, (int, float)), "overall_confidence must be numeric"
        assert 0.0 <= conf <= 1.0, f"overall_confidence out of range: {conf}"

    @patch("app.services.routing_service.requests.get")
    def test_trace_id_is_string(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert isinstance(body["trace_id"], str), "trace_id should be a non-null string"
        assert len(body["trace_id"]) > 0

    @patch("app.services.routing_service.requests.get")
    def test_human_review_required_is_bool(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert isinstance(body["human_review_required"], bool)

    @patch("app.services.routing_service.requests.get")
    def test_fallback_used_is_bool(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert isinstance(body["fallback_used"], bool)

    @patch("app.services.routing_service.requests.get")
    def test_provenance_is_list(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert isinstance(body["provenance"], list)

    @patch("app.services.routing_service.requests.get")
    def test_recommended_action_valid_enum(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        valid_actions = {a.value for a in RecommendedAction}
        assert body["recommended_action"] in valid_actions

    @patch("app.services.routing_service.requests.get")
    def test_situation_has_severity(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["situation"] is not None
        assert "severity_assessment" in body["situation"]

    @patch("app.services.routing_service.requests.get")
    def test_risk_has_priority_and_level(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["risk"] is not None
        assert "priority" in body["risk"]
        assert "risk_level" in body["risk"]

    @patch("app.services.routing_service.requests.get")
    def test_prediction_has_escalation_field(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["prediction"] is not None
        assert "escalation_detected" in body["prediction"]

    @patch("app.services.routing_service.requests.get")
    def test_assignments_have_resource_and_route(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        for assignment in body["assignments"]:
            assert "resource_id" in assignment
            assert "route" in assignment
            assert "estimated_arrival_time_mins" in assignment
            route = assignment["route"]
            assert "estimated_time_mins" in route
            assert "route_status" in route

    @patch("app.services.routing_service.requests.get")
    def test_safety_check_has_status(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["safety_check"] is not None
        valid_statuses = {s.value for s in SafetyStatus}
        assert body["safety_check"]["status"] in valid_statuses

    @patch("app.services.routing_service.requests.get")
    def test_autonomy_decision_has_mode(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["autonomy_decision"] is not None
        valid_modes = {m.value for m in AutonomyMode}
        assert body["autonomy_decision"]["mode"] in valid_modes

    @patch("app.services.routing_service.requests.get")
    def test_autonomy_and_plan_human_review_agree(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["human_review_required"] == body["autonomy_decision"]["human_review_required"]

    @patch("app.services.routing_service.requests.get")
    def test_data_quality_has_confidence(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["data_quality"] is not None
        assert "confidence" in body["data_quality"]

    @patch("app.services.routing_service.requests.get")
    def test_explanation_is_nonempty_list(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert isinstance(body["explanation"], list)
        assert len(body["explanation"]) > 0

    @patch("app.services.routing_service.requests.get")
    def test_trace_contains_steps(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["trace"] is not None
        assert "trace_id" in body["trace"]
        assert "steps" in body["trace"]
        assert len(body["trace"]["steps"]) > 0

    @patch("app.services.routing_service.requests.get")
    def test_trace_id_matches_trace_object(self, mock_get):
        mock_get.return_value = _osrm_ok()
        body = client.post("/api/ai/analyze", json=_base_payload()).json()
        assert body["trace_id"] == body["trace"]["trace_id"]


# ---------------------------------------------------------------------------
# 2. Degraded response (OSRM down) — fallback flags & warnings
# ---------------------------------------------------------------------------

class TestDegradedResponse:

    def _degraded_payload(self):
        """Payload with a RESCUE_BOAT so OSRM routing is attempted and its failure is captured."""
        from app.schemas.domain import DisasterAnalysisRequest, Incident, IncidentType, Resource, ResourceType, ResourceStatus, Hospital, Observation, RoadAccessStatus
        state = DisasterAnalysisRequest(
            incident=Incident(
                id="INC_DEGRADED",
                type=IncidentType.FLOOD,
                latitude=12.97,
                longitude=77.59,
                victim_count=3,
                water_level=Observation(value=1.5),
                rainfall=Observation(value=30.0),
                road_access=RoadAccessStatus.OPEN,
            ),
            resources=[
                Resource(
                    id="BOAT_01",
                    type=ResourceType.RESCUE_BOAT,
                    status=ResourceStatus.AVAILABLE,
                    latitude=12.98,
                    longitude=77.60,
                ),
            ],
            hospitals=[
                Hospital(
                    id="HOSP_01",
                    name="District Hospital",
                    latitude=12.99,
                    longitude=77.61,
                    total_beds=80,
                    available_beds=20,
                )
            ],
        )
        return state.model_dump(mode="json")

    @patch("app.services.routing_service.requests.get")
    def test_osrm_down_returns_200(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM unreachable")
        resp = client.post("/api/ai/analyze", json=self._degraded_payload())
        assert resp.status_code == 200

    @patch("app.services.routing_service.requests.get")
    def test_degraded_flag_set(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM unreachable")
        body = client.post("/api/ai/analyze", json=self._degraded_payload()).json()
        assert body["degraded"] is True

    @patch("app.services.routing_service.requests.get")
    def test_warnings_non_empty_when_degraded(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM unreachable")
        body = client.post("/api/ai/analyze", json=self._degraded_payload()).json()
        assert len(body["warnings"]) > 0

    @patch("app.services.routing_service.requests.get")
    def test_warnings_have_code_and_message(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM unreachable")
        body = client.post("/api/ai/analyze", json=self._degraded_payload()).json()
        for w in body["warnings"]:
            assert "code" in w, "Warning missing 'code'"
            assert "message" in w, "Warning missing 'message'"
            assert "source" in w, "Warning missing 'source'"

    @patch("app.services.routing_service.requests.get")
    def test_degraded_overall_confidence_still_present(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM unreachable")
        body = client.post("/api/ai/analyze", json=self._degraded_payload()).json()
        conf = body["overall_confidence"]
        assert isinstance(conf, (int, float))
        assert 0.0 <= conf <= 1.0

    @patch("app.services.routing_service.requests.get")
    def test_degraded_trace_id_still_present(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM unreachable")
        body = client.post("/api/ai/analyze", json=self._degraded_payload()).json()
        assert isinstance(body["trace_id"], str) and len(body["trace_id"]) > 0

    @patch("app.services.routing_service.requests.get")
    def test_route_status_unavailable_when_osrm_down(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM unreachable")
        body = client.post("/api/ai/analyze", json=self._degraded_payload()).json()
        for assignment in body["assignments"]:
            assert assignment["route"]["route_status"] == "ROUTE_UNAVAILABLE"


# ---------------------------------------------------------------------------
# 3. Security — no internal stack traces in error responses
# ---------------------------------------------------------------------------

class TestSecurityNoLeakage:

    def test_invalid_body_no_traceback(self):
        resp = client.post("/api/ai/analyze", json={"invalid": "payload"})
        assert resp.status_code in (400, 422)
        text = resp.text
        assert "Traceback" not in text
        assert "File \"" not in text
        assert "site-packages" not in text

    def test_empty_body_no_traceback(self):
        resp = client.post("/api/ai/analyze", json={})
        assert resp.status_code in (400, 422)
        text = resp.text
        assert "Traceback" not in text

    def test_422_response_has_structured_error(self):
        resp = client.post("/api/ai/analyze", json={})
        assert resp.status_code == 422
        body = resp.json()
        # Should have a structured error, not a raw exception
        assert "error" in body or "detail" in body

    def test_successful_response_has_no_internal_paths(self):
        """Ensure the plan body contains no Python file paths."""
        with patch("app.services.routing_service.requests.get") as mock_get:
            mock_get.return_value = _osrm_ok()
            body = client.post("/api/ai/analyze", json=_base_payload()).json()
            body_text = str(body)
            assert "site-packages" not in body_text
            assert "C:\\Users" not in body_text
            assert "Traceback" not in body_text
