import logging
from typing import List

from app.schemas.domain import (
    DisasterAnalysisRequest,
    FullResponsePlan,
    PipelineWarningResponse,
    RecommendedAction,
    RiskLevel,
    ResponsePlanRevision
)
from app.agents.situation_agent import SituationAgent
from app.agents.risk_agent import RiskAgent
from app.agents.predictive_agent import PredictiveAgent
from app.agents.resource_agent import ResourceAgent
from app.agents.route_agent import RouteAgent
from app.errors import PipelineWarning, WarningCode, safe_execute
from app.services.plan_diff import compute_plan_diff

logger = logging.getLogger("disaster.coordinator")


class MasterCoordinator:
    """
    The Master Coordinator orchestrates the entire AI pipeline.
    It combines results from all specialized agents into a FullResponsePlan.
    Gracefully handles failures in optional components to ensure system stability.
    """

    def __init__(self, use_ml_risk: bool = False):
        self.situation_agent = SituationAgent()
        self.risk_agent = RiskAgent(use_ml=use_ml_risk)
        self.predictive_agent = PredictiveAgent()
        self.resource_agent = ResourceAgent()
        self.route_agent = RouteAgent()

    def analyze(self, request: DisasterAnalysisRequest) -> FullResponsePlan:
        explanation: List[str] = []
        all_warnings: List[PipelineWarning] = []
        degraded = False
        
        # 1. Run Situation Agent (Required)
        try:
            situation = self.situation_agent.analyze(request)
            if situation.missing_information:
                all_warnings.append(PipelineWarning(
                    code=WarningCode.INCOMPLETE_INCIDENT,
                    source="SituationAgent",
                    message=f"Missing data: {', '.join(situation.missing_information)}",
                ))
            explanation.extend(situation.explanations)
            # Collect structured warnings from the agent
            all_warnings.extend(getattr(situation, '_pipeline_warnings', []))
        except Exception as e:
            logger.error(f"Situation Agent failed critically: {type(e).__name__}")
            raise RuntimeError("Situation analysis is a strict dependency but it failed.") from e

        # 2. Run Risk Agent (Required)
        try:
            risk = self.risk_agent.analyze(request)
            explanation.extend(risk.reasons)
            # Collect structured warnings from the agent
            all_warnings.extend(getattr(risk, '_pipeline_warnings', []))
        except Exception as e:
            logger.error(f"Risk Agent failed critically: {type(e).__name__}")
            raise RuntimeError("Risk analysis is a strict dependency but it failed.") from e

        # 3. Run Predictive Agent (Optional/Graceful)
        prediction = None
        pred_result, pred_warnings = safe_execute(
            self.predictive_agent.analyze,
            request, risk,
            agent_name="PredictiveAgent",
            failure_code=WarningCode.PREDICTION_FAILURE,
        )
        all_warnings.extend(pred_warnings)

        if pred_result is not None:
            prediction = pred_result
            explanation.extend(prediction.explanation)
            all_warnings.extend(getattr(prediction, '_pipeline_warnings', []))
        else:
            degraded = True

        # 4. Run Resource Agent (Optional/Graceful)
        resource_result = None
        assignments = []
        res_result, res_warnings = safe_execute(
            self.resource_agent.analyze,
            request, risk,
            agent_name="ResourceAgent",
            failure_code=WarningCode.RESOURCE_FAILURE,
        )
        all_warnings.extend(res_warnings)

        if res_result is not None:
            resource_result = res_result
            assignments = resource_result.assignments
            explanation.extend(resource_result.reasons)
            all_warnings.extend(getattr(resource_result, '_pipeline_warnings', []))
            if resource_result.unfulfilled_requirements:
                all_warnings.append(PipelineWarning(
                    code=WarningCode.NO_SUITABLE_RESOURCE,
                    source="MasterCoordinator",
                    message=f"Unfulfilled incident requirements for: {', '.join(resource_result.unfulfilled_requirements)}",
                ))
        else:
            degraded = True

        # 5. Run Route Agent for selected resources (Optional/Graceful)
        if assignments:
            for assignment in assignments:
                try:
                    # Find the resource object from the request
                    res_obj = next((r for r in request.resources if r.id == assignment.resource_id), None)
                    if res_obj:
                        route = self.route_agent.analyze(
                            resource_id=res_obj.id,
                            destination_id=request.incident.id,
                            origin_lat=res_obj.latitude,
                            origin_lon=res_obj.longitude,
                            dest_lat=request.incident.latitude,
                            dest_lon=request.incident.longitude
                        )
                        assignment.route = route
                        assignment.estimated_arrival_time_mins = route.estimated_time_mins
                        # Collect route warnings
                        all_warnings.extend(getattr(route, '_pipeline_warnings', []))
                except Exception as e:
                    logger.warning(f"Route Agent failed for {assignment.resource_id}: {type(e).__name__}")
                    all_warnings.append(PipelineWarning(
                        code=WarningCode.ROUTE_FAILURE,
                        source="RouteAgent",
                        message=f"Route calculation failed for resource '{assignment.resource_id}'.",
                        detail=str(e),
                    ))

        # 6. Determine Recommended Action
        escalating = prediction.escalation_detected if prediction else False
        risk_lvl = risk.risk_level

        if risk_lvl == RiskLevel.CRITICAL:
            action = RecommendedAction.IMMEDIATE_DISPATCH
        elif risk_lvl == RiskLevel.HIGH and escalating:
            action = RecommendedAction.IMMEDIATE_DISPATCH
        elif risk_lvl == RiskLevel.HIGH:
            action = RecommendedAction.DISPATCH
        elif risk_lvl == RiskLevel.MEDIUM and escalating:
            action = RecommendedAction.PRE_POSITION
        elif risk_lvl == RiskLevel.MEDIUM:
            action = RecommendedAction.PREPARE
        else:
            action = RecommendedAction.MONITOR

        action_reasons = [f"risk level is {risk_lvl.value}"]
        if escalating:
            action_reasons.append("predicted escalation detected")
        if risk and risk.reasons and "vulnerable" in risk.reasons[0]:
            action_reasons.append("vulnerable individuals present")
            
        action_explanation = f"{action.value} recommended because:\n" + "\n".join(f"- {r}" for r in action_reasons)
        explanation.append(action_explanation)

        # Deduplicate warnings (same code+source+message)
        seen = set()
        unique_warnings: List[PipelineWarning] = []
        for w in all_warnings:
            key = (w.code, w.source, w.message)
            if key not in seen:
                seen.add(key)
                unique_warnings.append(w)

        # Convert to API-safe response format (drop 'detail' field)
        warning_responses = [
            PipelineWarningResponse(
                code=w.code,
                source=w.source,
                message=w.message,
            )
            for w in unique_warnings
        ]

        # Mark degraded if any warnings exist from agent failures
        if any(w.code in (
            WarningCode.PREDICTION_FAILURE,
            WarningCode.RESOURCE_FAILURE,
            WarningCode.OPTIMIZATION_FAILURE,
            WarningCode.OSRM_UNAVAILABLE,
            WarningCode.MODEL_FILE_MISSING,
            WarningCode.MODEL_PREDICTION_FAILED,
        ) for w in unique_warnings):
            degraded = True

        plan = FullResponsePlan(
            incident_id=request.incident.id,
            situation=situation,
            risk=risk,
            prediction=prediction,
            assignments=assignments,
            recommended_action=action,
            explanation=explanation,
            warnings=warning_responses,
            degraded=degraded,
            human_approval_required=True
        )

        return plan

    def reanalyze(self, updated_state: DisasterAnalysisRequest,
                  previous_plan: FullResponsePlan, revision_number: int = 1) -> ResponsePlanRevision:
        """
        Re-evaluates the disaster state and compares the new plan to the previous plan,
        producing a structured revision identifying exactly what changed.
        """
        # 1. Re-run the full pipeline with the updated state
        new_plan = self.analyze(updated_state)
        
        # 2. Compute the diff
        changes, is_significant = compute_plan_diff(previous_plan, new_plan)
        
        # 3. Return the structured revision
        return ResponsePlanRevision(
            revision_number=revision_number,
            incident_id=updated_state.incident.id,
            previous_action=previous_plan.recommended_action,
            new_action=new_plan.recommended_action,
            changes=changes,
            new_plan=new_plan,
            is_significant_change=is_significant
        )
