import logging
from typing import List

from app.schemas.domain import (
    DisasterAnalysisRequest,
    FullResponsePlan,
    PipelineWarningResponse,
    RecommendedAction,
    RiskLevel,
    ResponsePlanRevision,
    ResponsePlanRevision,
    DisasterAnalysisState,
    QualityStatus,
    SafetyStatus,
    PipelineTrace,
    TraceStep,
    TraceStepStatus
)
from app.agents.data_quality_agent import DataQualityAgent
from app.agents.situation_agent import SituationAgent
from app.agents.risk_agent import RiskAgent
from app.agents.predictive_agent import PredictiveAgent
from app.agents.resource_agent import ResourceAgent
from app.agents.route_agent import RouteAgent
from app.agents.safety_checker import ResponseSafetyChecker
from app.agents.autonomy_decision_maker import AutonomyDecisionMaker
from app.agents.validation import validate_routes, validate_coordinator_plan
from app.errors import PipelineWarning, WarningCode, safe_execute
from app.services.plan_diff import compute_plan_diff
from app.services.plan_invalidation import check_plan_invalidation
from app.logging_config import AuditLogger
import time
from datetime import datetime
from contextlib import contextmanager

logger = logging.getLogger("disaster.coordinator")


class MasterCoordinator:
    """
    The Master Coordinator orchestrates the entire AI pipeline.
    It combines results from all specialized agents into a FullResponsePlan.
    Gracefully handles failures in optional components to ensure system stability.
    """

    def __init__(self, use_ml_risk: bool = False):
        self.data_quality_agent = DataQualityAgent()
        self.situation_agent = SituationAgent()
        self.risk_agent = RiskAgent(use_ml=use_ml_risk)
        self.predictive_agent = PredictiveAgent()
        self.resource_agent = ResourceAgent()
        self.route_agent = RouteAgent()
        self.safety_checker = ResponseSafetyChecker()
        self.autonomy_decision_maker = AutonomyDecisionMaker()

    @contextmanager
    def _trace_step(self, trace: PipelineTrace, step_name: str, agent_name: str):
        start = time.perf_counter()
        step = TraceStep(
            trace_id=trace.trace_id,
            step_name=step_name,
            agent_name=agent_name,
            status=TraceStepStatus.STARTED
        )
        trace.steps.append(step)
        
        try:
            yield step
            # If the block finishes successfully without exceptions
            if step.status == TraceStepStatus.STARTED:
                step.status = TraceStepStatus.COMPLETED
        except Exception as e:
            step.status = TraceStepStatus.FAILED
            step.errors.append(f"{type(e).__name__}: {str(e)}")
            raise
        finally:
            duration = (time.perf_counter() - start) * 1000
            step.execution_time_ms = round(duration, 2)

    def analyze(self, request: DisasterAnalysisRequest) -> FullResponsePlan:
        trace = PipelineTrace()
        with self._trace_step(trace, "Request Received", "MasterCoordinator"):
            explanation: List[str] = []
            all_warnings: List[PipelineWarning] = []
            degraded = False
            
            state = DisasterAnalysisState(request=request)
        
        # 0. Run Data Quality Agent (Provenance)
        with self._trace_step(trace, "Data Quality Analysis", "DataQualityAgent") as step:
            try:
                state = self.data_quality_agent.analyze(state)
                dq = state.data_quality
                if dq.warnings:
                    explanation.extend(dq.warnings)
                if dq.provenance:
                    explanation.extend(dq.provenance)
                all_warnings.extend(getattr(dq, '_pipeline_warnings', []))
                if dq.overall_quality == QualityStatus.INVALID:
                    degraded = True
            except Exception as e:
                logger.error(f"Data Quality Agent failed critically: {type(e).__name__}")
                raise RuntimeError("Data quality analysis is a strict dependency but it failed.") from e

        # 1. Run Situation Agent (Required)
        with self._trace_step(trace, "Situation Analysis", "SituationAgent") as step:
            try:
                state = self.situation_agent.analyze(state)
                situation = state.situation
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
        with self._trace_step(trace, "Risk Analysis", "RiskAgent") as step:
            try:
                state = self.risk_agent.analyze(state)
                risk = state.risk
                explanation.extend(risk.reasons)
                # Collect structured warnings from the agent
                all_warnings.extend(getattr(risk, '_pipeline_warnings', []))
            except Exception as e:
                logger.error(f"Risk Agent failed critically: {type(e).__name__}")
                raise RuntimeError("Risk analysis is a strict dependency but it failed.") from e

        # 3. Run Predictive Agent (Optional/Graceful)
        with self._trace_step(trace, "Predictive Analysis", "PredictiveAgent") as step:
            prediction = None
            pred_result, pred_warnings = safe_execute(
                self.predictive_agent.analyze,
                state,
                agent_name="PredictiveAgent",
                failure_code=WarningCode.PREDICTION_FAILURE,
            )
            all_warnings.extend(pred_warnings)
    
            if pred_result is not None:
                state = pred_result  # The agent returns the mutated state
                prediction = state.prediction
                explanation.extend(prediction.explanation)
                all_warnings.extend(getattr(prediction, '_pipeline_warnings', []))
                step.warnings = [w.message for w in getattr(prediction, '_pipeline_warnings', [])]
                step.fallback_used = getattr(prediction, 'used_fallback', False)
            else:
                degraded = True
                step.status = TraceStepStatus.FAILED

        # 4. Run Resource Agent (Optional/Graceful)
        with self._trace_step(trace, "Resource Analysis", "ResourceAgent") as step:
            resource_result = None
            assignments = []
            res_result, res_warnings = safe_execute(
                self.resource_agent.analyze,
                state,
                agent_name="ResourceAgent",
                failure_code=WarningCode.RESOURCE_FAILURE,
            )
            all_warnings.extend(res_warnings)
    
            if res_result is not None:
                state = res_result
                resource_result = state.resource_assignments
                assignments = resource_result.assignments
                explanation.extend(resource_result.reasons)
                all_warnings.extend(getattr(resource_result, '_pipeline_warnings', []))
                if resource_result.unfulfilled_requirements:
                    all_warnings.append(PipelineWarning(
                        code=WarningCode.NO_SUITABLE_RESOURCE,
                        source="MasterCoordinator",
                        message=f"Unfulfilled incident requirements for: {', '.join(resource_result.unfulfilled_requirements)}",
                    ))
                step.warnings = [w.message for w in getattr(resource_result, '_pipeline_warnings', [])]
                step.fallback_used = getattr(resource_result, 'used_fallback', False)
            else:
                degraded = True
                step.status = TraceStepStatus.FAILED

        # 5. Run Route Agent for selected resources (Optional/Graceful)
        with self._trace_step(trace, "Route Analysis", "RouteAgent") as step:
            if assignments:
                blocked_roads = [r for r in request.roads if r.status.value == "BLOCKED"]
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
                                dest_lon=request.incident.longitude,
                                blocked_roads=blocked_roads
                            )
                            
                            validated_routes, validation_warnings = validate_routes([route], state)
                            route = validated_routes[0]
                            if validation_warnings:
                                all_warnings.extend(validation_warnings)
                                for w in validation_warnings:
                                    w.log()
                                    
                            assignment.route = route
                            assignment.estimated_arrival_time_mins = route.estimated_time_mins
                            # Collect route warnings
                            all_warnings.extend(getattr(route, '_pipeline_warnings', []))
                            if getattr(route, 'used_fallback', False):
                                step.fallback_used = True
                    except Exception as e:
                        logger.warning(f"Route Agent failed for {assignment.resource_id}: {type(e).__name__}")
                        all_warnings.append(PipelineWarning(
                            code=WarningCode.ROUTE_FAILURE,
                            source="RouteAgent",
                            message=f"Route calculation failed for resource '{assignment.resource_id}'.",
                            detail=str(e),
                        ))
                        step.status = TraceStepStatus.FAILED

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
            WarningCode.STALE_DATA,
            WarningCode.DATA_CONFLICT,
        ) for w in unique_warnings):
            degraded = True
            
        state.degraded = degraded
        state.warnings = warning_responses
        
        plan = FullResponsePlan(
            incident_id=request.incident.id,
            data_quality=state.data_quality,
            situation=situation,
            risk=risk,
            prediction=prediction,
            resource_agent_result=resource_result,
            assignments=assignments,
            recommended_action=action,
            explanation=explanation,
            warnings=warning_responses,
            degraded=degraded
        )
        
        with self._trace_step(trace, "Plan Validation", "MasterCoordinator") as step:
            plan, validation_warnings = validate_coordinator_plan(plan, state)
            if validation_warnings:
                # Need to append to the pipeline responses
                for w in validation_warnings:
                    w.log()
                    plan.warnings.append(PipelineWarningResponse(
                        code=w.code,
                        source=w.source,
                        message=w.message
                    ))
                step.warnings = [w.message for w in validation_warnings]
        
        # --- Response Safety Checker ---
        with self._trace_step(trace, "Safety Check", "ResponseSafetyChecker") as step:
            safety_result = self.safety_checker.check(state, plan)
            plan.safety_check = safety_result
        
        # --- Risk-Based Autonomy Decision ---
        with self._trace_step(trace, "Autonomy Decision", "AutonomyDecisionMaker") as step:
            autonomy_decision = self.autonomy_decision_maker.decide(state, plan, safety_result)
            plan.autonomy_decision = autonomy_decision
        
        plan.explanation.append(f"Autonomy Decision [{autonomy_decision.mode.value}]: {autonomy_decision.reason}")
        if autonomy_decision.blocking_factors:
            plan.explanation.append("Blocking Factors:")
            for f in autonomy_decision.blocking_factors:
                plan.explanation.append(f"- {f}")

        trace.end_time = datetime.utcnow()
        trace.total_execution_time_ms = round((trace.end_time - trace.start_time).total_seconds() * 1000, 2)
        plan.trace = trace

        # ── Populate top-level convenience fields ──────────────────────────────────

        # overall_confidence: minimum agent confidence (weakest-link heuristic)
        agent_confidences = []
        if situation:
            agent_confidences.append(situation.confidence_score)
        if risk:
            agent_confidences.append(risk.confidence)
        if prediction:
            agent_confidences.append(prediction.confidence)
        if state.data_quality:
            agent_confidences.append(state.data_quality.confidence)
        if safety_result:
            agent_confidences.append(safety_result.confidence)
        plan.overall_confidence = round(min(agent_confidences), 3) if agent_confidences else 0.0

        # trace_id: surface from the pipeline trace for easy correlation
        plan.trace_id = trace.trace_id

        # human_review_required: from the autonomy decision
        plan.human_review_required = autonomy_decision.human_review_required

        # fallback_used: True if any agent result reports a fallback
        plan.fallback_used = any([
            bool(situation and situation.used_fallback),
            bool(risk and risk.used_fallback),
            bool(prediction and prediction.used_fallback),
            bool(resource_result and resource_result.used_fallback),
            any(bool(a.route and a.route.used_fallback) for a in assignments),
        ])

        # provenance: collect from all non-None agents
        collected_provenance = []
        for agent_result in [situation, risk, prediction, resource_result]:
            if agent_result and agent_result.decision_provenance is not None:
                collected_provenance.append(agent_result.decision_provenance)
        plan.provenance = collected_provenance

        # ─────────────────────────────────────────────────────────────────────────

        # Attach context transiently for the AuditLogger
        plan._pipeline_context = state

        AuditLogger.log_plan(plan)

        return plan

    def reanalyze(self, updated_state: DisasterAnalysisRequest,
                  previous_plan: FullResponsePlan, revision_number: int = 1) -> ResponsePlanRevision:
        """
        Re-evaluates the disaster state and compares the new plan to the previous plan,
        producing a structured revision identifying exactly what changed.
        """
        # 0. Check invalidation reasons explicitly
        invalidations = check_plan_invalidation(previous_plan, updated_state)

        # 1. Re-run the full pipeline with the updated state
        new_plan = self.analyze(updated_state)
        
        # 2. Compute the diff
        changes, is_significant = compute_plan_diff(previous_plan, new_plan)
        
        # 3. Append invalidations to explanation
        for inv in invalidations:
            new_plan.explanation.append(inv)
            
        # 4. Map diff into readable explanations
        for change in changes:
            if change.category == "ROUTE_CHANGED":
                new_plan.explanation.append(f"Recomputed plan selected new route for resource {change.field}.")
            elif change.category == "RESOURCE_ADDED":
                new_plan.explanation.append(f"Recomputed plan assigned alternative resource: {change.description}.")
            elif change.category == "ACTION_CHANGE":
                new_plan.explanation.append(change.description)
            elif change.category == "HOSPITAL_CHANGED":
                new_plan.explanation.append(f"Alternative Hospital {change.new_value} selected.")
        
        # 5. Return the structured revision
        return ResponsePlanRevision(
            revision_number=revision_number,
            incident_id=updated_state.incident.id,
            previous_action=previous_plan.recommended_action,
            new_action=new_plan.recommended_action,
            changes=changes,
            new_plan=new_plan,
            is_significant_change=is_significant
        )
