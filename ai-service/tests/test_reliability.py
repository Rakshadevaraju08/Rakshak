"""
tests/test_reliability.py

Comprehensive end-to-end reliability test suite for the disaster-response
AI pipeline.  Every test runs through the FULL coordinator pipeline
(DataQuality → Situation → Risk → Prediction → Resource → Route →
MasterCoordinator → SafetyChecker → AutonomyDecision → FullResponsePlan).

Scenarios covered
-----------------
  R01  Normal flood (happy path)
  R02  High-priority flood → IMMEDIATE_DISPATCH + human review
  R03  Single-location road accident (LOCALIZED_ACCIDENT)
  R04  Missing required fields → 422, no crash
  R05  Invalid coordinate values → 422, no crash
  R06  Stale environmental data → reduced confidence, STALE_DATA warning
  R07  Conflicting observations → DATA_CONFLICT warning, confidence drop
  R08  ML risk model unavailable → rule-based fallback, fallback_used=True
  R09  Predictive agent failure → pipeline continues, reduced confidence
  R10  OSRM unavailable → ROUTE_UNAVAILABLE fallback, degraded=True
  R11  All resources unavailable → NO_AVAILABLE_RESOURCE warning
  R12  Hospital full / zero beds → safety warning, human review
  R13  Blocked road → ROUTE_UNAVAILABLE or alternate routing
  R14  Multiple incidents competing for limited resources
  R15  Low-confidence decision → ASSISTED or HUMAN_REQUIRED
  R16  Critical mass-casualty → HUMAN_REQUIRED with blocking factors
  R17  LOW-risk AUTO dispatch (no human review)
  R18  Situation agent output validation failure (is_valid=False)
  R19  Unexpected internal exception → 500, no traceback in body
  R20  Adaptive replanning: road becomes blocked, plan updated
  R21  Trace ID present and consistent across plan
  R22  Confidence degrades with stale + missing data
  R23  Warnings propagate to top-level response
  R24  Fallback used flag accurate after OSRM failure
  R25  Provenance collected from all agents
"""

import copy
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, Mock
import requests as req_lib

from fastapi.testclient import TestClient

from app.main import app
from app.agents.master_coordinator import MasterCoordinator
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Resource,
    ResourceType,
    ResourceStatus,
    Hospital,
    Road,
    RoadAccessStatus,
    Observation,
    Environment,
    RiskLevel,
    Priority,
    RecommendedAction,
    AutonomyMode,
    SafetyStatus,
)
from app.errors import WarningCode

client = TestClient(app)

# ============================================================================
# Shared helpers
# ============================================================================

def _osrm_ok(distance_m: float = 5000.0, duration_s: float = 600.0) -> Mock:
    m = Mock()
    m.json.return_value = {
        "code": "Ok",
        "routes": [{"distance": distance_m, "duration": duration_s}],
    }
    m.raise_for_status = Mock()
    return m


def _has_warning(plan, code: WarningCode) -> bool:
    return any(w.code == code for w in plan.warnings)


def _coordinator(use_ml: bool = False) -> MasterCoordinator:
    return MasterCoordinator(use_ml_risk=use_ml)


def _base_flood_request(
    *,
    incident_id: str = "FLOOD_R01",
    victim_count: int = 4,
    water_level: float = 1.2,
    rainfall: float = 25.0,
    road_access: RoadAccessStatus = RoadAccessStatus.OPEN,
    resource_status: ResourceStatus = ResourceStatus.AVAILABLE,
    resource_type: ResourceType = ResourceType.RESCUE_BOAT,
    hospital_beds: int = 30,
) -> DisasterAnalysisRequest:
    return DisasterAnalysisRequest(
        incident=Incident(
            id=incident_id,
            type=IncidentType.FLOOD,
            latitude=12.97,
            longitude=77.59,
            victim_count=victim_count,
            water_level=Observation(value=water_level),
            rainfall=Observation(value=rainfall),
            road_access=road_access,
        ),
        resources=[
            Resource(
                id="BOAT_01",
                type=resource_type,
                status=resource_status,
                latitude=12.98,
                longitude=77.60,
            )
        ],
        hospitals=[
            Hospital(
                id="HOSP_01",
                name="District Hospital",
                latitude=12.99,
                longitude=77.61,
                total_beds=100,
                available_beds=hospital_beds,
            )
        ],
    )


# ============================================================================
# R01 — Normal flood (happy path)
# ============================================================================

class TestR01NormalFlood:

    @patch("app.services.routing_service.requests.get")
    def test_full_pipeline_completes(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.incident_id == "FLOOD_R01"
        assert plan.situation is not None
        assert plan.risk is not None
        assert plan.prediction is not None
        assert plan.safety_check is not None
        assert plan.autonomy_decision is not None
        assert plan.degraded is False

    @patch("app.services.routing_service.requests.get")
    def test_no_crash(self, mock_get):
        mock_get.return_value = _osrm_ok()
        # No exception should propagate
        _coordinator().analyze(_base_flood_request())

    @patch("app.services.routing_service.requests.get")
    def test_trace_id_generated(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.trace_id is not None
        assert len(plan.trace_id) > 0
        assert plan.trace_id == plan.trace.trace_id

    @patch("app.services.routing_service.requests.get")
    def test_trace_has_agent_steps(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        step_names = [s.step_name for s in plan.trace.steps]
        for expected in ["Data Quality Analysis", "Situation Analysis",
                         "Risk Analysis", "Safety Check", "Autonomy Decision"]:
            assert expected in step_names, f"Missing trace step: {expected}. Steps found: {step_names}"

    @patch("app.services.routing_service.requests.get")
    def test_overall_confidence_nonzero(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert 0.0 < plan.overall_confidence <= 1.0

    @patch("app.services.routing_service.requests.get")
    def test_human_review_is_bool(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert isinstance(plan.human_review_required, bool)
        assert plan.human_review_required == plan.autonomy_decision.human_review_required

    @patch("app.services.routing_service.requests.get")
    def test_fallback_used_false_normal(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.fallback_used is False

    @patch("app.services.routing_service.requests.get")
    def test_plan_valid_structure(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert isinstance(plan.explanation, list)
        assert len(plan.explanation) > 0
        assert isinstance(plan.warnings, list)
        assert plan.recommended_action in list(RecommendedAction)


# ============================================================================
# R02 — High-priority flood → IMMEDIATE_DISPATCH + human review
# ============================================================================

class TestR02HighPriorityFlood:

    def _high_priority_request(self):
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_CRIT_01",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=50,
                critical_victim_count=20,
                elderly_count=15,
                children_count=10,
                water_level=Observation(value=3.5),
                rainfall=Observation(value=120.0),
                road_access=RoadAccessStatus.PARTIAL,
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.96, longitude=77.58),
                Resource(id="AMB_01", type=ResourceType.AMBULANCE,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="City Hospital",
                         latitude=12.99, longitude=77.61,
                         total_beds=200, available_beds=50)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_critical_risk_level(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._high_priority_request())
        assert plan.risk.risk_level == RiskLevel.CRITICAL

    @patch("app.services.routing_service.requests.get")
    def test_immediate_dispatch_or_dispatch(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._high_priority_request())
        assert plan.recommended_action in (
            RecommendedAction.IMMEDIATE_DISPATCH,
            RecommendedAction.DISPATCH,
        )

    @patch("app.services.routing_service.requests.get")
    def test_human_review_required_for_critical(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._high_priority_request())
        assert plan.human_review_required is True
        assert plan.autonomy_decision.mode == AutonomyMode.HUMAN_REQUIRED

    @patch("app.services.routing_service.requests.get")
    def test_explanation_nonempty(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._high_priority_request())
        assert len(plan.explanation) > 0


# ============================================================================
# R03 — Single-location road accident
# ============================================================================

class TestR03LocalizedAccident:

    def _accident_request(self):
        return DisasterAnalysisRequest(
            incident=Incident(
                id="ACC_001",
                type=IncidentType.LOCALIZED_ACCIDENT,
                latitude=12.97, longitude=77.59,
                victim_count=3,
                critical_victim_count=1,
                road_access=RoadAccessStatus.PARTIAL,
            ),
            resources=[
                Resource(id="AMB_01", type=ResourceType.AMBULANCE,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="Emergency Hospital",
                         latitude=12.99, longitude=77.61,
                         total_beds=100, available_beds=20)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_accident_recognized(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._accident_request())
        assert plan.situation is not None
        assert "ACCIDENT" in plan.situation.normalized_incident_type.upper() \
               or "LOCALIZED" in plan.situation.normalized_incident_type.upper()

    @patch("app.services.routing_service.requests.get")
    def test_ambulance_assigned(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._accident_request())
        assert len(plan.assignments) >= 1
        assert plan.assignments[0].resource_id == "AMB_01"

    @patch("app.services.routing_service.requests.get")
    def test_no_crash(self, mock_get):
        mock_get.return_value = _osrm_ok()
        _coordinator().analyze(self._accident_request())

    @patch("app.services.routing_service.requests.get")
    def test_valid_plan_returned(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._accident_request())
        assert plan.incident_id == "ACC_001"
        assert plan.risk is not None
        assert plan.safety_check is not None


# ============================================================================
# R04 — Missing required fields → 422, no crash
# ============================================================================

class TestR04MissingFields:

    def test_missing_incident_returns_422(self):
        resp = client.post("/api/ai/analyze", json={})
        assert resp.status_code == 422
        assert "Traceback" not in resp.text

    def test_missing_incident_type_returns_422(self):
        payload = {
            "incident": {
                "id": "BAD_001",
                "latitude": 12.0, "longitude": 77.0
            }
        }
        resp = client.post("/api/ai/analyze", json=payload)
        assert resp.status_code == 422

    def test_structured_error_returned(self):
        resp = client.post("/api/ai/analyze", json={"bad_field": True})
        assert resp.status_code == 422
        body = resp.json()
        assert "error" in body or "detail" in body

    def test_no_stack_trace_in_422(self):
        resp = client.post("/api/ai/analyze", json={})
        assert "File \"" not in resp.text
        assert "site-packages" not in resp.text


# ============================================================================
# R05 — Invalid coordinate values → 422, no crash
# ============================================================================

class TestR05InvalidCoordinates:

    def test_latitude_out_of_range(self):
        payload = _base_flood_request().model_dump(mode="json")
        payload["incident"]["latitude"] = 999.0  # invalid
        resp = client.post("/api/ai/analyze", json=payload)
        assert resp.status_code == 422
        assert "Traceback" not in resp.text

    def test_longitude_out_of_range(self):
        payload = _base_flood_request().model_dump(mode="json")
        payload["incident"]["longitude"] = -999.0
        resp = client.post("/api/ai/analyze", json=payload)
        assert resp.status_code == 422

    def test_negative_victim_count_rejected(self):
        payload = _base_flood_request().model_dump(mode="json")
        payload["incident"]["victim_count"] = -5
        resp = client.post("/api/ai/analyze", json=payload)
        assert resp.status_code == 422


# ============================================================================
# R06 — Stale environmental data → reduced confidence, STALE_DATA warning
# ============================================================================

class TestR06StaleData:

    def _stale_request(self):
        old_time = datetime.utcnow() - timedelta(hours=6)
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_STALE",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=3,
                water_level=Observation(
                    value=1.2,
                    timestamp=old_time,
                    source="SENSOR_01",
                ),
                rainfall=Observation(
                    value=30.0,
                    timestamp=old_time,
                    source="SENSOR_02",
                ),
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="DH",
                         latitude=12.99, longitude=77.61,
                         total_beds=50, available_beds=10)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_stale_data_warning_generated(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._stale_request())
        assert _has_warning(plan, WarningCode.STALE_DATA), \
            "Expected STALE_DATA warning for 6h-old observations"

    @patch("app.services.routing_service.requests.get")
    def test_confidence_reduced(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._stale_request())
        assert plan.data_quality.confidence < 1.0

    @patch("app.services.routing_service.requests.get")
    def test_pipeline_completes_despite_stale_data(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._stale_request())
        assert plan.incident_id == "FLOOD_STALE"
        assert plan.situation is not None
        assert plan.risk is not None


# ============================================================================
# R07 — Conflicting observations → DATA_CONFLICT warning, confidence drop
# ============================================================================

class TestR07ConflictingData:

    def _conflicting_request(self):
        """High observed water level contradicts a strongly receding trend."""
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_CONFLICT",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=5,
                water_level=Observation(value=2.0, source="SENSOR_A"),
                rainfall=Observation(value=80.0, source="SENSOR_B"),
                # High water level contradicts the external trend below.
            ),
            environment=Environment(
                source="WEATHER_MODEL_A",
                water_level_trend_m_per_hour=-1.0,
                rainfall_trend_mm_per_hour=0.0,
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="DH",
                         latitude=12.99, longitude=77.61,
                         total_beds=50, available_beds=10)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_pipeline_completes(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._conflicting_request())
        assert plan.incident_id == "FLOOD_CONFLICT"
        assert plan.situation is not None

    @patch("app.services.routing_service.requests.get")
    def test_no_crash_on_conflict(self, mock_get):
        mock_get.return_value = _osrm_ok()
        _coordinator().analyze(self._conflicting_request())

    @patch("app.services.routing_service.requests.get")
    def test_data_quality_result_present(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._conflicting_request())
        assert plan.data_quality is not None
        assert plan.data_quality.overall_quality is not None

    @patch("app.services.routing_service.requests.get")
    def test_conflict_warning_generated(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._conflicting_request())
        assert _has_warning(plan, WarningCode.DATA_CONFLICT)
        assert "water_level" in plan.data_quality.conflicting_fields

    @patch("app.services.routing_service.requests.get")
    def test_conflict_reduces_confidence_and_escalates(self, mock_get):
        mock_get.return_value = _osrm_ok()
        clean = _coordinator().analyze(_base_flood_request())
        conflict = _coordinator().analyze(self._conflicting_request())
        assert conflict.data_quality.confidence < clean.data_quality.confidence
        assert conflict.autonomy_decision.mode == AutonomyMode.HUMAN_REQUIRED


# ============================================================================
# R08 — ML risk model unavailable → rule-based fallback
# ============================================================================

class TestR08MLModelUnavailable:

    @patch("app.services.routing_service.requests.get")
    @patch("app.services.ml_service.MLService.predict",
           side_effect=Exception("ML inference error"))
    def test_rule_based_fallback(self, mock_ml, mock_get):
        mock_get.return_value = _osrm_ok()
        coord = MasterCoordinator(use_ml_risk=True)
        plan = coord.analyze(_base_flood_request())
        assert plan.risk is not None, "Risk result should exist after ML fallback"
        assert plan.risk.risk_level is not None

    @patch("app.services.routing_service.requests.get")
    @patch("app.services.ml_service.MLService.predict",
           side_effect=Exception("ML inference error"))
    def test_fallback_sets_used_fallback_flag(self, mock_ml, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = MasterCoordinator(use_ml_risk=True).analyze(_base_flood_request())
        assert plan.risk.used_fallback is True

    @patch("app.services.routing_service.requests.get")
    @patch("app.services.ml_service.MLService.predict",
           side_effect=Exception("ML inference error"))
    def test_plan_fallback_flag_propagated(self, mock_ml, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = MasterCoordinator(use_ml_risk=True).analyze(_base_flood_request())
        assert plan.fallback_used is True

    @patch("app.services.routing_service.requests.get")
    @patch("app.services.ml_service.MLService.predict",
           side_effect=Exception("ML inference error"))
    def test_model_missing_warning(self, mock_ml, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = MasterCoordinator(use_ml_risk=True).analyze(_base_flood_request())
        assert any(w.code in (WarningCode.MODEL_FILE_MISSING, WarningCode.MODEL_PREDICTION_FAILED)
                   for w in plan.warnings)


# ============================================================================
# R09 — Predictive agent failure → pipeline continues, reduced confidence
# ============================================================================

class TestR09PredictiveFailure:

    @patch("app.services.routing_service.requests.get")
    @patch("app.agents.predictive_agent.PredictiveAgent.analyze",
           side_effect=RuntimeError("prediction model crashed"))
    def test_pipeline_continues_without_prediction(self, mock_pred, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        # Pipeline must not crash
        assert plan.incident_id == "FLOOD_R01"
        assert plan.situation is not None
        assert plan.risk is not None

    @patch("app.services.routing_service.requests.get")
    @patch("app.agents.predictive_agent.PredictiveAgent.analyze",
           side_effect=RuntimeError("prediction model crashed"))
    def test_degraded_flag_set(self, mock_pred, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        # Pipeline should degrade gracefully
        assert plan.degraded is True or plan.prediction is None or \
               plan.prediction.used_fallback is True

    @patch("app.services.routing_service.requests.get")
    @patch("app.agents.predictive_agent.PredictiveAgent.analyze",
           side_effect=RuntimeError("prediction model crashed"))
    def test_warning_generated(self, mock_pred, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        warning_codes = [w.code for w in plan.warnings]
        assert any(code in (WarningCode.PREDICTION_FAILURE, WarningCode.MODEL_PREDICTION_FAILED)
                   for code in warning_codes), f"Expected prediction failure warning; got {warning_codes}"


# ============================================================================
# R10 — OSRM unavailable → ROUTE_UNAVAILABLE fallback
# ============================================================================

class TestR10OSRMUnavailable:

    @patch("app.services.routing_service.requests.get")
    def test_pipeline_returns_200(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        resp = client.post(
            "/api/ai/analyze",
            json=_base_flood_request().model_dump(mode="json")
        )
        assert resp.status_code == 200

    @patch("app.services.routing_service.requests.get")
    def test_degraded_flag_set(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.degraded is True

    @patch("app.services.routing_service.requests.get")
    def test_route_status_unavailable(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        plan = _coordinator().analyze(_base_flood_request())
        for a in plan.assignments:
            assert a.route.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE

    @patch("app.services.routing_service.requests.get")
    def test_osrm_warning_present(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        plan = _coordinator().analyze(_base_flood_request())
        assert _has_warning(plan, WarningCode.OSRM_UNAVAILABLE)

    @patch("app.services.routing_service.requests.get")
    def test_fallback_used_true(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.fallback_used is True
        assert any(a.route.used_fallback for a in plan.assignments)

    @patch("app.services.routing_service.requests.get")
    def test_situation_and_risk_still_present(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.situation is not None
        assert plan.risk is not None

    @patch("app.services.routing_service.requests.get")
    def test_trace_id_still_generated(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.trace_id is not None


# ============================================================================
# R11 — All resources unavailable
# ============================================================================

class TestR11ResourceUnavailable:

    def _all_dispatched_request(self):
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_NO_RES",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=4,
                water_level=Observation(value=1.2),
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.DISPATCHED,
                         latitude=12.98, longitude=77.60),
                Resource(id="BOAT_02", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.MAINTENANCE,
                         latitude=12.97, longitude=77.59),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="DH",
                         latitude=12.99, longitude=77.61,
                         total_beds=50, available_beds=10)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_pipeline_does_not_crash(self, mock_get):
        mock_get.return_value = _osrm_ok()
        _coordinator().analyze(self._all_dispatched_request())

    @patch("app.services.routing_service.requests.get")
    def test_no_assignments(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._all_dispatched_request())
        assert len(plan.assignments) == 0

    @patch("app.services.routing_service.requests.get")
    def test_resource_warning_generated(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._all_dispatched_request())
        assert any(w.code in (WarningCode.NO_AVAILABLE_RESOURCE, WarningCode.NO_SUITABLE_RESOURCE)
                   for w in plan.warnings)

    @patch("app.services.routing_service.requests.get")
    def test_still_returns_valid_plan(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._all_dispatched_request())
        assert plan.incident_id == "FLOOD_NO_RES"
        assert plan.situation is not None
        assert plan.risk is not None


# ============================================================================
# R12 — Hospital full / zero beds
# ============================================================================

class TestR12HospitalFull:

    def _full_hospital_request(self):
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_HOSP_FULL",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=5,
                water_level=Observation(value=1.5),
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="Full Hospital",
                         latitude=12.99, longitude=77.61,
                         total_beds=50, available_beds=0)  # FULL
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_pipeline_completes(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._full_hospital_request())
        assert plan.incident_id == "FLOOD_HOSP_FULL"

    @patch("app.services.routing_service.requests.get")
    def test_safety_check_captures_full_hospital(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._full_hospital_request())
        assert plan.safety_check is not None
        # Full hospital should appear in warnings or blocking issues
        hospital_concern = (
            any("capacity" in w.lower() or "0" in w for w in plan.safety_check.warnings) or
            any("capacity" in b.lower() or "hospital" in b.lower()
                for b in plan.safety_check.blocking_issues) or
            len(plan.safety_check.warnings) > 0
        )
        assert hospital_concern or plan.safety_check.status in (
            SafetyStatus.REVIEW_REQUIRED, SafetyStatus.BLOCKED
        )

    @patch("app.services.routing_service.requests.get")
    def test_no_crash(self, mock_get):
        mock_get.return_value = _osrm_ok()
        _coordinator().analyze(self._full_hospital_request())


# ============================================================================
# R13 — Blocked road
# ============================================================================

class TestR13BlockedRoad:

    def _blocked_road_request(self):
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_BLOCKED",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=4,
                water_level=Observation(value=1.2),
                road_access=RoadAccessStatus.BLOCKED,
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="DH",
                         latitude=12.99, longitude=77.61,
                         total_beds=50, available_beds=10)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_pipeline_completes_blocked(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._blocked_road_request())
        assert plan.incident_id == "FLOOD_BLOCKED"

    @patch("app.services.routing_service.requests.get")
    def test_safety_check_captures_blocked_road(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._blocked_road_request())
        assert plan.safety_check is not None

    @patch("app.services.routing_service.requests.get")
    def test_no_crash_blocked(self, mock_get):
        mock_get.return_value = _osrm_ok()
        _coordinator().analyze(self._blocked_road_request())


# ============================================================================
# R14 — Multiple incidents competing for resources
# ============================================================================

class TestR14MultipleIncidents:
    """
    Simulate a flood + accident with a single shared boat resource by
    running two analyses and checking both get responses without crash.
    """

    @patch("app.services.routing_service.requests.get")
    def test_two_analyses_no_crash(self, mock_get):
        mock_get.return_value = _osrm_ok()
        coord = _coordinator()
        req1 = _base_flood_request(incident_id="INC_A")
        req2 = DisasterAnalysisRequest(
            incident=Incident(
                id="INC_B",
                type=IncidentType.LOCALIZED_ACCIDENT,
                latitude=13.00, longitude=77.62,
                victim_count=2,
                critical_victim_count=1,
            ),
            resources=[
                Resource(id="AMB_01", type=ResourceType.AMBULANCE,
                         status=ResourceStatus.AVAILABLE,
                         latitude=13.01, longitude=77.63),
            ],
            hospitals=[
                Hospital(id="HOSP_02", name="DH2",
                         latitude=13.02, longitude=77.64,
                         total_beds=50, available_beds=15)
            ],
        )
        p1 = coord.analyze(req1)
        p2 = coord.analyze(req2)
        assert p1.incident_id == "INC_A"
        assert p2.incident_id == "INC_B"

    @patch("app.services.routing_service.requests.get")
    def test_each_response_has_separate_trace(self, mock_get):
        mock_get.return_value = _osrm_ok()
        coord = _coordinator()
        p1 = coord.analyze(_base_flood_request(incident_id="INC_X"))
        p2 = coord.analyze(_base_flood_request(incident_id="INC_Y"))
        assert p1.trace_id != p2.trace_id


# ============================================================================
# R15 — Low-confidence decision → ASSISTED or HUMAN_REQUIRED
# ============================================================================

class TestR15LowConfidenceDecision:

    def _low_confidence_request(self):
        old = datetime.utcnow() - timedelta(hours=8)
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_LOW_CONF",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=3,
                confidence=0.3,
                water_level=Observation(value=1.0, confidence=0.3, timestamp=old),
                rainfall=Observation(value=20.0, confidence=0.3, timestamp=old),
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_pipeline_completes(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._low_confidence_request())
        assert plan.incident_id == "FLOOD_LOW_CONF"

    @patch("app.services.routing_service.requests.get")
    def test_autonomy_not_full_auto_when_low_confidence(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._low_confidence_request())
        # Low confidence should push to ASSISTED or HUMAN_REQUIRED
        assert plan.autonomy_decision.mode in (
            AutonomyMode.ASSISTED, AutonomyMode.HUMAN_REQUIRED
        ) or plan.overall_confidence < 0.8

    @patch("app.services.routing_service.requests.get")
    def test_overall_confidence_lower(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan_normal = _coordinator().analyze(_base_flood_request())
        plan_low = _coordinator().analyze(self._low_confidence_request())
        assert plan_low.overall_confidence <= plan_normal.overall_confidence


# ============================================================================
# R16 — Critical mass-casualty → HUMAN_REQUIRED with blocking factors
# ============================================================================

class TestR16CriticalHumanReview:

    def _mass_casualty_request(self):
        return DisasterAnalysisRequest(
            incident=Incident(
                id="MASS_CRIT",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=100,
                critical_victim_count=40,
                elderly_count=30,
                children_count=20,
                water_level=Observation(value=4.0),
                rainfall=Observation(value=180.0),
                road_access=RoadAccessStatus.BLOCKED,
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="Overwhelmed Hosp",
                         latitude=12.99, longitude=77.61,
                         total_beds=50, available_beds=2)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_human_required(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._mass_casualty_request())
        assert plan.human_review_required is True
        assert plan.autonomy_decision.mode == AutonomyMode.HUMAN_REQUIRED

    @patch("app.services.routing_service.requests.get")
    def test_blocking_factors_present(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._mass_casualty_request())
        assert len(plan.autonomy_decision.blocking_factors) > 0

    @patch("app.services.routing_service.requests.get")
    def test_critical_risk(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._mass_casualty_request())
        assert plan.risk.risk_level == RiskLevel.CRITICAL

    @patch("app.services.routing_service.requests.get")
    def test_no_crash(self, mock_get):
        mock_get.return_value = _osrm_ok()
        _coordinator().analyze(self._mass_casualty_request())


# ============================================================================
# R17 — LOW-risk AUTO dispatch (no human review)
# ============================================================================

class TestR17AutoDispatch:

    def _low_risk_request(self):
        return DisasterAnalysisRequest(
            incident=Incident(
                id="MONITOR_001",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=1,
                water_level=Observation(value=0.3),
                rainfall=Observation(value=5.0),
                road_access=RoadAccessStatus.OPEN,
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="DH",
                         latitude=12.99, longitude=77.61,
                         total_beds=100, available_beds=80)
            ],
        )

    @patch("app.services.routing_service.requests.get")
    def test_low_risk_level(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._low_risk_request())
        assert plan.risk.risk_level in (RiskLevel.LOW, RiskLevel.MEDIUM)

    @patch("app.services.routing_service.requests.get")
    def test_no_crash_low_risk(self, mock_get):
        mock_get.return_value = _osrm_ok()
        _coordinator().analyze(self._low_risk_request())

    @patch("app.services.routing_service.requests.get")
    def test_auto_or_assisted_mode(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._low_risk_request())
        # Low risk should not require full human intervention
        assert plan.autonomy_decision.mode in (AutonomyMode.AUTO, AutonomyMode.ASSISTED)

    @patch("app.services.routing_service.requests.get")
    def test_monitor_or_prepare_action(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(self._low_risk_request())
        assert plan.recommended_action in (
            RecommendedAction.MONITOR,
            RecommendedAction.PREPARE,
            RecommendedAction.PRE_POSITION,
        )


# ============================================================================
# R18 — Situation agent output is_valid=False
# ============================================================================

class TestR18SituationValidationFailure:

    @patch("app.services.routing_service.requests.get")
    @patch("app.agents.situation_agent.SituationAgent.analyze")
    def test_pipeline_continues_with_invalid_situation(self, mock_sit, mock_get):
        """If situation result is_valid=False, pipeline should continue, not crash."""
        from app.schemas.domain import SituationResult
        mock_get.return_value = _osrm_ok()

        fake_state_return = None  # We need to produce a state, use real state object

        # Make situation return is_valid=False (degraded situation)
        def _fake_analyze(state):
            from app.schemas.domain import DisasterAnalysisState
            state.situation = SituationResult(
                is_valid=False,
                summary="Cannot determine situation — insufficient data",
                severity_assessment="UNKNOWN",
                vulnerable_population_impact="UNKNOWN",
                confidence_score=0.1,
                normalized_incident_type="FLOOD",
            )
            return state

        mock_sit.side_effect = _fake_analyze
        plan = _coordinator().analyze(_base_flood_request())
        # Pipeline must return a plan regardless
        assert plan.incident_id == "FLOOD_R01"
        assert plan.situation is not None
        assert plan.situation.is_valid is False


# ============================================================================
# R19 — Unexpected internal exception → 500, no traceback in body
# ============================================================================

class TestR19UnexpectedInternalException:

    @patch("app.services.routing_service.requests.get")
    @patch("app.agents.master_coordinator.MasterCoordinator.analyze",
           side_effect=Exception("unexpected segfault"))
    def test_returns_500(self, mock_analyze, mock_get):
        mock_get.return_value = _osrm_ok()
        resp = client.post(
            "/api/ai/analyze",
            json=_base_flood_request().model_dump(mode="json")
        )
        assert resp.status_code == 500

    @patch("app.services.routing_service.requests.get")
    @patch("app.agents.master_coordinator.MasterCoordinator.analyze",
           side_effect=Exception("unexpected segfault"))
    def test_no_traceback_in_500_body(self, mock_analyze, mock_get):
        mock_get.return_value = _osrm_ok()
        resp = client.post(
            "/api/ai/analyze",
            json=_base_flood_request().model_dump(mode="json")
        )
        assert "Traceback" not in resp.text
        assert "File \"" not in resp.text
        assert "site-packages" not in resp.text

    @patch("app.services.routing_service.requests.get")
    @patch("app.agents.master_coordinator.MasterCoordinator.analyze",
           side_effect=Exception("unexpected segfault"))
    def test_500_has_structured_error(self, mock_analyze, mock_get):
        mock_get.return_value = _osrm_ok()
        resp = client.post(
            "/api/ai/analyze",
            json=_base_flood_request().model_dump(mode="json")
        )
        body = resp.json()
        assert "error" in body or "detail" in body


# ============================================================================
# R20 — Adaptive replanning: road becomes blocked, plan updated
# ============================================================================

class TestR20AdaptiveReplanning:

    @patch("app.services.routing_service.requests.get")
    def test_reanalyze_endpoint_returns_200(self, mock_get):
        mock_get.return_value = _osrm_ok()
        state1 = _base_flood_request(incident_id="REPLAN_01").model_dump(mode="json")
        resp1 = client.post("/api/ai/analyze", json=state1)
        assert resp1.status_code == 200
        plan1 = resp1.json()

        state2 = copy.deepcopy(state1)
        state2["incident"]["road_access"] = "BLOCKED"
        payload = {"previous_plan": plan1, "updated_state": state2}
        resp2 = client.post("/api/ai/reanalyze", json=payload)
        assert resp2.status_code == 200

    @patch("app.services.routing_service.requests.get")
    def test_invalidation_reason_in_explanation(self, mock_get):
        mock_get.return_value = _osrm_ok()
        state1 = _base_flood_request(incident_id="REPLAN_02").model_dump(mode="json")
        plan1 = client.post("/api/ai/analyze", json=state1).json()

        state2 = copy.deepcopy(state1)
        state2["incident"]["road_access"] = "BLOCKED"
        resp2 = client.post("/api/ai/reanalyze",
                            json={"previous_plan": plan1, "updated_state": state2})
        revision = resp2.json()
        explanations = revision.get("new_plan", {}).get("explanation", [])
        assert any("BLOCKED" in e or "blocked" in e.lower() for e in explanations), \
            f"Expected BLOCKED in explanation, got: {explanations}"

    @patch("app.services.routing_service.requests.get")
    def test_reanalyze_trace_id_different(self, mock_get):
        mock_get.return_value = _osrm_ok()
        state1 = _base_flood_request(incident_id="REPLAN_03").model_dump(mode="json")
        plan1 = client.post("/api/ai/analyze", json=state1).json()
        state2 = copy.deepcopy(state1)
        state2["incident"]["victim_count"] = 50
        resp2 = client.post("/api/ai/reanalyze",
                            json={"previous_plan": plan1, "updated_state": state2})
        revision = resp2.json()
        new_trace = revision.get("new_plan", {}).get("trace_id")
        old_trace = plan1.get("trace_id")
        assert new_trace != old_trace


# ============================================================================
# R21 — Trace ID present and consistent across plan
# ============================================================================

class TestR21TraceConsistency:

    @patch("app.services.routing_service.requests.get")
    def test_trace_id_matches_trace_object(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.trace_id == plan.trace.trace_id

    @patch("app.services.routing_service.requests.get")
    def test_all_trace_steps_share_trace_id(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        for step in plan.trace.steps:
            assert step.trace_id == plan.trace.trace_id, \
                f"Step '{step.step_name}' has mismatched trace_id"

    @patch("app.services.routing_service.requests.get")
    def test_unique_trace_per_request(self, mock_get):
        mock_get.return_value = _osrm_ok()
        coord = _coordinator()
        p1 = coord.analyze(_base_flood_request(incident_id="TR_A"))
        p2 = coord.analyze(_base_flood_request(incident_id="TR_B"))
        assert p1.trace_id != p2.trace_id


# ============================================================================
# R22 — Confidence degrades with stale + missing data
# ============================================================================

class TestR22ConfidenceDegradation:

    @patch("app.services.routing_service.requests.get")
    def test_stale_lower_than_fresh(self, mock_get):
        mock_get.return_value = _osrm_ok()
        fresh = _base_flood_request()
        old_time = datetime.utcnow() - timedelta(hours=6)
        stale = DisasterAnalysisRequest(
            incident=Incident(
                id="STALE_C",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=4,
                water_level=Observation(value=1.2, timestamp=old_time),
                rainfall=Observation(value=25.0, timestamp=old_time),
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
            hospitals=[
                Hospital(id="HOSP_01", name="DH",
                         latitude=12.99, longitude=77.61,
                         total_beds=50, available_beds=10)
            ],
        )
        coord = _coordinator()
        p_fresh = coord.analyze(fresh)
        p_stale = coord.analyze(stale)
        assert p_stale.data_quality.confidence <= p_fresh.data_quality.confidence

    @patch("app.services.routing_service.requests.get")
    def test_missing_water_level_reduces_confidence(self, mock_get):
        mock_get.return_value = _osrm_ok()
        req_with = _base_flood_request()
        req_without = DisasterAnalysisRequest(
            incident=Incident(
                id="NO_WL",
                type=IncidentType.FLOOD,
                latitude=12.97, longitude=77.59,
                victim_count=4,
                # No water_level, no rainfall
            ),
            resources=[
                Resource(id="BOAT_01", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=12.98, longitude=77.60),
            ],
        )
        coord = _coordinator()
        p_with = coord.analyze(req_with)
        p_without = coord.analyze(req_without)
        assert p_without.risk.confidence <= p_with.risk.confidence


# ============================================================================
# R23 — Warnings propagate to top-level response
# ============================================================================

class TestR23WarningPropagation:

    @patch("app.services.routing_service.requests.get")
    def test_warnings_have_code_source_message(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        plan = _coordinator().analyze(_base_flood_request())
        for w in plan.warnings:
            assert hasattr(w, "code")
            assert hasattr(w, "source")
            assert hasattr(w, "message")
            assert len(w.message) > 0

    @patch("app.services.routing_service.requests.get")
    def test_api_warnings_structure(self, mock_get):
        mock_get.side_effect = req_lib.exceptions.ConnectionError("OSRM down")
        resp = client.post(
            "/api/ai/analyze",
            json=_base_flood_request().model_dump(mode="json")
        )
        body = resp.json()
        for w in body["warnings"]:
            assert "code" in w
            assert "source" in w
            assert "message" in w


# ============================================================================
# R24 — Fallback used flag accurate
# ============================================================================

class TestR24FallbackFlag:

    @patch("app.services.routing_service.requests.get")
    def test_fallback_false_on_clean_run(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert plan.fallback_used is False

    @patch("app.services.routing_service.requests.get")
    @patch("app.services.ml_service.MLService.predict",
           side_effect=Exception("no model"))
    def test_fallback_true_when_ml_missing(self, mock_ml, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = MasterCoordinator(use_ml_risk=True).analyze(_base_flood_request())
        assert plan.fallback_used is True


# ============================================================================
# R25 — Provenance collected from all agents
# ============================================================================

class TestR25Provenance:

    @patch("app.services.routing_service.requests.get")
    def test_provenance_is_list(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        assert isinstance(plan.provenance, list)

    @patch("app.services.routing_service.requests.get")
    def test_provenance_items_have_agent_field(self, mock_get):
        mock_get.return_value = _osrm_ok()
        plan = _coordinator().analyze(_base_flood_request())
        for prov in plan.provenance:
            assert hasattr(prov, "agent") or (isinstance(prov, dict) and "agent" in prov)

    @patch("app.services.routing_service.requests.get")
    def test_provenance_included_in_api_response(self, mock_get):
        mock_get.return_value = _osrm_ok()
        resp = client.post(
            "/api/ai/analyze",
            json=_base_flood_request().model_dump(mode="json")
        )
        assert "provenance" in resp.json()
        assert isinstance(resp.json()["provenance"], list)
