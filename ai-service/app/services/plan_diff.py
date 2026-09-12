from typing import List, Tuple
from app.schemas.domain import (
    FullResponsePlan,
    PlanChange,
    ChangeCategory,
    ResourceAssignment
)

def compute_plan_diff(old_plan: FullResponsePlan, new_plan: FullResponsePlan) -> Tuple[List[PlanChange], bool]:
    """
    Compares two FullResponsePlans and returns a list of detected changes
    along with a boolean indicating if any of the changes are 'significant'
    (priority, action, or resource assignments).
    """
    changes: List[PlanChange] = []
    is_significant = False

    # 1. Action Change
    if old_plan.recommended_action != new_plan.recommended_action:
        changes.append(PlanChange(
            category=ChangeCategory.ACTION_CHANGE,
            field="recommended_action",
            previous_value=old_plan.recommended_action.value,
            new_value=new_plan.recommended_action.value,
            description=f"Recommended action changed from {old_plan.recommended_action.value} to {new_plan.recommended_action.value}"
        ))
        is_significant = True

    # 2. Situation Severity
    if old_plan.situation and new_plan.situation:
        if old_plan.situation.severity_assessment != new_plan.situation.severity_assessment:
            changes.append(PlanChange(
                category=ChangeCategory.SEVERITY_CHANGE,
                field="situation.severity_assessment",
                previous_value=old_plan.situation.severity_assessment,
                new_value=new_plan.situation.severity_assessment,
                description=f"Incident severity changed from {old_plan.situation.severity_assessment} to {new_plan.situation.severity_assessment}"
            ))

    # 3. Risk Level and Priority
    if old_plan.risk and new_plan.risk:
        if old_plan.risk.risk_level != new_plan.risk.risk_level:
            changes.append(PlanChange(
                category=ChangeCategory.RISK_LEVEL_CHANGE,
                field="risk.risk_level",
                previous_value=old_plan.risk.risk_level.value,
                new_value=new_plan.risk.risk_level.value,
                description=f"Risk level changed from {old_plan.risk.risk_level.value} to {new_plan.risk.risk_level.value}"
            ))
            
        if old_plan.risk.priority != new_plan.risk.priority:
            changes.append(PlanChange(
                category=ChangeCategory.PRIORITY_CHANGE,
                field="risk.priority",
                previous_value=str(old_plan.risk.priority.value),
                new_value=str(new_plan.risk.priority.value),
                description=f"Priority changed from P{old_plan.risk.priority.value} to P{new_plan.risk.priority.value}"
            ))
            is_significant = True

    # 4. Prediction Escalation
    if old_plan.prediction and new_plan.prediction:
        if old_plan.prediction.escalation_detected != new_plan.prediction.escalation_detected:
            changes.append(PlanChange(
                category=ChangeCategory.ESCALATION_CHANGE,
                field="prediction.escalation_detected",
                previous_value=str(old_plan.prediction.escalation_detected),
                new_value=str(new_plan.prediction.escalation_detected),
                description=f"Escalation detection flipped to {new_plan.prediction.escalation_detected}"
            ))

    # 5. Resource Assignments
    old_assignments_map = {a.resource_id: a for a in old_plan.assignments}
    new_assignments_map = {a.resource_id: a for a in new_plan.assignments}
    
    # Removed resources
    for res_id, old_a in old_assignments_map.items():
        if res_id not in new_assignments_map:
            changes.append(PlanChange(
                category=ChangeCategory.RESOURCE_REMOVED,
                field=f"assignments[{res_id}]",
                previous_value=old_a.action,
                new_value=None,
                description=f"Resource {res_id} is no longer assigned to this incident"
            ))
            is_significant = True
            
    # Added resources
    for res_id, new_a in new_assignments_map.items():
        if res_id not in old_assignments_map:
            changes.append(PlanChange(
                category=ChangeCategory.RESOURCE_ADDED,
                field=f"assignments[{res_id}]",
                previous_value=None,
                new_value=new_a.action,
                description=f"Resource {res_id} has been newly assigned to this incident"
            ))
            is_significant = True
            
    # Changed route for same resource
    for res_id, old_a in old_assignments_map.items():
        if res_id in new_assignments_map:
            new_a = new_assignments_map[res_id]
            
            # Action change (e.g. STANDBY to DISPATCH_TO_INCIDENT)
            if old_a.action != new_a.action:
                changes.append(PlanChange(
                    category=ChangeCategory.RESOURCE_REASSIGNED,
                    field=f"assignments[{res_id}].action",
                    previous_value=old_a.action,
                    new_value=new_a.action,
                    description=f"Resource {res_id} action changed from {old_a.action} to {new_a.action}"
                ))
                is_significant = True
                
            # Route change
            if old_a.route.route_status != new_a.route.route_status:
                changes.append(PlanChange(
                    category=ChangeCategory.ROUTE_CHANGED,
                    field=f"assignments[{res_id}].route.route_status",
                    previous_value=old_a.route.route_status.value,
                    new_value=new_a.route.route_status.value,
                    description=f"Route status for {res_id} changed from {old_a.route.route_status.value} to {new_a.route.route_status.value}"
                ))
            elif abs(old_a.route.distance_km - new_a.route.distance_km) > 0.5: # 500m difference threshold
                changes.append(PlanChange(
                    category=ChangeCategory.ROUTE_CHANGED,
                    field=f"assignments[{res_id}].route.distance_km",
                    previous_value=f"{old_a.route.distance_km:.1f}",
                    new_value=f"{new_a.route.distance_km:.1f}",
                    description=f"Route distance for {res_id} changed significantly"
                ))

    return changes, is_significant
