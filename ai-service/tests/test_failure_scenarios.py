"""
Test suite covering all 13 failure scenarios for the hardened AI pipeline.

Each test verifies that the pipeline degrades gracefully, returns structured warnings,
and never crashes for recoverable failures.
"""

import pytest
from unittest.mock import patch, Mock, MagicMock
import requests

from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Resource,
    ResourceType,
    ResourceStatus,
    Environment,
    RecommendedAction,
    RoadAccessStatus,
    DisasterAnalysisState
)
from app.agents.master_coordinator import MasterCoordinator
from app.agents.situation_agent import SituationAgent
from app.agents.risk_agent import RiskAgent
from app.agents.predictive_agent import PredictiveAgent
from app.agents.resource_agent import ResourceAgent
from app.agents.route_agent import RouteAgent
from app.services.routing_service import RoutingService
from app.services.optimization_service import OptimizationService
from app.errors import WarningCode, PipelineWarning


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class DummyRiskResult:
    """Lightweight stand-in for RiskResult to decouple from full schema."""
    def __init__(self, risk_level, priority):
        from app.schemas.domain import Priority
        self.risk_level = risk_level
        self.priority = priority
        self._pipeline_warnings = []
        self.reasons = []


def _make_request(**kwargs):
    """Build a minimal DisasterAnalysisRequest with overrides."""
    defaults = dict(
        incident=Incident(
            id="INC_TEST", type=IncidentType.FLOOD,
            latitude=10.0, longitude=20.0, victim_count=5,
        ),
    )
    defaults.update(kwargs)
    return DisasterAnalysisRequest(**defaults)


def _has_warning_code(plan_or_list, code: WarningCode) -> bool:
    """Check if any warning in the plan (or list) has the given code."""
    warnings = plan_or_list if isinstance(plan_or_list, list) else plan_or_list.warnings
    return any(w.code == code for w in warnings)


# ===========================================================================
# 1. Missing Environmental Data
# ===========================================================================

class TestMissingEnvironmentalData:
    def test_pipeline_completes_without_environment(self):
        """Full pipeline completes with no environment block."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request(environment=None)

        plan = coordinator.analyze(request)

        assert plan.incident_id == "INC_TEST"
        assert plan.situation is not None
        assert plan.risk is not None
        assert _has_warning_code(plan, WarningCode.MISSING_ENVIRONMENT_DATA)

    def test_predictive_agent_reduced_confidence(self):
        """PredictiveAgent reduces confidence when environment is missing."""
        from app.schemas.domain import RiskLevel, Priority, DisasterAnalysisState
        agent = PredictiveAgent()
        request = _make_request(environment=None)
        risk = DummyRiskResult(RiskLevel.HIGH, Priority.P2_HIGH)

        state = DisasterAnalysisState(request=request)
        state.risk = risk
        result = agent.analyze(state).prediction

        assert result.confidence == 0.5
        assert "no environmental data provided" in result.explanation[0].lower()


# ===========================================================================
# 2. Missing Resources
# ===========================================================================

class TestMissingResources:
    def test_empty_resources_list(self):
        """Pipeline completes with empty resources list."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request(resources=[])

        plan = coordinator.analyze(request)

        assert plan.incident_id == "INC_TEST"
        assert len(plan.assignments) == 0
        assert _has_warning_code(plan, WarningCode.MISSING_RESOURCES)


# ===========================================================================
# 3. No Available Ambulance / Resource
# ===========================================================================

class TestNoAvailableResource:
    def test_all_resources_dispatched(self):
        """All resources in DISPATCHED/MAINTENANCE status → no assignments."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request(
            incident=Incident(
                id="INC_MED", type=IncidentType.MEDICAL,
                latitude=10.0, longitude=20.0, victim_count=3,
            ),
            resources=[
                Resource(id="AMB_1", type=ResourceType.AMBULANCE, status=ResourceStatus.DISPATCHED, latitude=10.1, longitude=20.1),
                Resource(id="AMB_2", type=ResourceType.AMBULANCE, status=ResourceStatus.MAINTENANCE, latitude=10.2, longitude=20.2),
            ],
        )

        plan = coordinator.analyze(request)

        assert len(plan.assignments) == 0
        assert _has_warning_code(plan, WarningCode.NO_AVAILABLE_RESOURCE) or \
               _has_warning_code(plan, WarningCode.NO_SUITABLE_RESOURCE)


# ===========================================================================
# 4. No Suitable Resource (incompatible type)
# ===========================================================================

class TestNoSuitableResource:
    def test_incompatible_resources(self):
        """Medical team cannot respond to a fire incident."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request(
            incident=Incident(
                id="INC_FIRE", type=IncidentType.FIRE,
                latitude=10.0, longitude=20.0, victim_count=2,
            ),
            resources=[
                Resource(id="MED_1", type=ResourceType.MEDICAL_TEAM, status=ResourceStatus.AVAILABLE, latitude=10.1, longitude=20.1),
            ],
        )

        plan = coordinator.analyze(request)

        assert len(plan.assignments) == 0
        assert _has_warning_code(plan, WarningCode.NO_SUITABLE_RESOURCE)


# ===========================================================================
# 5. OSRM Failure
# ===========================================================================

class TestOSRMFailure:
    @patch('app.services.routing_service.requests.get')
    def test_osrm_connection_error(self, mock_get):
        """OSRM connection failure → ROUTE_UNAVAILABLE status, pipeline continues."""
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection refused")

        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request(
            incident=Incident(
                id="INC_FIRE", type=IncidentType.FIRE,
                latitude=10.0, longitude=20.0, victim_count=5,
            ),
            resources=[
                Resource(id="FIRE_1", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.AVAILABLE, latitude=10.1, longitude=20.1),
            ],
        )

        plan = coordinator.analyze(request)

        # Plan should still succeed
        assert plan.incident_id == "INC_FIRE"
        assert len(plan.assignments) == 1

        # Route should be marked as unavailable
        assert plan.assignments[0].route.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE

        # Warning should be present
        assert _has_warning_code(plan, WarningCode.OSRM_UNAVAILABLE)

    @patch('app.services.routing_service.requests.get')
    def test_osrm_timeout(self, mock_get):
        """OSRM timeout → fallback to straight-line."""
        mock_get.side_effect = requests.exceptions.Timeout("Request timed out")

        service = RoutingService()
        result = service.get_route(10.0, 20.0, 10.1, 20.1)

        assert result["success"] is False
        assert result["distance_km"] > 0
        assert any(w.code == WarningCode.OSRM_UNAVAILABLE for w in result["warnings"])


# ===========================================================================
# 6. Invalid Coordinates
# ===========================================================================

class TestInvalidCoordinates:
    def test_none_origin_coordinates(self):
        """Resource with None coordinates → ROUTE_UNAVAILABLE."""
        agent = RouteAgent()
        result = agent.analyze(
            resource_id="RES_1",
            destination_id="INC_1",
            origin_lat=None,
            origin_lon=None,
            dest_lat=10.0,
            dest_lon=20.0,
        )

        assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
        assert result.distance_km == 0.0
        assert any(w.code == WarningCode.INVALID_COORDINATES for w in getattr(result, '_pipeline_warnings', []))

    def test_none_destination_coordinates(self):
        """Destination with None coordinates → ROUTE_UNAVAILABLE."""
        agent = RouteAgent()
        result = agent.analyze(
            resource_id="RES_1",
            destination_id="INC_1",
            origin_lat=10.0,
            origin_lon=20.0,
            dest_lat=None,
            dest_lon=None,
        )

        assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
        assert result.distance_km == 0.0

    def test_routing_service_invalid_coordinates(self):
        """RoutingService validates coordinates before OSRM call."""
        service = RoutingService()
        result = service.get_route(None, None, 10.0, 20.0)

        assert result["success"] is False
        assert any(w.code == WarningCode.INVALID_COORDINATES for w in result["warnings"])


# ===========================================================================
# 7. Model File Missing
# ===========================================================================

class TestModelFileMissing:
    def test_ml_risk_agent_falls_back(self):
        """When model file is missing, RiskAgent falls back to rule-based scoring."""
        with patch('app.services.ml_service.os.path.exists', return_value=False):
            agent = RiskAgent(use_ml=True)

        request = _make_request()
        state = DisasterAnalysisState(request=request)
        result = agent.analyze(state).risk

        # Should still produce a valid result
        assert result.score >= 0
        assert result.risk_level is not None

        # Should have warning about model
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code in (WarningCode.MODEL_FILE_MISSING, WarningCode.MODEL_PREDICTION_FAILED) for w in warnings)


# ===========================================================================
# 8. Model Prediction Failure
# ===========================================================================

class TestModelPredictionFailure:
    def test_prediction_exception_falls_back(self):
        """When model.predict raises, RiskAgent falls back to rule-based."""
        # Build a RiskAgent in ML mode, then replace its ml_service with a
        # mock whose predict() raises, simulating a corrupt model at inference time.
        agent = RiskAgent(use_ml=False)  # init without ML to avoid loading
        agent.use_ml = True

        mock_ml = Mock()
        mock_ml.is_available = True
        mock_ml.predict = Mock(side_effect=RuntimeError("Corrupt model"))
        mock_ml.load_warnings = []
        agent.ml_service = mock_ml

        request = _make_request()
        state = DisasterAnalysisState(request=request)
        result = agent.analyze(state).risk

        # Should still produce valid result via rule-based fallback
        assert result.score >= 0
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.MODEL_PREDICTION_FAILED for w in warnings)


# ===========================================================================
# 9. Malformed Input (tested via FastAPI TestClient)
# ===========================================================================

class TestMalformedInput:
    def test_missing_incident_field(self):
        """Pydantic rejects request missing required 'incident' field."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        response = client.post("/api/ai/analyze", json={})

        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "VALIDATION_ERROR"
        # Should not contain internal file paths
        assert "traceback" not in str(data).lower()
        assert "\\app\\" not in str(data)

    def test_invalid_coordinates_in_incident(self):
        """Pydantic rejects out-of-range latitude."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        response = client.post("/api/ai/analyze", json={
            "incident": {
                "id": "INC_BAD",
                "type": "FLOOD",
                "latitude": 999.0,  # Out of range
                "longitude": 20.0,
            }
        })

        assert response.status_code == 422


# ===========================================================================
# 10. Empty Hospital List
# ===========================================================================

class TestEmptyHospitalList:
    def test_no_hospitals_warning(self):
        """Empty hospital list produces structured warning."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request(hospitals=[])

        plan = coordinator.analyze(request)

        assert plan.incident_id == "INC_TEST"
        assert _has_warning_code(plan, WarningCode.EMPTY_HOSPITAL_LIST)


# ===========================================================================
# 11. Incomplete Incident Information
# ===========================================================================

class TestIncompleteIncidentInfo:
    def test_flood_without_water_level(self):
        """FLOOD incident without water_level reduces confidence."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request(
            incident=Incident(
                id="INC_FLOOD", type=IncidentType.FLOOD,
                latitude=10.0, longitude=20.0,
                victim_count=3,
                # water_level missing, rainfall missing
            ),
        )

        plan = coordinator.analyze(request)

        assert plan.data_quality.confidence < 1.0
        assert "water_level" in plan.data_quality.missing_fields
        assert _has_warning_code(plan, WarningCode.INCOMPLETE_INCIDENT)


# ===========================================================================
# 12. Optimization Failure
# ===========================================================================

class TestOptimizationFailure:
    def test_solver_unavailable(self):
        """When solver creation fails → empty assignments + warning."""
        agent = ResourceAgent()
        from app.schemas.domain import Priority, RiskLevel, DisasterAnalysisState

        # Mock optimizer to raise
        with patch.object(agent.optimizer, 'optimize_dispatch', side_effect=RuntimeError("Solver crashed")):
            request = _make_request(
                resources=[
                    Resource(id="RES_1", type=ResourceType.RESCUE_BOAT, status=ResourceStatus.AVAILABLE, latitude=10.1, longitude=20.1),
                ],
            )
            risk = DummyRiskResult(RiskLevel.HIGH, Priority.P2_HIGH)
            state = DisasterAnalysisState(request=request)
            state.risk = risk
            result = agent.analyze(state).resource_assignments

        assert len(result.assignments) == 0
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.OPTIMIZATION_FAILURE for w in warnings)


# ===========================================================================
# 13. Prediction Failure
# ===========================================================================

class TestPredictionFailure:
    def test_predictive_agent_crash(self):
        """When PredictiveAgent crashes, pipeline continues with prediction=None."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request()

        with patch.object(coordinator.predictive_agent, 'analyze', side_effect=ValueError("Simulated crash")):
            plan = coordinator.analyze(request)

        assert plan.incident_id == "INC_TEST"
        assert plan.prediction is None
        assert plan.degraded is True
        assert _has_warning_code(plan, WarningCode.PREDICTION_FAILURE)

    def test_resource_agent_crash(self):
        """When ResourceAgent crashes, pipeline continues with no assignments."""
        coordinator = MasterCoordinator(use_ml_risk=False)
        request = _make_request()

        with patch.object(coordinator.resource_agent, 'analyze', side_effect=RuntimeError("Simulated crash")):
            plan = coordinator.analyze(request)

        assert plan.incident_id == "INC_TEST"
        assert len(plan.assignments) == 0
        assert plan.degraded is True
        assert _has_warning_code(plan, WarningCode.RESOURCE_FAILURE)
