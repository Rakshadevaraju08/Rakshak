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
    RoadAccessStatus,
    TraceStepStatus
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
def test_successful_pipeline_trace(mock_get):
    """
    Ensures that a successful pipeline run generates a full trace
    with execution times and correct statuses.
    """
    mock_get.return_value = _osrm_success_mock()
    
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="TEST_OBS_1",
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
    
    # Assert Trace Exists
    assert plan.trace is not None
    assert plan.trace.trace_id is not None
    assert plan.trace.total_execution_time_ms is not None
    assert plan.trace.total_execution_time_ms > 0
    
    # Assert Steps were captured
    step_names = [s.step_name for s in plan.trace.steps]
    expected_steps = [
        "Request Received",
        "Data Quality Analysis",
        "Situation Analysis",
        "Risk Analysis",
        "Predictive Analysis",
        "Resource Analysis",
        "Route Analysis",
        "Plan Validation",
        "Safety Check",
        "Autonomy Decision"
    ]
    for step in expected_steps:
        assert step in step_names
        
    # Check all are completed
    for step in plan.trace.steps:
        assert step.status == TraceStepStatus.COMPLETED
        assert step.execution_time_ms is not None
        assert step.execution_time_ms >= 0

@patch("app.agents.predictive_agent.PredictiveAgent.analyze")
def test_degraded_pipeline_trace(mock_predictive_analyze):
    """
    Ensures that if an optional agent fails, the trace captures it as FAILED,
    but the pipeline continues and other steps complete.
    """
    from app.errors import AgentError, WarningCode
    
    # Simulate a hard crash in Predictive Agent
    mock_predictive_analyze.side_effect = Exception("Simulated DB timeout")
    
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="TEST_OBS_2",
            type=IncidentType.FIRE,
            latitude=10.0,
            longitude=20.0,
            victim_count=0,
            road_access=RoadAccessStatus.OPEN
        ),
        resources=[]
    )
    
    coordinator = MasterCoordinator(use_ml_risk=False)
    plan = coordinator.analyze(request)
    
    # Assert Trace Exists
    assert plan.trace is not None
    
    # Find the predictive step
    pred_step = next(s for s in plan.trace.steps if s.step_name == "Predictive Analysis")
    assert pred_step.status == TraceStepStatus.FAILED
    
    # Find subsequent steps (e.g. Autonomy) which should still be COMPLETED
    auto_step = next(s for s in plan.trace.steps if s.step_name == "Autonomy Decision")
    assert auto_step.status == TraceStepStatus.COMPLETED
    
    # Plan should be marked degraded
    assert plan.degraded is True
