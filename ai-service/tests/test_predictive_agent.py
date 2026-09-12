import pytest
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Environment,
    RiskLevel
)
from app.agents.predictive_agent import PredictiveAgent

# Dummy RiskResult class to simplify testing
class DummyRiskResult:
    def __init__(self, risk_level):
        self.risk_level = risk_level

@pytest.fixture
def agent():
    return PredictiveAgent()

def test_escalating_risk(agent):
    """Test that a heavily increasing water level escalates the risk level over time."""
    request = DisasterAnalysisRequest(
        incident=Incident(id="INC_1", type=IncidentType.FLOOD, latitude=0.0, longitude=0.0),
        environment=Environment(water_level_trend_m_per_hour=1.0, rainfall_trend_mm_per_hour=15.0)
    )
    current_risk = DummyRiskResult(RiskLevel.MEDIUM)
    
    result = agent.analyze(request, current_risk)
    
    assert result.current_risk == RiskLevel.MEDIUM
    assert result.escalation_detected is True
    assert result.confidence == 1.0
    
    # 20 mins might still be MEDIUM or escalate to HIGH depending on threshold, but 60 mins definitely escalates
    assert any(f.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL] for f in result.forecast)
    assert result.forecast[-1].risk_level == RiskLevel.CRITICAL # (2 + 2.5) -> 4 (CRITICAL)

def test_de_escalating_risk(agent):
    """Test that negative trends reduce the risk over time."""
    request = DisasterAnalysisRequest(
        incident=Incident(id="INC_1", type=IncidentType.FLOOD, latitude=0.0, longitude=0.0),
        environment=Environment(water_level_trend_m_per_hour=-1.5, rainfall_trend_mm_per_hour=-10.0)
    )
    current_risk = DummyRiskResult(RiskLevel.HIGH) # High risk currently
    
    result = agent.analyze(request, current_risk)
    
    assert result.current_risk == RiskLevel.HIGH
    assert result.escalation_detected is False
    assert result.confidence == 1.0
    
    # Should de-escalate to MEDIUM or LOW over the horizon
    assert result.forecast[-1].risk_level in [RiskLevel.MEDIUM, RiskLevel.LOW]

def test_stable_risk(agent):
    """Test that 0 trends maintain the current risk level."""
    request = DisasterAnalysisRequest(
        incident=Incident(id="INC_1", type=IncidentType.FIRE, latitude=0.0, longitude=0.0),
        environment=Environment(water_level_trend_m_per_hour=0.0, rainfall_trend_mm_per_hour=0.0)
    )
    current_risk = DummyRiskResult(RiskLevel.MEDIUM)
    
    result = agent.analyze(request, current_risk)
    
    assert result.escalation_detected is False
    for item in result.forecast:
        assert item.risk_level == RiskLevel.MEDIUM

def test_missing_data_fallback(agent):
    """Test that missing environmental data reduces confidence significantly."""
    request = DisasterAnalysisRequest(
        incident=Incident(id="INC_1", type=IncidentType.FLOOD, latitude=0.0, longitude=0.0),
        # No environment block provided
    )
    current_risk = DummyRiskResult(RiskLevel.HIGH)
    
    result = agent.analyze(request, current_risk)
    
    assert result.escalation_detected is False
    # Missing completely -> drops confidence by 0.5
    assert result.confidence == 0.5
    assert "no environmental data provided" in result.explanation[0].lower()
