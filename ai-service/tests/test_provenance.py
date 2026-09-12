import pytest
from unittest.mock import patch
from datetime import datetime

from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Resource,
    ResourceType,
    ResourceStatus,
    RoadAccessStatus
)
from app.agents.master_coordinator import MasterCoordinator

def _osrm_success_mock(*args, **kwargs):
    class MockResponse:
        status_code = 200
        def json(self):
            return {
                "code": "Ok",
                "routes": [{"duration": 600, "distance": 5000, "geometry": "mock_poly"}]
            }
    return MockResponse()

@patch("app.services.routing_service.requests.get")
def test_decision_provenance_integration(mock_get):
    """
    Ensures that the final ResponsePlan correctly surfaces decision_provenance
    from Situation, Risk, Predictive, and Resource agents.
    """
    mock_get.return_value = _osrm_success_mock()
    
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="TEST_PROV_1",
            type=IncidentType.FLOOD,
            latitude=10.0,
            longitude=20.0,
            victim_count=5,
            road_access=RoadAccessStatus.OPEN
        ),
        resources=[
            Resource(
                id="BOAT_1",
                type=ResourceType.RESCUE_BOAT,
                status=ResourceStatus.AVAILABLE,
                latitude=10.1,
                longitude=20.1
            )
        ]
    )
    
    coordinator = MasterCoordinator(use_ml_risk=False)
    plan = coordinator.analyze(request)
    
    # Check Situation Provenance
    assert plan.situation is not None
    assert plan.situation.decision_provenance is not None
    assert plan.situation.decision_provenance.agent == "SituationAgent"
    assert plan.situation.decision_provenance.method == "rule_based_parsing"
    assert "incident_type" in plan.situation.decision_provenance.inputs
    
    # Check Risk Provenance
    assert plan.risk is not None
    assert plan.risk.decision_provenance is not None
    assert plan.risk.decision_provenance.agent == "RiskAgent"
    assert plan.risk.decision_provenance.method == "rule_based"
    assert plan.risk.decision_provenance.confidence > 0
    assert "incident.victim_count" in plan.risk.decision_provenance.inputs
    
    # Check Predictive Provenance
    assert plan.prediction is not None
    assert plan.prediction.decision_provenance is not None
    assert plan.prediction.decision_provenance.agent == "PredictiveAgent"
    assert plan.prediction.decision_provenance.method == "baseline_heuristic"
    
    # Check Resource Provenance
    assert plan.resource_agent_result is not None
    assert plan.resource_agent_result.decision_provenance is not None
    assert plan.resource_agent_result.decision_provenance.agent == "ResourceAgent"
    assert plan.resource_agent_result.decision_provenance.method == "or_tools_optimization"

    # Check Route Provenance
    assert len(plan.assignments) > 0
    assert plan.assignments[0].route.decision_provenance is not None
    assert plan.assignments[0].route.decision_provenance.agent == "RouteAgent"
