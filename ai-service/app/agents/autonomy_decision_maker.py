import logging
from typing import List

from app.schemas.domain import (
    DisasterAnalysisState,
    FullResponsePlan,
    SafetyCheckResult,
    SafetyStatus,
    AutonomyMode,
    AutonomyDecision,
    RiskLevel
)

logger = logging.getLogger("disaster.autonomy")

class AutonomyDecisionMaker:
    """
    Decides the autonomy level of the recommended plan.
    This replaces binary 'human_approval_required' with an explainable
    decision model to allow safe, simulation-only execution when appropriate.
    """

    def __init__(self):
        self.MIN_AUTO_CONFIDENCE = 0.90
        self.MIN_ASSISTED_CONFIDENCE = 0.80

    def decide(self, state: DisasterAnalysisState, plan: FullResponsePlan, safety_result: SafetyCheckResult) -> AutonomyDecision:
        
        # Pull required indicators
        risk_lvl = state.risk.risk_level if state.risk else RiskLevel.LOW
        avg_confidence = safety_result.confidence
        degraded = state.degraded
        
        blocking_factors: List[str] = []
        
        # Check HUMAN_REQUIRED conditions
        if safety_result.status != SafetyStatus.SAFE:
            blocking_factors.append(f"Safety check failed with status: {safety_result.status.value}")
        if risk_lvl in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
            blocking_factors.append(f"Incident risk level is too high ({risk_lvl.value}) for autonomy.")
        if avg_confidence < self.MIN_ASSISTED_CONFIDENCE:
            blocking_factors.append(f"Confidence ({avg_confidence}) is below the acceptable threshold ({self.MIN_ASSISTED_CONFIDENCE}).")
        if degraded:
            blocking_factors.append("The pipeline ran in a degraded or fallback state.")
            
        if state.situation and getattr(state.situation, 'missing_information', []):
            blocking_factors.append("Critical situation information is missing.")
            
        if state.data_quality and getattr(state.data_quality, 'conflicting_fields', []):
            blocking_factors.append("Conflicting observations were detected in environmental data.")

        # Determine Mode
        if blocking_factors:
            mode = AutonomyMode.HUMAN_REQUIRED
            reason = "Human review is strictly required due to safety, risk, or data constraints."
            # Append specific reasons for clarity
            if risk_lvl in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
                reason = f"{risk_lvl.value} risk incident requiring explicit operator dispatch."
            elif not safety_result.is_safe_for_autonomous_execution:
                reason = "Safety violations detected in the generated plan."
        else:
            # We are either ASSISTED or AUTO
            if risk_lvl == RiskLevel.LOW and avg_confidence >= self.MIN_AUTO_CONFIDENCE:
                mode = AutonomyMode.AUTO
                reason = "Low-risk incident with high confidence and no safety violations. Safe for automated execution."
            else:
                mode = AutonomyMode.ASSISTED
                reason = "Moderate risk or confidence. Operator should be notified before execution."
                if avg_confidence < self.MIN_AUTO_CONFIDENCE:
                    blocking_factors.append(f"Confidence ({avg_confidence}) is below the fully-auto threshold ({self.MIN_AUTO_CONFIDENCE}).")
                if risk_lvl != RiskLevel.LOW:
                    blocking_factors.append(f"Risk level ({risk_lvl.value}) requires operator assistance.")
                    
        return AutonomyDecision(
            mode=mode,
            reason=reason,
            confidence=avg_confidence,
            blocking_factors=blocking_factors,
            human_review_required=(mode == AutonomyMode.HUMAN_REQUIRED)
        )
