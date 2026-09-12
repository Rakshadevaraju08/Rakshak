import pytest
from typing import List

from app.schemas.domain import (
    DisasterAnalysisRequest,
    DisasterAnalysisState,
    Incident,
    IncidentType,
    SituationResult,
    RiskResult,
    RiskLevel,
    Priority,
    PredictiveAgentResult,
    ForecastItem,
    ResourceAgentResult,
    ResourceAssignment,
    RouteResult,
    RoadAccessStatus,
    FullResponsePlan,
    RecommendedAction,
    Resource,
    ResourceStatus,
    ResourceType
)
from app.agents.validation import (
    validate_situation,
    validate_risk,
    validate_prediction,
    validate_resources,
    validate_routes,
    validate_coordinator_plan
)
from app.errors import WarningCode

@pytest.fixture
def base_state():
    incident = Incident(
        id="INC_VAL",
        type=IncidentType.FLOOD,
        latitude=10.0,
        longitude=20.0,
        victim_count=10,
        elderly_count=2,
        children_count=1,
        disabled_count=0
    )
    request = DisasterAnalysisRequest(
        incident=incident,
        resources=[],
        hospitals=[],
        roads=[]
    )
    return DisasterAnalysisState(request=request)

def test_validate_situation_negative_victims(base_state):
    base_state.request.incident.victim_count = -5
    base_state.request.incident.elderly_count = -1
    
    result = SituationResult(
        is_valid=True,
        summary="Test",
        severity_assessment="LOW",
        vulnerable_population_impact="None",
        confidence_score=1.0,
        normalized_incident_type="FLOOD"
    )
    
    val_result, warnings = validate_situation(result, base_state)
    
    assert base_state.request.incident.victim_count == 0
    assert any(w.code == WarningCode.MALFORMED_INPUT for w in warnings)
    assert val_result.confidence_score < 1.0


def test_validate_situation_vulnerable_exceeds_total(base_state):
    base_state.request.incident.victim_count = 1
    base_state.request.incident.elderly_count = 5
    
    result = SituationResult(
        is_valid=True,
        summary="Test",
        severity_assessment="LOW",
        vulnerable_population_impact="None",
        confidence_score=1.0,
        normalized_incident_type="FLOOD"
    )
    
    val_result, warnings = validate_situation(result, base_state)
    
    assert base_state.request.incident.victim_count == 6
    assert val_result.is_valid is False
    assert any(w.code == WarningCode.MALFORMED_INPUT for w in warnings)


def test_validate_risk_out_of_bounds_score(base_state):
    result = RiskResult.model_construct(
        priority=Priority.P1_CRITICAL,
        risk_level=RiskLevel.CRITICAL,
        severity="HIGH",
        score=150.0,
        reasons=[],
        confidence=1.0
    )
    
    val_result, warnings = validate_risk(result, base_state)
    
    assert val_result.score == 100.0
    assert len(val_result.reasons) > 0
    assert any(w.code == WarningCode.RISK_FAILURE for w in warnings)


def test_validate_prediction_empty_forecast(base_state):
    result = PredictiveAgentResult(
        current_risk=RiskLevel.HIGH,
        forecast=[],
        escalation_detected=True,
        explanation=[],
        confidence=1.0
    )
    
    val_result, warnings = validate_prediction(result, base_state)
    
    assert len(val_result.forecast) == 1
    assert val_result.forecast[0].horizon_minutes == 60
    assert val_result.escalation_detected is False
    assert any(w.code == WarningCode.PREDICTION_FAILURE for w in warnings)


def test_validate_resources_duplicate_assignment(base_state):
    # Add a valid resource to state
    base_state.request.resources.append(
        Resource(id="RES_1", type=ResourceType.AMBULANCE, latitude=0, longitude=0, status=ResourceStatus.AVAILABLE)
    )
    
    dummy_route = RouteResult(
        resource_id="RES_1",
        destination_id="INC_VAL",
        estimated_time_mins=10.0,
        distance_km=5.0,
        waypoints=[],
        route_status=RoadAccessStatus.OPEN
    )
    
    result = ResourceAgentResult(
        assignments=[
            ResourceAssignment(resource_id="RES_1", action="DISPATCH", route=dummy_route, estimated_arrival_time_mins=10.0),
            ResourceAssignment(resource_id="RES_1", action="DISPATCH", route=dummy_route, estimated_arrival_time_mins=10.0),
            ResourceAssignment(resource_id="RES_MISSING", action="DISPATCH", route=dummy_route, estimated_arrival_time_mins=10.0),
        ],
        unfulfilled_requirements=[],
        reasons=[]
    )
    
    val_result, warnings = validate_resources(result, base_state)
    
    assert len(val_result.assignments) == 1
    assert val_result.assignments[0].resource_id == "RES_1"
    assert "RES_MISSING" in val_result.unfulfilled_requirements
    assert len(warnings) == 2
    assert all(w.code == WarningCode.RESOURCE_FAILURE for w in warnings)


def test_validate_routes_negative_eta(base_state):
    routes = [
        RouteResult.model_construct(
            resource_id="RES_1",
            destination_id="INC_VAL",
            estimated_time_mins=-5.0,
            distance_km=-10.0,
            waypoints=[],
            route_status=RoadAccessStatus.BLOCKED
        )
    ]
    
    val_routes, warnings = validate_routes(routes, base_state)
    
    assert val_routes[0].estimated_time_mins == 60.0
    assert val_routes[0].distance_km == 40.0
    assert len(warnings) == 3
    assert all(w.code == WarningCode.ROUTE_FAILURE for w in warnings)


def test_validate_coordinator_plan_demote_action(base_state):
    risk = RiskResult(
        priority=Priority.P5_MONITOR,
        risk_level=RiskLevel.LOW,
        severity="LOW",
        score=10.0,
        reasons=["Test"],
        confidence=1.0
    )
    
    plan = FullResponsePlan(
        incident_id="INC_VAL",
        situation=SituationResult(
            is_valid=True, summary="T", severity_assessment="L", vulnerable_population_impact="N", confidence_score=1.0, normalized_incident_type="T"
        ),
        risk=risk,
        recommended_action=RecommendedAction.IMMEDIATE_DISPATCH,
        human_approval_required=False
    )
    
    val_plan, warnings = validate_coordinator_plan(plan, base_state)
    
    assert val_plan.recommended_action == RecommendedAction.DISPATCH
    assert val_plan.human_approval_required is True
    assert any(w.code == WarningCode.OPTIMIZATION_FAILURE for w in warnings)
