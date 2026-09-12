import pytest
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Resource,
    ResourceType,
    ResourceStatus,
    Priority
)
from app.agents.resource_agent import ResourceAgent
from app.services.optimization_service import OptimizationService
from app.errors import WarningCode

@pytest.fixture
def agent():
    return ResourceAgent()

@pytest.fixture
def optimizer():
    return OptimizationService()

class DummyRiskResult:
    def __init__(self, priority):
        self.priority = priority

def test_one_incident_one_ambulance(agent):
    """Test assigning one ambulance to one medical incident."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_MED",
            type=IncidentType.MEDICAL,
            latitude=10.0,
            longitude=20.0
        ),
        resources=[
            Resource(id="AMB_1", type=ResourceType.AMBULANCE, status=ResourceStatus.AVAILABLE, latitude=10.1, longitude=20.1)
        ]
    )
    risk = DummyRiskResult(Priority.P2_HIGH)
    
    result = agent.analyze(request, risk)
    assert len(result.assignments) == 1
    assert result.assignments[0].resource_id == "AMB_1"
    assert len(result.unfulfilled_requirements) == 0

def test_unavailable_resource(agent):
    """Test that dispatched or maintenance resources are ignored."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_FIRE",
            type=IncidentType.FIRE,
            latitude=10.0,
            longitude=20.0
        ),
        resources=[
            Resource(id="FIRE_1", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.DISPATCHED, latitude=10.1, longitude=20.1),
            Resource(id="FIRE_2", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.MAINTENANCE, latitude=10.1, longitude=20.1)
        ]
    )
    risk = DummyRiskResult(Priority.P1_CRITICAL)
    
    result = agent.analyze(request, risk)
    assert len(result.assignments) == 0
    assert "INC_FIRE" in result.unfulfilled_requirements

    # Verify structured warnings
    warnings = getattr(result, '_pipeline_warnings', [])
    assert any(w.code in (WarningCode.NO_AVAILABLE_RESOURCE, WarningCode.NO_SUITABLE_RESOURCE) for w in warnings)

def test_incompatible_resource(agent):
    """Test that a medical team won't be dispatched to put out a fire."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_FIRE",
            type=IncidentType.FIRE,
            latitude=10.0,
            longitude=20.0
        ),
        resources=[
            Resource(id="MED_1", type=ResourceType.MEDICAL_TEAM, status=ResourceStatus.AVAILABLE, latitude=10.1, longitude=20.1)
        ]
    )
    risk = DummyRiskResult(Priority.P2_HIGH)
    
    result = agent.analyze(request, risk)
    assert len(result.assignments) == 0
    assert "INC_FIRE" in result.unfulfilled_requirements

    # Verify structured warning for unfulfilled
    warnings = getattr(result, '_pipeline_warnings', [])
    assert any(w.code == WarningCode.NO_SUITABLE_RESOURCE for w in warnings)

def test_multiple_incidents_multiple_resources(optimizer):
    """Test optimization logic directly for multiple incidents."""
    incidents = [
        (Incident(id="INC_1", type=IncidentType.FIRE, latitude=10.0, longitude=20.0), Priority.P1_CRITICAL.value),
        (Incident(id="INC_2", type=IncidentType.FLOOD, latitude=15.0, longitude=25.0), Priority.P2_HIGH.value)
    ]
    resources = [
        Resource(id="RES_FIRE", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.AVAILABLE, latitude=10.5, longitude=20.5),
        Resource(id="RES_BOAT", type=ResourceType.RESCUE_BOAT, status=ResourceStatus.AVAILABLE, latitude=14.5, longitude=24.5)
    ]
    
    result = optimizer.optimize_dispatch(incidents, resources)
    
    assert len(result["assignments"]) == 2
    assigned_res_ids = [a["resource"].id for a in result["assignments"]]
    assert "RES_FIRE" in assigned_res_ids
    assert "RES_BOAT" in assigned_res_ids
    assert len(result["unfulfilled_incidents"]) == 0

def test_insufficient_resources(optimizer):
    """Test when there are more incidents than available resources."""
    incidents = [
        (Incident(id="INC_1", type=IncidentType.FIRE, latitude=10.0, longitude=20.0), Priority.P1_CRITICAL.value),
        (Incident(id="INC_2", type=IncidentType.FIRE, latitude=15.0, longitude=25.0), Priority.P5_MONITOR.value)
    ]
    # Only 1 fire truck
    resources = [
        Resource(id="RES_FIRE", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.AVAILABLE, latitude=10.5, longitude=20.5),
    ]
    
    result = optimizer.optimize_dispatch(incidents, resources)
    
    assert len(result["assignments"]) == 1
    # Should prioritize the P1_CRITICAL incident
    assert result["assignments"][0]["incident"].id == "INC_1"
    assert "INC_2" in [inc.id for inc in result["unfulfilled_incidents"]]

def test_empty_resources(agent):
    """Test that empty resources list produces structured warning."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_EMPTY",
            type=IncidentType.FIRE,
            latitude=10.0,
            longitude=20.0,
        ),
        resources=[]
    )
    risk = DummyRiskResult(Priority.P2_HIGH)
    
    result = agent.analyze(request, risk)
    assert len(result.assignments) == 0
    warnings = getattr(result, '_pipeline_warnings', [])
    assert any(w.code == WarningCode.MISSING_RESOURCES for w in warnings)
