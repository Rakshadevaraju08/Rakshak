import pytest
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    RoadAccessStatus,
    Priority,
    RiskLevel,
    DisasterAnalysisState,
    Environment,
    Observation
)
from app.agents.risk_agent import RiskAgent
from app.errors import WarningCode

@pytest.fixture
def agent():
    return RiskAgent()

def test_low_risk_incident(agent):
    """Test an incident with no victims, no severe conditions."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_LOW",
            type=IncidentType.OTHER,
            latitude=10.0,
            longitude=20.0,
            victim_count=0,
            critical_victim_count=0,
            elderly_count=0,
            children_count=0,
            disabled_count=0,
            water_level=Observation(value=0.5),
            rainfall=Observation(value=10.0),
            road_access=RoadAccessStatus.OPEN
        )
    )
    state = DisasterAnalysisState(request=request)
    result = agent.analyze(state).risk
    
    # 0 score -> P5_MONITOR, LOW
    assert result.priority == Priority.P5_MONITOR
    assert result.risk_level == RiskLevel.LOW
    assert result.score == 0.0

def test_medium_risk_incident(agent):
    """Test an incident with a moderate number of victims."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_MED",
            type=IncidentType.OTHER,
            latitude=10.0,
            longitude=20.0,
            victim_count=6, # 6 * 5 = 30 points
            rainfall=Observation(value=10.0)
        )
    )
    state = DisasterAnalysisState(request=request)
    result = agent.analyze(state).risk
    
    # 30 score -> P3_MEDIUM, MEDIUM
    assert result.priority == Priority.P3_MEDIUM
    assert result.risk_level == RiskLevel.MEDIUM
    assert result.score == 30.0
    assert any("people reported needing help: 6" in r.lower() for r in result.reasons)

def test_critical_flood(agent):
    """Test a flood with high water levels and blocked roads."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_CRIT",
            type=IncidentType.FLOOD,
            latitude=10.0,
            longitude=20.0,
            victim_count=10,       # 10 * 5 = 50 points (capped at 40)
            water_level=Observation(value=2.5),       # > 2.0 = 30 points
            rainfall=Observation(value=120.0),        # > 100 = 20 points
            road_access=RoadAccessStatus.BLOCKED # 15 points
        )
    )
    state = DisasterAnalysisState(request=request)
    result = agent.analyze(state).risk
    
    # 40 + 30 + 20 + 15 = 105 (capped at 100)
    assert result.priority == Priority.P1_CRITICAL
    assert result.risk_level == RiskLevel.CRITICAL
    assert result.score == 100.0
    assert any("dangerously high water level" in r.lower() for r in result.reasons)
    assert any("extreme rainfall" in r.lower() for r in result.reasons)

def test_vulnerable_victim(agent):
    """Test that vulnerable victims heavily skew the risk score."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_VULN",
            type=IncidentType.OTHER,
            latitude=10.0,
            longitude=20.0,
            victim_count=2,       # 2 * 5 = 10 points
            critical_victim_count=0,
            elderly_count=2,      # 2 * 10 = 20 points
            children_count=0,
            disabled_count=0,
            rainfall=Observation(value=0.0),
            road_access=RoadAccessStatus.OPEN
        )
    )
    state = DisasterAnalysisState(request=request)
    result = agent.analyze(state).risk
    
    # 10 + 20 = 30 points -> P3_MEDIUM
    assert result.priority == Priority.P3_MEDIUM
    assert result.score == 30.0
    assert any("vulnerable individuals reported: 2" in r.lower() for r in result.reasons)

def test_missing_environmental_data(agent):
    """Test that missing environmental data reduces confidence in flood incidents."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_MISSING",
            type=IncidentType.FLOOD,
            latitude=10.0,
            longitude=20.0,
            victim_count=0
        )
    )
    state = DisasterAnalysisState(request=request)
    result = agent.analyze(state).risk
    
    assert result.confidence < 1.0
    assert result.score is None
    assert result.risk_level == RiskLevel.UNDETERMINED
    assert result.priority == Priority.P5_MONITOR
