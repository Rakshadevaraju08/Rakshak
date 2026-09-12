import pytest

from app.schemas.domain import (
    DisasterAnalysisState,
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    RiskResult,
    RiskLevel,
    Priority,
    SafetyCheckResult,
    SafetyStatus,
    AutonomyMode,
    FullResponsePlan,
    RecommendedAction
)
from app.agents.autonomy_decision_maker import AutonomyDecisionMaker

@pytest.fixture
def base_state():
    return DisasterAnalysisState(
        request=DisasterAnalysisRequest(
            incident=Incident(id="INC_1", type=IncidentType.MEDICAL, latitude=1.0, longitude=2.0)
        )
    )

@pytest.fixture
def plan():
    return FullResponsePlan(
        incident_id="INC_1",
        recommended_action=RecommendedAction.DISPATCH
    )

@pytest.fixture
def decision_maker():
    return AutonomyDecisionMaker()

def test_autonomy_decision_auto(base_state, plan, decision_maker):
    """LOW risk, high confidence, SAFE -> AUTO"""
    base_state.risk = RiskResult(
        priority=Priority.P4_LOW, risk_level=RiskLevel.LOW, severity="LOW", score=10.0, reasons=[], confidence=0.95
    )
    
    safety = SafetyCheckResult(
        status=SafetyStatus.SAFE, confidence=0.95, checks_performed=15, is_safe_for_autonomous_execution=True,
        risk_level=RiskLevel.LOW, recommended_action=RecommendedAction.DISPATCH
    )
    
    decision = decision_maker.decide(base_state, plan, safety)
    
    assert decision.mode == AutonomyMode.AUTO
    assert decision.human_review_required is False
    assert not decision.blocking_factors

def test_autonomy_decision_assisted(base_state, plan, decision_maker):
    """MEDIUM risk, acceptable confidence, SAFE -> ASSISTED"""
    base_state.risk = RiskResult(
        priority=Priority.P3_MEDIUM, risk_level=RiskLevel.MEDIUM, severity="MEDIUM", score=50.0, reasons=[], confidence=0.85
    )
    
    safety = SafetyCheckResult(
        status=SafetyStatus.SAFE, confidence=0.85, checks_performed=15, is_safe_for_autonomous_execution=True,
        risk_level=RiskLevel.MEDIUM, recommended_action=RecommendedAction.DISPATCH
    )
    
    decision = decision_maker.decide(base_state, plan, safety)
    
    assert decision.mode == AutonomyMode.ASSISTED
    assert decision.human_review_required is False
    assert any("Risk level" in f for f in decision.blocking_factors)

def test_autonomy_decision_human_required_due_to_safety(base_state, plan, decision_maker):
    """Safety status BLOCKED -> HUMAN_REQUIRED"""
    base_state.risk = RiskResult(
        priority=Priority.P4_LOW, risk_level=RiskLevel.LOW, severity="LOW", score=10.0, reasons=[], confidence=0.95
    )
    
    safety = SafetyCheckResult(
        status=SafetyStatus.BLOCKED, confidence=0.95, checks_performed=15, is_safe_for_autonomous_execution=False,
        risk_level=RiskLevel.LOW, recommended_action=RecommendedAction.DISPATCH
    )
    
    decision = decision_maker.decide(base_state, plan, safety)
    
    assert decision.mode == AutonomyMode.HUMAN_REQUIRED
    assert decision.human_review_required is True
    assert any("Safety violations detected" in decision.reason for f in decision.blocking_factors) or "Safety violations detected" in decision.reason
    assert any("status: BLOCKED" in f for f in decision.blocking_factors)

def test_autonomy_decision_human_required_due_to_critical_risk(base_state, plan, decision_maker):
    """CRITICAL risk -> HUMAN_REQUIRED"""
    base_state.risk = RiskResult(
        priority=Priority.P1_CRITICAL, risk_level=RiskLevel.CRITICAL, severity="CRITICAL", score=95.0, reasons=[], confidence=0.95
    )
    
    safety = SafetyCheckResult(
        status=SafetyStatus.SAFE, confidence=0.95, checks_performed=15, is_safe_for_autonomous_execution=True,
        risk_level=RiskLevel.CRITICAL, recommended_action=RecommendedAction.DISPATCH
    )
    
    decision = decision_maker.decide(base_state, plan, safety)
    
    assert decision.mode == AutonomyMode.HUMAN_REQUIRED
    assert decision.human_review_required is True
    assert "CRITICAL risk incident" in decision.reason
    
def test_autonomy_decision_human_required_due_to_low_confidence(base_state, plan, decision_maker):
    """Confidence below threshold -> HUMAN_REQUIRED"""
    base_state.risk = RiskResult(
        priority=Priority.P3_MEDIUM, risk_level=RiskLevel.MEDIUM, severity="MEDIUM", score=50.0, reasons=[], confidence=0.50
    )
    
    safety = SafetyCheckResult(
        status=SafetyStatus.SAFE, confidence=0.60, checks_performed=15, is_safe_for_autonomous_execution=True,
        risk_level=RiskLevel.MEDIUM, recommended_action=RecommendedAction.DISPATCH
    )
    
    decision = decision_maker.decide(base_state, plan, safety)
    
    assert decision.mode == AutonomyMode.HUMAN_REQUIRED
    assert decision.human_review_required is True
    assert any("Confidence" in f for f in decision.blocking_factors)
