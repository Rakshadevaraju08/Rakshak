import pytest
from app.schemas.domain import DisasterAnalysisRequest, Incident, IncidentType, DisasterAnalysisState
from app.agents.situation_agent import SituationAgent
from app.agents.risk_agent import RiskAgent

def test_state_flow_between_agents():
    """
    Proves that information added by an earlier agent (SituationAgent)
    is preserved in the DisasterAnalysisState and is accessible to a later agent (RiskAgent).
    """
    request = DisasterAnalysisRequest(
        incident=Incident(
            id="INC_TEST_STATE", 
            type=IncidentType.FLOOD, 
            latitude=10.0, 
            longitude=20.0, 
            victim_count=5
        )
    )
    
    # Initialize the unified state
    state = DisasterAnalysisState(request=request)
    
    # Initially, situation and risk are None
    assert state.situation is None
    assert state.risk is None
    
    # 1. Run SituationAgent
    situation_agent = SituationAgent()
    state = situation_agent.analyze(state)
    
    # Verify SituationAgent enriched the state
    assert state.situation is not None
    assert state.situation.normalized_incident_type == "FLOOD"
    
    # 2. Run RiskAgent
    risk_agent = RiskAgent(use_ml=False)
    state = risk_agent.analyze(state)
    
    # Verify RiskAgent enriched the state and could theoretically access state.situation
    assert state.risk is not None
    assert state.risk.score > 0
    
    # Both sets of information are preserved in the single state object
    assert state.situation.is_valid is True
    assert state.risk.score > 0
