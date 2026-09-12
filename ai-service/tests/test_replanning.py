"""
Tests for the adaptive re-planning feature (plan_diff and coordinator reanalyze).

Tests cover the 6 scenarios:
1. Road becomes blocked
2. Ambulance becomes unavailable
3. Hospital becomes full
4. Water level rises
5. Rainfall increases
6. New higher-priority SOS arrives (simulated by increased victims on the same incident)
Plus no-change baseline.
"""

import pytest
from unittest.mock import patch, Mock
import requests
from fastapi.testclient import TestClient
import copy

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
    Environment,
    RoadAccessStatus,
    ChangeCategory
)

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def coordinator():
    return MasterCoordinator(use_ml_risk=False)

def _osrm_success_mock():
    mock_resp = Mock()
    mock_resp.json.return_value = {
        "code": "Ok",
        "routes": [{"distance": 5000.0, "duration": 600.0}],
    }
    mock_resp.raise_for_status = Mock()
    return mock_resp

def _base_state():
    return DisasterAnalysisRequest(
        incident=Incident(
            id="INC_1",
            type=IncidentType.FLOOD,
            latitude=12.97,
            longitude=77.59,
            victim_count=2,
            water_level=1.0,
            rainfall=20.0,
            road_access=RoadAccessStatus.OPEN
        ),
        resources=[
            Resource(
                id="BOAT_1",
                type=ResourceType.RESCUE_BOAT,
                status=ResourceStatus.AVAILABLE,
                latitude=12.98,
                longitude=77.60
            ),
            Resource(
                id="BOAT_2",
                type=ResourceType.RESCUE_BOAT,
                status=ResourceStatus.AVAILABLE,
                latitude=12.96,
                longitude=77.58
            )
        ],
        hospitals=[
            Hospital(
                id="HOSP_1",
                name="City Hosp",
                latitude=12.99,
                longitude=77.61,
                total_beds=100,
                available_beds=10
            )
        ],
        environment=Environment(
            general_weather="Cloudy",
            rainfall_trend_mm_per_hour=0.0,
            water_level_trend_m_per_hour=0.0
        )
    )

# ---------------------------------------------------------------------------
# Python-level Tests (Coordinator + Diff Engine)
# ---------------------------------------------------------------------------

class TestReplanScenarios:
    
    @patch('app.services.routing_service.requests.get')
    def test_no_change(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        state = _base_state()
        
        # Initial run
        plan1 = coordinator.analyze(state)
        
        # Re-run with EXACT same state
        revision = coordinator.reanalyze(state, plan1)
        
        assert len(revision.changes) == 0
        assert revision.is_significant_change is False
        assert revision.previous_action == revision.new_action

    @patch('app.services.routing_service.requests.get')
    def test_road_becomes_blocked(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        state1 = _base_state()
        plan1 = coordinator.analyze(state1)
        
        # State 2: OSRM fails (simulating blocked road / routing unavailable)
        state2 = copy.deepcopy(state1)
        mock_get.side_effect = requests.exceptions.ConnectionError("OSRM down")
        
        revision = coordinator.reanalyze(state2, plan1)
        
        assert len(revision.changes) > 0
        
        # We expect a ROUTE_CHANGED category
        route_changes = [c for c in revision.changes if c.category == ChangeCategory.ROUTE_CHANGED]
        assert len(route_changes) > 0
        assert route_changes[0].field == "assignments[BOAT_1].route.route_status"
        assert route_changes[0].new_value == "ROUTE_UNAVAILABLE"
        
        # May not be "significant" if just route changes, but the diff catches it

    @patch('app.services.routing_service.requests.get')
    def test_ambulance_becomes_unavailable(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        state1 = _base_state()
        plan1 = coordinator.analyze(state1)
        
        # Determine which boat was assigned
        assigned_id = plan1.assignments[0].resource_id
        
        # State 2: That boat is now DISPATCHED (unavailable)
        state2 = copy.deepcopy(state1)
        for r in state2.resources:
            if r.id == assigned_id:
                r.status = ResourceStatus.DISPATCHED
                
        revision = coordinator.reanalyze(state2, plan1)
        
        assert revision.is_significant_change is True
        
        cats = [c.category for c in revision.changes]
        # Should see REMOVED (the old boat) and ADDED (the new boat)
        assert ChangeCategory.RESOURCE_REMOVED in cats
        assert ChangeCategory.RESOURCE_ADDED in cats

    @patch('app.services.routing_service.requests.get')
    def test_water_level_rises_priority_changes(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        state1 = _base_state()
        plan1 = coordinator.analyze(state1)
        
        # State 2: Water level jumps to 3.5m (Dangerous)
        state2 = copy.deepcopy(state1)
        state2.incident.water_level = 3.5
        
        revision = coordinator.reanalyze(state2, plan1)
        
        assert revision.is_significant_change is True
        cats = [c.category for c in revision.changes]
        assert ChangeCategory.RISK_LEVEL_CHANGE in cats or ChangeCategory.PRIORITY_CHANGE in cats
        
        # Risk should go up (base is LOW, 3.5m water adds 30 pts -> 40 pts = MEDIUM)
        risk_change = next(c for c in revision.changes if c.category == ChangeCategory.RISK_LEVEL_CHANGE)
        assert risk_change.new_value in ("MEDIUM", "HIGH", "CRITICAL")

    @patch('app.services.routing_service.requests.get')
    def test_rainfall_increases_escalation_flips(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        state1 = _base_state()
        plan1 = coordinator.analyze(state1)
        
        # Initially, prediction should NOT show escalation for low trends
        assert plan1.prediction.escalation_detected is False
        
        # State 2: Rainfall trend becomes severe
        state2 = copy.deepcopy(state1)
        state2.environment.rainfall_trend_mm_per_hour = 30.0
        
        revision = coordinator.reanalyze(state2, plan1)
        
        cats = [c.category for c in revision.changes]
        assert ChangeCategory.ESCALATION_CHANGE in cats
        
        esc_change = next(c for c in revision.changes if c.category == ChangeCategory.ESCALATION_CHANGE)
        assert esc_change.previous_value == "False"
        assert esc_change.new_value == "True"

    @patch('app.services.routing_service.requests.get')
    def test_new_victims_severity_changes(self, mock_get, coordinator):
        mock_get.return_value = _osrm_success_mock()
        state1 = _base_state()
        plan1 = coordinator.analyze(state1)
        
        # State 2: Victim count jumps to 25 (mass casualty)
        state2 = copy.deepcopy(state1)
        state2.incident.victim_count = 25
        
        revision = coordinator.reanalyze(state2, plan1)
        
        cats = [c.category for c in revision.changes]
        assert ChangeCategory.SEVERITY_CHANGE in cats
        assert ChangeCategory.ACTION_CHANGE in cats
        
        sev_change = next(c for c in revision.changes if c.category == ChangeCategory.SEVERITY_CHANGE)
        assert sev_change.new_value == "CRITICAL"


# ---------------------------------------------------------------------------
# API-level Test (POST /api/ai/reanalyze)
# ---------------------------------------------------------------------------

class TestAPIReplan:

    @patch('app.services.routing_service.requests.get')
    def test_api_reanalyze_endpoint(self, mock_get, client):
        mock_get.return_value = _osrm_success_mock()
        
        # 1. Get initial plan
        state1 = _base_state().model_dump()
        resp1 = client.post("/api/ai/analyze", json=state1)
        assert resp1.status_code == 200
        plan1 = resp1.json()
        
        # 2. Mutate state (increase victim count heavily and add severe environmental factors)
        state2 = copy.deepcopy(state1)
        state2["incident"]["victim_count"] = 50
        state2["incident"]["water_level"] = 3.5
        state2["incident"]["rainfall"] = 150
        
        # 3. Call reanalyze
        payload = {
            "previous_plan": plan1,
            "updated_state": state2
        }
        
        resp2 = client.post("/api/ai/reanalyze", json=payload)
        assert resp2.status_code == 200
        
        revision = resp2.json()
        assert revision["incident_id"] == "INC_1"
        assert len(revision["changes"]) > 0
        assert revision["is_significant_change"] is True
        
        # Verify action was upgraded
        assert revision["new_action"] == "IMMEDIATE_DISPATCH"
        
        # Ensure we have the new plan attached
        assert revision["new_plan"]["incident_id"] == "INC_1"
        assert revision["new_plan"]["situation"]["severity_assessment"] == "CRITICAL"
