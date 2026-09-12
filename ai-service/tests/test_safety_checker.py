import pytest
from typing import List
from datetime import datetime, timedelta

from app.schemas.domain import (
    DisasterAnalysisState,
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Resource,
    ResourceType,
    ResourceStatus,
    RoadAccessStatus,
    Hospital,
    Observation,
    FullResponsePlan,
    SafetyStatus,
    ResourceAssignment,
    RouteResult,
    RecommendedAction,
    RiskLevel,
    QualityStatus
)
from app.agents.safety_checker import ResponseSafetyChecker
from app.schemas.domain import DataQualityResult, SituationResult, RiskResult

@pytest.fixture
def checker():
    return ResponseSafetyChecker()

@pytest.fixture
def valid_state_and_plan():
    # Valid Request
    incident = Incident(
        id="INC_1",
        type=IncidentType.FIRE,
        latitude=10.0,
        longitude=20.0,
        victim_count=0
    )
    res1 = Resource(
        id="RES_1",
        type=ResourceType.FIRE_TRUCK,
        status=ResourceStatus.AVAILABLE,
        latitude=10.1,
        longitude=20.1
    )
    request = DisasterAnalysisRequest(
        incident=incident,
        resources=[res1],
        hospitals=[],
        roads=[]
    )
    state = DisasterAnalysisState(request=request)
    
    # Valid state components
    state.data_quality = DataQualityResult(overall_quality=QualityStatus.VALID, confidence=1.0)
    state.situation = SituationResult(
        is_valid=True,
        summary="Test",
        severity_assessment="Low",
        vulnerable_population_impact="None",
        confidence_score=0.9,
        normalized_incident_type="FIRE"
    )
    state.risk = RiskResult(
        priority=3,
        risk_level=RiskLevel.MEDIUM,
        severity="MEDIUM",
        score=50.0,
        reasons=[],
        confidence=0.95
    )
    
    # Valid Plan
    route = RouteResult(
        resource_id="RES_1",
        destination_id="INC_1",
        estimated_time_mins=10.0,
        distance_km=5.0,
        route_status=RoadAccessStatus.OPEN
    )
    assignment = ResourceAssignment(
        resource_id="RES_1",
        action="DISPATCH",
        route=route,
        estimated_arrival_time_mins=10.0
    )
    plan = FullResponsePlan(
        incident_id="INC_1",
        assignments=[assignment],
        recommended_action=RecommendedAction.DISPATCH,
        human_approval_required=False
    )
    return state, plan


def test_safety_fully_valid(checker, valid_state_and_plan):
    state, plan = valid_state_and_plan
    result = checker.check(state, plan)
    
    assert result.status == SafetyStatus.SAFE
    assert result.is_safe_for_autonomous_execution is True
    assert len(result.blocking_issues) == 0
    assert len(result.warnings) == 0


def test_safety_unavailable_resource(checker, valid_state_and_plan):
    state, plan = valid_state_and_plan
    # Change resource status in request
    state.request.resources[0].status = ResourceStatus.DISPATCHED
    
    result = checker.check(state, plan)
    assert result.status == SafetyStatus.BLOCKED
    assert any("not AVAILABLE" in issue for issue in result.blocking_issues)


def test_safety_blocked_route(checker, valid_state_and_plan):
    state, plan = valid_state_and_plan
    # Make the route blocked
    plan.assignments[0].route.route_status = RoadAccessStatus.BLOCKED
    
    result = checker.check(state, plan)
    assert result.status == SafetyStatus.BLOCKED
    assert any("traverses a blocked road" in issue for issue in result.blocking_issues)


def test_safety_stale_data(checker, valid_state_and_plan):
    state, plan = valid_state_and_plan
    # Add stale data warning
    state.data_quality.stale_fields = ["water_level"]
    
    result = checker.check(state, plan)
    assert result.status == SafetyStatus.REVIEW_REQUIRED
    assert any("Stale data" in w for w in result.warnings)


def test_safety_hospital_full(checker, valid_state_and_plan):
    state, plan = valid_state_and_plan
    state.request.incident.victim_count = 5 # Needs hospital
    
    # Add full hospital
    hosp = Hospital(id="HOSP_1", name="City Hosp", available_beds=0, latitude=10.0, longitude=20.0, total_beds=100)
    state.request.hospitals.append(hosp)
    
    result = checker.check(state, plan)
    assert result.status == SafetyStatus.REVIEW_REQUIRED
    assert any("Hospital HOSP_1 is at zero capacity" in w for w in result.warnings)


def test_safety_low_confidence(checker, valid_state_and_plan):
    state, plan = valid_state_and_plan
    # Lower confidence
    state.situation.confidence_score = 0.5
    state.risk.confidence = 0.5
    
    result = checker.check(state, plan)
    assert result.status == SafetyStatus.REVIEW_REQUIRED
    assert any("Average pipeline confidence" in w for w in result.warnings)


def test_safety_multiple_simultaneous_issues(checker, valid_state_and_plan):
    state, plan = valid_state_and_plan
    
    # Low confidence -> Warning
    state.situation.confidence_score = 0.5
    state.risk.confidence = 0.5
    
    # Blocked route -> Blocking Issue
    plan.assignments[0].route.route_status = RoadAccessStatus.BLOCKED
    
    # Invalid data -> Blocking Issue
    state.data_quality.overall_quality = QualityStatus.INVALID
    
    result = checker.check(state, plan)
    assert result.status == SafetyStatus.BLOCKED
    assert len(result.blocking_issues) == 2
    assert len(result.warnings) >= 1
