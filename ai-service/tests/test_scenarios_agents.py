"""
Comprehensive agent-level test suite for the AI Disaster Response Service.

Tests each agent INDEPENDENTLY with realistic disaster scenarios.
All external dependencies (OSRM, ML models) are mocked.

Scenarios:
  1. Normal medical emergency
  2. High-priority flood with elderly victim
  3. Multiple victims with rising water
  4. No ambulance available
  5. Hospital/resource limitation
  6. OSRM unavailable
  7. Missing rainfall/water data
  8. Prediction indicates worsening risk
  9. Multiple incidents competing for limited resources
"""

import pytest
from unittest.mock import patch, Mock
import requests

from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Resource,
    ResourceType,
    ResourceStatus,
    Hospital,
    Road,
    Environment,
    RoadAccessStatus,
    RiskLevel,
    RiskResult,
    Priority,
    RecommendedAction,
    DisasterAnalysisState,
    Observation
)
from app.agents.situation_agent import SituationAgent
from app.agents.risk_agent import RiskAgent
from app.agents.predictive_agent import PredictiveAgent
from app.agents.resource_agent import ResourceAgent
from app.agents.route_agent import RouteAgent
from app.services.optimization_service import OptimizationService
from app.errors import WarningCode


# ============================================================================
# Shared Fixtures — Realistic Scenario Data
# ============================================================================

# Bangalore-area coordinates used throughout for realism
INCIDENT_LAT = 12.9716
INCIDENT_LON = 77.5946


def _osrm_success_mock():
    """Returns a Mock configured to simulate a successful OSRM response."""
    mock_resp = Mock()
    mock_resp.json.return_value = {
        "code": "Ok",
        "routes": [{"distance": 8200.0, "duration": 720.0}],
    }
    mock_resp.raise_for_status = Mock()
    return mock_resp


# ---------------------------------------------------------------------------
# SCENARIO 1: Normal medical emergency
# ---------------------------------------------------------------------------

class _Scenario1:
    """A single patient, one ambulance nearby, stable conditions."""

    @staticmethod
    def request():
        return DisasterAnalysisRequest(
            incident=Incident(
                id="MED_001",
                type=IncidentType.MEDICAL,
                latitude=INCIDENT_LAT,
                longitude=INCIDENT_LON,
                victim_count=1,
                road_access=RoadAccessStatus.OPEN,
            ),
            resources=[
                Resource(
                    id="AMB_101",
                    type=ResourceType.AMBULANCE,
                    status=ResourceStatus.AVAILABLE,
                    latitude=INCIDENT_LAT + 0.01,
                    longitude=INCIDENT_LON + 0.01,
                    capacity=2,
                ),
            ],
            hospitals=[
                Hospital(
                    id="HOSP_01", name="City General Hospital",
                    latitude=INCIDENT_LAT - 0.02, longitude=INCIDENT_LON + 0.03,
                    total_beds=200, available_beds=45,
                ),
            ],
            environment=Environment(
                general_weather="Clear sky",
                temperature_celsius=28.0,
            ),
        )


# ---------------------------------------------------------------------------
# SCENARIO 2: High-priority flood with elderly victim
# ---------------------------------------------------------------------------

class _Scenario2:
    """Flood with dangerous water, blocked road, elderly victims."""

    @staticmethod
    def request():
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_HIGH_001",
                type=IncidentType.FLOOD,
                latitude=INCIDENT_LAT,
                longitude=INCIDENT_LON,
                victim_count=4,
                elderly_count=2,
                children_count=1,
                water_level=Observation(value=2.5),
                rainfall=Observation(value=130.0),
                road_access=RoadAccessStatus.BLOCKED,
            ),
            resources=[
                Resource(
                    id="BOAT_201",
                    type=ResourceType.RESCUE_BOAT,
                    status=ResourceStatus.AVAILABLE,
                    latitude=INCIDENT_LAT + 0.05,
                    longitude=INCIDENT_LON - 0.03,
                ),
                Resource(
                    id="TEAM_201",
                    type=ResourceType.RESCUE_TEAM,
                    status=ResourceStatus.AVAILABLE,
                    latitude=INCIDENT_LAT - 0.04,
                    longitude=INCIDENT_LON + 0.02,
                ),
            ],
            hospitals=[
                Hospital(
                    id="HOSP_02", name="Riverside Trauma Center",
                    latitude=INCIDENT_LAT + 0.1, longitude=INCIDENT_LON + 0.1,
                    total_beds=150, available_beds=12,
                ),
            ],
            environment=Environment(
                general_weather="Heavy rain storm",
                rainfall_trend_mm_per_hour=8.0,
                water_level_trend_m_per_hour=0.3,
            ),
        )


# ---------------------------------------------------------------------------
# SCENARIO 3: Multiple victims with rising water
# ---------------------------------------------------------------------------

class _Scenario3:
    """15 victims, rapidly rising water — should trigger CRITICAL."""

    @staticmethod
    def request():
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_MASS_001",
                type=IncidentType.FLOOD,
                latitude=INCIDENT_LAT,
                longitude=INCIDENT_LON,
                victim_count=15,
                elderly_count=3,
                children_count=4,
                disabled_count=1,
                water_level=Observation(value=3.0),
                rainfall=Observation(value=200.0),
                road_access=RoadAccessStatus.BLOCKED,
            ),
            resources=[
                Resource(id="BOAT_301", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=INCIDENT_LAT + 0.02, longitude=INCIDENT_LON),
            ],
            environment=Environment(
                general_weather="Cyclone warning",
                rainfall_trend_mm_per_hour=25.0,
                water_level_trend_m_per_hour=1.2,
            ),
        )


# ---------------------------------------------------------------------------
# SCENARIO 4: No ambulance available
# ---------------------------------------------------------------------------

class _Scenario4:
    """Medical emergency but every ambulance is already dispatched."""

    @staticmethod
    def request():
        return DisasterAnalysisRequest(
            incident=Incident(
                id="MED_NO_AMB_001",
                type=IncidentType.MEDICAL,
                latitude=INCIDENT_LAT,
                longitude=INCIDENT_LON,
                victim_count=2,
                elderly_count=1,
            ),
            resources=[
                Resource(id="AMB_401", type=ResourceType.AMBULANCE,
                         status=ResourceStatus.DISPATCHED,
                         latitude=INCIDENT_LAT + 0.1, longitude=INCIDENT_LON),
                Resource(id="AMB_402", type=ResourceType.AMBULANCE,
                         status=ResourceStatus.MAINTENANCE,
                         latitude=INCIDENT_LAT - 0.1, longitude=INCIDENT_LON),
            ],
            hospitals=[
                Hospital(id="HOSP_04", name="Metro Hospital",
                         latitude=INCIDENT_LAT, longitude=INCIDENT_LON + 0.05,
                         total_beds=100, available_beds=30),
            ],
        )


# ---------------------------------------------------------------------------
# SCENARIO 5: Hospital / resource limitation
# ---------------------------------------------------------------------------

class _Scenario5:
    """Fire incident — only a medical team available (incompatible), no hospitals."""

    @staticmethod
    def request():
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FIRE_LIM_001",
                type=IncidentType.FIRE,
                latitude=INCIDENT_LAT,
                longitude=INCIDENT_LON,
                victim_count=3,
            ),
            resources=[
                Resource(id="MED_TEAM_501", type=ResourceType.MEDICAL_TEAM,
                         status=ResourceStatus.AVAILABLE,
                         latitude=INCIDENT_LAT + 0.02, longitude=INCIDENT_LON),
            ],
            hospitals=[],
        )


# ---------------------------------------------------------------------------
# SCENARIO 7: Missing rainfall/water data
# ---------------------------------------------------------------------------

class _Scenario7:
    """Flood incident with no rainfall, no water_level, no environment block."""

    @staticmethod
    def request():
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_MISSING_001",
                type=IncidentType.FLOOD,
                latitude=INCIDENT_LAT,
                longitude=INCIDENT_LON,
                victim_count=3,
                # water_level = None, rainfall = None
            ),
            resources=[
                Resource(id="BOAT_701", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=INCIDENT_LAT + 0.01, longitude=INCIDENT_LON),
            ],
            # No environment block at all
        )


# ---------------------------------------------------------------------------
# SCENARIO 8: Prediction indicates worsening risk
# ---------------------------------------------------------------------------

class _Scenario8:
    """Medium-risk flood with rapidly worsening environmental trends."""

    @staticmethod
    def request():
        return DisasterAnalysisRequest(
            incident=Incident(
                id="FLOOD_WORSEN_001",
                type=IncidentType.FLOOD,
                latitude=INCIDENT_LAT,
                longitude=INCIDENT_LON,
                victim_count=3,
                water_level=Observation(value=1.5),
                rainfall=Observation(value=60.0),
            ),
            resources=[
                Resource(id="BOAT_801", type=ResourceType.RESCUE_BOAT,
                         status=ResourceStatus.AVAILABLE,
                         latitude=INCIDENT_LAT + 0.01, longitude=INCIDENT_LON),
            ],
            environment=Environment(
                rainfall_trend_mm_per_hour=20.0,
                water_level_trend_m_per_hour=0.8,
            ),
        )


# ============================================================================
# SITUATION AGENT TESTS
# ============================================================================

class TestSituationAgent:
    """Tests SituationAgent in isolation with realistic data."""

    @pytest.fixture
    def agent(self):
        return SituationAgent()

    # --- Scenario 1: Normal medical ---
    def test_s1_normal_medical(self, agent):
        state = DisasterAnalysisState(request=_Scenario1.request())
        result = agent.analyze(state).situation

        assert result.is_valid is True
        assert result.normalized_incident_type == "MEDICAL"
        assert result.severity_assessment == "HIGH"  # 1 victim → HIGH
        # road_access is OPEN, MEDICAL has no flood-specific checks → full confidence
        assert result.confidence_score == 1.0
        assert "MEDICAL" in result.summary
        assert "Clear sky" in result.summary

    # --- Scenario 2: High-priority flood with elderly ---
    def test_s2_flood_elderly(self, agent):
        state = DisasterAnalysisState(request=_Scenario2.request())
        result = agent.analyze(state).situation

        assert result.is_valid is True
        assert result.normalized_incident_type == "FLOOD"
        assert result.severity_assessment == "CRITICAL"  # weather escalates HIGH → CRITICAL
        assert result.confidence_score == 1.0  # all data present
        assert len(result.missing_information) == 0
        assert "Heavy rain storm" in result.summary
        assert "vulnerable" in result.vulnerable_population_impact.lower()

    # --- Scenario 3: Multiple victims mass casualty ---
    def test_s3_mass_flood(self, agent):
        state = DisasterAnalysisState(request=_Scenario3.request())
        result = agent.analyze(state).situation

        assert result.is_valid is True
        assert result.severity_assessment == "CRITICAL"  # 15 victims > 10
        assert "15 victims" in result.summary

    # --- Scenario 7: Missing environmental data ---
    def test_s7_missing_flood_data(self, agent):
        state = DisasterAnalysisState(request=_Scenario7.request())
        result = agent.analyze(state).situation

        assert result.is_valid is True
        assert "water_level" not in result.missing_information
        assert "rainfall" not in result.missing_information
        assert "road_access" in result.missing_information
        assert result.confidence_score == 0.9

        # Check structured warnings were attached
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.MISSING_ENVIRONMENT_DATA for w in warnings)
        assert any(w.code == WarningCode.EMPTY_HOSPITAL_LIST for w in warnings)


# ============================================================================
# RISK AGENT TESTS
# ============================================================================

class TestRiskAgent:
    """Tests RiskAgent in isolation with realistic data."""

    @pytest.fixture
    def agent(self):
        return RiskAgent(use_ml=False)

    # --- Scenario 1: Normal medical → LOW / P4 ---
    def test_s1_medical_risk(self, agent):
        state = DisasterAnalysisState(request=_Scenario1.request())
        result = agent.analyze(state).risk

        # 1 victim × 5 = 5 points → <10 → P5_MONITOR
        assert result.priority == Priority.P5_MONITOR
        assert result.risk_level == RiskLevel.LOW
        assert result.score == 5.0

    # --- Scenario 2: High-priority flood → CRITICAL ---
    def test_s2_flood_elderly_risk(self, agent):
        state = DisasterAnalysisState(request=_Scenario2.request())
        result = agent.analyze(state).risk

        # 4 victims × 5 = 20 (capped component)
        # 3 vulnerable × 10 = 30
        # water_level 2.5 > 2.0 → +30
        # rainfall 130 > 100 → +20
        # road BLOCKED → +15
        # Total: 20 + 30 + 30 + 20 + 15 = 115 → capped at 100
        assert result.score == 100.0
        assert result.priority == Priority.P1_CRITICAL
        assert result.risk_level == RiskLevel.CRITICAL
        assert result.confidence == 1.0
        assert any("dangerously high water level" in r.lower() for r in result.reasons)
        assert any("vulnerable individuals" in r.lower() for r in result.reasons)

    # --- Scenario 3: Mass casualty flood → CRITICAL ---
    def test_s3_mass_risk(self, agent):
        state = DisasterAnalysisState(request=_Scenario3.request())
        result = agent.analyze(state).risk

        assert result.priority == Priority.P1_CRITICAL
        assert result.risk_level == RiskLevel.CRITICAL
        assert result.score == 100.0

    # --- Scenario 4: Medical with no resources → still scored ---
    def test_s4_medical_risk_is_independent_of_resources(self, agent):
        """Risk score depends on incident, not on resource availability."""
        state = DisasterAnalysisState(request=_Scenario4.request())
        result = agent.analyze(state).risk

        # 2 victims × 5 = 10, 1 elderly × 10 = 10 → total 20
        # rainfall None → -0.1 confidence
        assert result.score == 20.0
        assert result.priority == Priority.P4_LOW
        assert result.confidence == 0.9

    # --- Scenario 7: Missing data reduces confidence ---
    def test_s7_missing_data_confidence(self, agent):
        state = DisasterAnalysisState(request=_Scenario7.request())
        result = agent.analyze(state).risk

        # FLOOD with no water_level → -0.2, no rainfall → -0.1
        assert result.confidence == 0.7


# ============================================================================
# PREDICTIVE AGENT TESTS
# ============================================================================

class TestPredictiveAgent:
    """Tests PredictiveAgent in isolation with realistic data."""

    @pytest.fixture
    def agent(self):
        return PredictiveAgent()

    def _risk(self, level):
        """Build a lightweight risk result for prediction input."""
        return RiskResult(
            priority=Priority.P3_MEDIUM,
            risk_level=level,
            severity=level.value,
            score=50.0,
            reasons=["test"],
            confidence=1.0,
        )

    # --- Scenario 2: Moderate increase with environment data ---
    def test_s2_moderate_worsening(self, agent):
        req = _Scenario2.request()
        risk = self._risk(RiskLevel.HIGH)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).prediction

        assert result.current_risk == RiskLevel.HIGH
        # rainfall 8 mm/hr < 10 → +0.5, water 0.3 m/hr < 0.5 → +0.5 → trend = 1.0
        # At 60 min: 3 + 1.0*1.0 = 4 → CRITICAL
        assert result.escalation_detected is True
        assert result.forecast[-1].risk_level == RiskLevel.CRITICAL
        assert result.confidence == 1.0

    # --- Scenario 3: Rapid escalation ---
    def test_s3_rapid_escalation(self, agent):
        req = _Scenario3.request()
        risk = self._risk(RiskLevel.CRITICAL)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).prediction

        assert result.current_risk == RiskLevel.CRITICAL
        # Already critical — can't go higher, stays CRITICAL in forecast
        for item in result.forecast:
            assert item.risk_level == RiskLevel.CRITICAL

    # --- Scenario 7: No environment → low confidence ---
    def test_s7_no_environment(self, agent):
        req = _Scenario7.request()
        risk = self._risk(RiskLevel.MEDIUM)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).prediction

        assert result.confidence == 0.5
        assert result.escalation_detected is False
        assert "no environmental data" in result.explanation[0].lower()

        # Warning attached
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.MISSING_ENVIRONMENT_DATA for w in warnings)

    # --- Scenario 8: Worsening trends → escalation ---
    def test_s8_worsening_prediction(self, agent):
        req = _Scenario8.request()
        risk = self._risk(RiskLevel.MEDIUM)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).prediction

        # rainfall 20 > 10 → +1.0, water 0.8 > 0.5 → +1.5 → trend = 2.5
        # At 60 min: 2 + 2.5*1.0 = 4.5 → capped 4 → CRITICAL
        assert result.escalation_detected is True
        assert result.forecast[-1].risk_level == RiskLevel.CRITICAL
        assert any("heavily increasing" in e.lower() for e in result.explanation)
        assert any("rising rapidly" in e.lower() for e in result.explanation)
        assert result.confidence == 1.0


# ============================================================================
# RESOURCE AGENT TESTS
# ============================================================================

class TestResourceAgent:
    """Tests ResourceAgent in isolation with realistic data."""

    @pytest.fixture
    def agent(self):
        return ResourceAgent()

    def _risk(self, priority):
        return RiskResult(
            priority=priority,
            risk_level=RiskLevel.HIGH,
            severity="HIGH",
            score=60.0,
            reasons=["test"],
            confidence=1.0,
        )

    # --- Scenario 1: Normal ambulance dispatch ---
    def test_s1_ambulance_dispatched(self, agent):
        req = _Scenario1.request()
        risk = self._risk(Priority.P4_LOW)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).resource_assignments

        assert len(result.assignments) == 1
        assert result.assignments[0].resource_id == "AMB_101"
        assert result.assignments[0].action == "DISPATCH_TO_INCIDENT"
        assert len(result.unfulfilled_requirements) == 0

    # --- Scenario 2: Boat dispatched to flood ---
    def test_s2_boat_to_flood(self, agent):
        req = _Scenario2.request()
        risk = self._risk(Priority.P1_CRITICAL)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).resource_assignments

        # At least one compatible resource assigned (boat or rescue team)
        assert len(result.assignments) >= 1
        assigned_ids = [a.resource_id for a in result.assignments]
        assert "BOAT_201" in assigned_ids or "TEAM_201" in assigned_ids

    # --- Scenario 4: No ambulance available ---
    def test_s4_no_ambulance(self, agent):
        req = _Scenario4.request()
        risk = self._risk(Priority.P2_HIGH)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).resource_assignments

        assert len(result.assignments) == 0
        assert "MED_NO_AMB_001" in result.unfulfilled_requirements

        # Structured warning present
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code in (WarningCode.NO_AVAILABLE_RESOURCE, WarningCode.NO_SUITABLE_RESOURCE)
                    for w in warnings)

    # --- Scenario 5: Incompatible resource for fire ---
    def test_s5_incompatible_resource(self, agent):
        req = _Scenario5.request()
        risk = self._risk(Priority.P2_HIGH)

        state = DisasterAnalysisState(request=req)
        state.risk = risk
        result = agent.analyze(state).resource_assignments

        assert len(result.assignments) == 0
        assert "FIRE_LIM_001" in result.unfulfilled_requirements

        # Empty hospital warning
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.EMPTY_HOSPITAL_LIST for w in warnings)
        assert any(w.code == WarningCode.NO_SUITABLE_RESOURCE for w in warnings)

    # --- Scenario 9: Multiple incidents compete ---
    def test_s9_competing_incidents(self):
        """Directly tests optimization with two incidents and limited resources."""
        optimizer = OptimizationService()

        inc_critical = Incident(
            id="INC_CRIT_901", type=IncidentType.FIRE,
            latitude=INCIDENT_LAT, longitude=INCIDENT_LON, victim_count=10,
        )
        inc_low = Incident(
            id="INC_LOW_902", type=IncidentType.FIRE,
            latitude=INCIDENT_LAT + 1.0, longitude=INCIDENT_LON + 1.0, victim_count=1,
        )
        fire_truck = Resource(
            id="FTRUCK_901", type=ResourceType.FIRE_TRUCK,
            status=ResourceStatus.AVAILABLE,
            latitude=INCIDENT_LAT + 0.1, longitude=INCIDENT_LON + 0.1,
        )

        result = optimizer.optimize_dispatch(
            incidents=[
                (inc_critical, Priority.P1_CRITICAL.value),
                (inc_low, Priority.P5_MONITOR.value),
            ],
            resources=[fire_truck],
        )

        assert len(result["assignments"]) == 1
        # The critical incident must be served first
        assert result["assignments"][0]["incident"].id == "INC_CRIT_901"
        assert "INC_LOW_902" in [u.id for u in result["unfulfilled_incidents"]]


# ============================================================================
# ROUTE AGENT TESTS
# ============================================================================

class TestRouteAgent:
    """Tests RouteAgent in isolation — always mocking OSRM."""

    @pytest.fixture
    def agent(self):
        return RouteAgent()

    # --- Scenario 1: OSRM success ---
    @patch('app.services.routing_service.requests.get')
    def test_s1_successful_route(self, mock_get, agent):
        mock_get.return_value = _osrm_success_mock()

        result = agent.analyze(
            resource_id="AMB_101",
            destination_id="MED_001",
            origin_lat=INCIDENT_LAT + 0.01,
            origin_lon=INCIDENT_LON + 0.01,
            dest_lat=INCIDENT_LAT,
            dest_lon=INCIDENT_LON,
        )

        assert result.route_status == RoadAccessStatus.OPEN
        assert result.distance_km == 8.2
        assert result.estimated_time_mins == 12.0
        assert "Reason: Shortest currently valid route" in result.explanation

    # --- Scenario 6: OSRM unavailable → graceful fallback ---
    @patch('app.services.routing_service.requests.get')
    def test_s6_osrm_connection_error(self, mock_get, agent):
        mock_get.side_effect = requests.exceptions.ConnectionError("OSRM down")

        result = agent.analyze(
            resource_id="BOAT_201",
            destination_id="FLOOD_HIGH_001",
            origin_lat=INCIDENT_LAT + 0.05,
            origin_lon=INCIDENT_LON - 0.03,
            dest_lat=INCIDENT_LAT,
            dest_lon=INCIDENT_LON,
        )

        assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
        assert result.distance_km > 0  # straight-line fallback
        assert "FALLBACK" in result.explanation

        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.OSRM_UNAVAILABLE for w in warnings)

    # --- Scenario 6: OSRM timeout ---
    @patch('app.services.routing_service.requests.get')
    def test_s6_osrm_timeout(self, mock_get, agent):
        mock_get.side_effect = requests.exceptions.Timeout("Read timed out")

        result = agent.analyze(
            resource_id="AMB_101",
            destination_id="MED_001",
            origin_lat=INCIDENT_LAT,
            origin_lon=INCIDENT_LON,
            dest_lat=INCIDENT_LAT + 0.1,
            dest_lon=INCIDENT_LON + 0.1,
        )

        assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.OSRM_UNAVAILABLE for w in warnings)

    # --- Invalid coordinates ---
    def test_none_coordinates(self, agent):
        result = agent.analyze(
            resource_id="RES_NONE",
            destination_id="INC_1",
            origin_lat=None, origin_lon=None,
            dest_lat=INCIDENT_LAT, dest_lon=INCIDENT_LON,
        )

        assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
        assert result.distance_km == 0.0
        warnings = getattr(result, '_pipeline_warnings', [])
        assert any(w.code == WarningCode.INVALID_COORDINATES for w in warnings)


# ============================================================================
# MASTER COORDINATOR TESTS
# ============================================================================

class TestMasterCoordinator:
    """
    Tests the full pipeline orchestration end-to-end at the Python level.
    OSRM is always mocked.
    """

    @pytest.fixture
    def coordinator(self):
        return __import__('app.agents.master_coordinator', fromlist=['MasterCoordinator']).MasterCoordinator(use_ml_risk=False)

    # --- Scenario 1: Normal medical pipeline ---
    @patch('app.services.routing_service.requests.get')
    def test_s1_full_medical_pipeline(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        plan = coordinator.analyze(_Scenario1.request())

        assert plan.incident_id == "MED_001"
        assert plan.situation is not None
        assert plan.situation.is_valid is True
        assert plan.risk is not None
        assert plan.risk.priority == Priority.P5_MONITOR
        assert plan.prediction is not None
        assert len(plan.assignments) == 1
        assert plan.assignments[0].resource_id == "AMB_101"
        assert plan.assignments[0].route.route_status == RoadAccessStatus.OPEN
        assert plan.recommended_action == RecommendedAction.MONITOR
        assert plan.degraded is False

    # --- Scenario 2: High-priority flood → IMMEDIATE_DISPATCH ---
    @patch('app.services.routing_service.requests.get')
    def test_s2_critical_flood_immediate_dispatch(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        plan = coordinator.analyze(_Scenario2.request())

        assert plan.incident_id == "FLOOD_HIGH_001"
        assert plan.risk.risk_level == RiskLevel.CRITICAL
        assert plan.recommended_action == RecommendedAction.IMMEDIATE_DISPATCH
        assert plan.situation.severity_assessment == "CRITICAL"
        assert len(plan.assignments) >= 1
        assert plan.autonomy_decision.human_review_required is True

    # --- Scenario 3: Mass casualty flood ---
    @patch('app.services.routing_service.requests.get')
    def test_s3_mass_flood_critical(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        plan = coordinator.analyze(_Scenario3.request())

        assert plan.risk.risk_level == RiskLevel.CRITICAL
        assert plan.risk.score == 100.0
        assert plan.recommended_action == RecommendedAction.IMMEDIATE_DISPATCH
        # Already at CRITICAL, can't escalate further — may or may not detect
        assert plan.prediction is not None

    # --- Scenario 4: No ambulance → degraded but still returns plan ---
    @patch('app.services.routing_service.requests.get')
    def test_s4_no_ambulance_graceful(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        plan = coordinator.analyze(_Scenario4.request())

        assert plan.incident_id == "MED_NO_AMB_001"
        assert plan.situation is not None
        assert plan.risk is not None
        assert len(plan.assignments) == 0
        # Warning about unavailable resources
        assert any(w.code in (WarningCode.NO_AVAILABLE_RESOURCE, WarningCode.NO_SUITABLE_RESOURCE)
                    for w in plan.warnings)

    # --- Scenario 5: Incompatible resource + no hospital ---
    @patch('app.services.routing_service.requests.get')
    def test_s5_resource_limitation(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        plan = coordinator.analyze(_Scenario5.request())

        assert plan.incident_id == "FIRE_LIM_001"
        assert len(plan.assignments) == 0
        assert any(w.code == WarningCode.EMPTY_HOSPITAL_LIST for w in plan.warnings)
        assert any(w.code == WarningCode.NO_SUITABLE_RESOURCE for w in plan.warnings)

    # --- Scenario 6: OSRM down → plan still works ---
    @patch('app.services.routing_service.requests.get')
    def test_s6_osrm_unavailable(self, mock_get, coordinator):
        mock_get.side_effect = requests.exceptions.ConnectionError("OSRM down")

        req = _Scenario2.request()
        plan = coordinator.analyze(req)

        assert plan.incident_id == "FLOOD_HIGH_001"
        assert plan.situation is not None
        assert plan.risk is not None
        assert plan.prediction is not None
        assert len(plan.assignments) >= 1

        # Route should be UNAVAILABLE with fallback distance
        for assignment in plan.assignments:
            assert assignment.route.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
            assert assignment.route.distance_km > 0

        assert any(w.code == WarningCode.OSRM_UNAVAILABLE for w in plan.warnings)
        assert plan.degraded is True

    # --- Scenario 7: Missing data → reduced confidence ---
    @patch('app.services.routing_service.requests.get')
    def test_s7_missing_data_pipeline(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        plan = coordinator.analyze(_Scenario7.request())

        assert plan.incident_id == "FLOOD_MISSING_001"
        assert plan.situation.confidence_score < 1.0
        assert plan.risk.confidence < 1.0
        assert plan.prediction.confidence < 1.0

        # All data-related warnings present
        assert any(w.code == WarningCode.INCOMPLETE_INCIDENT for w in plan.warnings)
        assert any(w.code == WarningCode.MISSING_ENVIRONMENT_DATA for w in plan.warnings)

    # --- Scenario 8: Worsening trends → escalation affects action ---
    @patch('app.services.routing_service.requests.get')
    def test_s8_worsening_trends(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        plan = coordinator.analyze(_Scenario8.request())

        assert plan.prediction is not None
        assert plan.prediction.escalation_detected is True
        # Risk is HIGH (score ~55) + escalation → should be IMMEDIATE_DISPATCH or DISPATCH
        assert plan.recommended_action in (
            RecommendedAction.IMMEDIATE_DISPATCH,
            RecommendedAction.DISPATCH,
            RecommendedAction.PRE_POSITION,
        )
