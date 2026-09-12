import pytest
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Environment,
    RoadAccessStatus
)
from app.agents.situation_agent import SituationAgent

@pytest.fixture
def agent():
    return SituationAgent()

def test_flood_missing_data(agent):
    """Test that missing water level and rainfall reduce confidence in a flood incident."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC001",
            type=IncidentType.FLOOD,
            latitude=10.0,
            longitude=20.0,
            victim_count=5
        )
    )
    result = agent.analyze(request)
    
    assert result.is_valid is True
    assert "water_level" in result.missing_information
    assert "rainfall" in result.missing_information
    assert "road_access" in result.missing_information
    assert result.confidence_score < 1.0
    assert result.confidence_score == 0.6  # 1.0 - 0.2 - 0.1 - 0.1
    assert result.severity_assessment == "HIGH"

def test_inconsistent_victims(agent):
    """Test that if vulnerable victims > total victims, it is flagged as invalid."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC002",
            type=IncidentType.FIRE,
            latitude=10.0,
            longitude=20.0,
            victim_count=1,
            elderly_count=2,
            children_count=1
        )
    )
    result = agent.analyze(request)
    
    assert result.is_valid is False
    assert result.confidence_score < 1.0
    # The agent auto-corrects the victim count to 3
    assert "Auto-corrected total victim count to 3." in result.explanations

def test_high_severity_weather(agent):
    """Test that bad weather escalates severity."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC003",
            type=IncidentType.FLOOD,
            latitude=10.0,
            longitude=20.0,
            victim_count=2,
            water_level=2.0,
            rainfall=150.0,
            road_access=RoadAccessStatus.BLOCKED
        ),
        environment=Environment(
            general_weather="Heavy rain storm"
        )
    )
    result = agent.analyze(request)
    
    assert result.is_valid is True
    assert result.severity_assessment == "CRITICAL"
    assert result.confidence_score == 1.0
    assert not result.missing_information

def test_structural_collapse(agent):
    """Test an earthquake/collapse scenario with no weather impact."""
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC004",
            type=IncidentType.EARTHQUAKE,
            latitude=35.0,
            longitude=-120.0,
            victim_count=15, # > 10 triggers CRITICAL
            road_access=RoadAccessStatus.BLOCKED
        )
    )
    result = agent.analyze(request)
    
    assert result.is_valid is True
    assert result.severity_assessment == "CRITICAL"
    assert result.confidence_score == 1.0
    assert result.normalized_incident_type == "EARTHQUAKE"
