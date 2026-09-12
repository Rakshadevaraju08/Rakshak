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
    RecommendedAction
)
from app.agents.master_coordinator import MasterCoordinator

@pytest.fixture
def coordinator():
    return MasterCoordinator()

@patch('app.services.routing_service.requests.get')
def test_full_pipeline_success(mock_get, coordinator):
    """Test the complete orchestration pipeline with all agents working."""
    # Mock Route OSRM
    mock_response = Mock()
    mock_response.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 15000.0,
                "duration": 1200.0
            }
        ]
    }
    mock_response.raise_for_status = Mock()
    mock_get.return_value = mock_response

    request = DisasterAnalysisRequest(
        incident=Incident(id="INC_001", type=IncidentType.FIRE, latitude=10.0, longitude=20.0, victim_count=10),
        resources=[
            Resource(id="FIRE_1", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.AVAILABLE, latitude=10.1, longitude=20.1)
        ]
    )

    plan = coordinator.analyze(request)

    # Validations
    assert plan.incident_id == "INC_001"
    assert plan.situation is not None
    assert plan.risk is not None
    assert plan.prediction is not None
    
    # 10 victims in a fire -> high/critical risk
    assert plan.recommended_action in [RecommendedAction.IMMEDIATE_DISPATCH, RecommendedAction.DISPATCH]
    
    assert len(plan.assignments) == 1
    assert plan.assignments[0].resource_id == "FIRE_1"
    
    # Check that Route Agent was utilized for the assignment
    assert plan.assignments[0].route.distance_km == 15.0

def test_optional_agent_failure(coordinator):
    """Test that a failure in the Predictive Agent is handled gracefully."""
    request = DisasterAnalysisRequest(
        incident=Incident(id="INC_002", type=IncidentType.OTHER, latitude=0.0, longitude=0.0, victim_count=0)
    )

    # Force Predictive Agent to crash
    with patch.object(coordinator.predictive_agent, 'analyze', side_effect=ValueError("Simulated prediction crash")):
        plan = coordinator.analyze(request)

    # Pipeline should still succeed and return a plan
    assert plan.incident_id == "INC_002"
    assert plan.prediction is None
    
    # Warning should be captured
    assert any("Predictive Agent failed" in w for w in plan.warnings)
    
    # Since risk is low and no victims
    assert plan.recommended_action == RecommendedAction.MONITOR
