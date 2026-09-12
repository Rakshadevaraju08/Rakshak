import logging
from typing import List

from app.schemas.domain import (
    DisasterAnalysisState,
    FullResponsePlan,
    SafetyCheckResult,
    SafetyStatus,
    QualityStatus,
    ResourceStatus,
    RoadAccessStatus,
    RecommendedAction,
    RiskLevel
)

logger = logging.getLogger("disaster.safety")

class ResponseSafetyChecker:
    """
    Deterministic safety and consistency checker.
    Verifies that the generated response plan is safe, logically consistent,
    and adheres to hard constraints before it is returned to the user.
    """

    def __init__(self):
        self.CONFIDENCE_THRESHOLD = 0.80
        self.MAX_ETA_MINUTES = 120.0

    def check(self, state: DisasterAnalysisState, plan: FullResponsePlan) -> SafetyCheckResult:
        blocking_issues: List[str] = []
        warnings: List[str] = []
        checks_performed = 0

        request = state.request

        # 1. Incident validity
        checks_performed += 1
        if not state.situation or not state.situation.is_valid:
            blocking_issues.append("Incident data is structurally invalid or incomplete.")

        # 2. Data quality
        checks_performed += 1
        if state.data_quality and state.data_quality.overall_quality == QualityStatus.INVALID:
            blocking_issues.append("Environmental data is highly invalid.")

        # 3. Data freshness
        checks_performed += 1
        if state.data_quality and getattr(state.data_quality, 'stale_fields', []):
            warnings.append(f"Stale data fields detected: {', '.join(state.data_quality.stale_fields)}.")

        # 4. Resource availability
        # 5. Resource capability compatibility
        # 6. Duplicate/conflicting resource assignments
        checks_performed += 3
        assigned_resource_ids = set()
        for assignment in plan.assignments:
            res_id = assignment.resource_id
            
            # Rule 6: Duplicate resource assignments
            if res_id in assigned_resource_ids:
                blocking_issues.append(f"Resource {res_id} is assigned multiple times.")
            assigned_resource_ids.add(res_id)
            
            # Find the resource in the original request
            resource_obj = next((r for r in request.resources if r.id == res_id), None)
            if not resource_obj:
                blocking_issues.append(f"Assigned resource {res_id} does not exist in request.")
            else:
                # Rule 4: Resource availability
                if resource_obj.status != ResourceStatus.AVAILABLE:
                    blocking_issues.append(f"Resource {res_id} is not AVAILABLE (status: {resource_obj.status.value}).")
                
                # Rule 5: Resource capability compatibility
                if state.situation:
                    incident_type = getattr(state.situation, 'normalized_incident_type', '')
                    if incident_type == "MEDICAL":
                        if resource_obj.type.value not in ["AMBULANCE", "MEDICAL_TEAM"]:
                            warnings.append(f"Resource {res_id} ({resource_obj.type.value}) may not be compatible with a MEDICAL incident.")
                    elif incident_type == "FIRE":
                        if resource_obj.type.value not in ["FIRE_TRUCK", "RESCUE_TEAM", "AMBULANCE"]:
                            warnings.append(f"Resource {res_id} ({resource_obj.type.value}) may not be compatible with a FIRE incident.")

        # 7. Hospital availability/capability when hospital information exists
        checks_performed += 1
        if request.hospitals:
            for hosp in request.hospitals:
                if hosp.available_beds <= 0:
                    warnings.append(f"Hospital {hosp.id} is at zero capacity.")

        # 8. Route validity
        # 9. Blocked-road conflicts
        # 14. Constraint violations
        checks_performed += 3
        for assignment in plan.assignments:
            route = assignment.route
            if not route:
                blocking_issues.append(f"No route found for assignment of {assignment.resource_id}.")
                continue
            
            # Rule 8 and 9
            if route.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE:
                blocking_issues.append(f"Route for {assignment.resource_id} is unavailable.")
            elif route.route_status == RoadAccessStatus.BLOCKED:
                blocking_issues.append(f"Route for {assignment.resource_id} traverses a blocked road.")
            
            # Rule 14
            if route.estimated_time_mins > self.MAX_ETA_MINUTES:
                warnings.append(f"ETA for {assignment.resource_id} exceeds constraint ({route.estimated_time_mins} > {self.MAX_ETA_MINUTES} mins).")

        # 10. Prediction/input sufficiency
        checks_performed += 1
        if state.prediction and getattr(state.prediction, 'used_fallback', False):
            warnings.append("Prediction relies on deterministic fallback due to ML unavailability.")

        # 11. Missing critical information
        checks_performed += 1
        if state.situation and getattr(state.situation, 'missing_information', []):
            warnings.append(f"Missing critical information: {', '.join(state.situation.missing_information)}.")

        # 12. Confidence level
        checks_performed += 1
        confidence_scores = []
        if state.situation: confidence_scores.append(state.situation.confidence_score)
        if state.risk: confidence_scores.append(state.risk.confidence)
        if state.data_quality: confidence_scores.append(state.data_quality.confidence)
        if state.prediction: confidence_scores.append(state.prediction.confidence)
        
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 1.0
        if avg_confidence < self.CONFIDENCE_THRESHOLD:
            warnings.append(f"Average pipeline confidence ({avg_confidence:.2f}) is below safe threshold ({self.CONFIDENCE_THRESHOLD}).")

        # 13. Agent validation results
        checks_performed += 1
        if plan.degraded:
            warnings.append("The AI pipeline ran in a degraded state with fallback components.")
            
        if state.data_quality and getattr(state.data_quality, 'conflicting_fields', []):
            warnings.append(f"Conflicting data observations detected: {', '.join(state.data_quality.conflicting_fields)}.")

        # Compile status
        # 15. Whether the recommendation is safe for autonomous execution
        checks_performed += 1
        
        status = SafetyStatus.SAFE
        if blocking_issues:
            status = SafetyStatus.BLOCKED
        elif warnings:
            status = SafetyStatus.REVIEW_REQUIRED
            
        is_safe = (status == SafetyStatus.SAFE)
        
        return SafetyCheckResult(
            status=status,
            risk_level=state.risk.risk_level if state.risk else RiskLevel.LOW,
            confidence=round(avg_confidence, 2),
            blocking_issues=blocking_issues,
            warnings=warnings,
            checks_performed=checks_performed,
            recommended_action=plan.recommended_action,
            is_safe_for_autonomous_execution=is_safe
        )
