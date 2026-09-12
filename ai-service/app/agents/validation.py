import logging
from typing import Tuple, List, Optional
import math

from app.schemas.domain import (
    DisasterAnalysisState,
    SituationResult,
    RiskResult,
    Priority,
    RiskLevel,
    PredictiveAgentResult,
    ForecastItem,
    ResourceAgentResult,
    RouteResult,
    RoadAccessStatus,
    FullResponsePlan,
    RecommendedAction
)
from app.errors import PipelineWarning, WarningCode

logger = logging.getLogger("disaster.validation")

def validate_situation(result: SituationResult, state: DisasterAnalysisState) -> Tuple[SituationResult, List[PipelineWarning]]:
    warnings = []
    
    # 1. Victim counts >= 0
    total_victims = state.request.incident.victim_count
    vulnerable = state.request.incident.elderly_count + state.request.incident.children_count + state.request.incident.disabled_count
    
    if total_victims < 0:
        warnings.append(PipelineWarning(
            code=WarningCode.MALFORMED_INPUT,
            source="SituationValidation",
            message=f"Negative victim count detected ({total_victims}). Clamped to 0."
        ))
        result.confidence_score -= 0.1
        state.request.incident.victim_count = 0
        total_victims = 0

    if vulnerable < 0:
        warnings.append(PipelineWarning(
            code=WarningCode.MALFORMED_INPUT,
            source="SituationValidation",
            message=f"Negative vulnerable count detected ({vulnerable}). Clamped to 0."
        ))
        result.confidence_score -= 0.1
        vulnerable = 0

    # 2. Vulnerable <= Total
    if vulnerable > total_victims:
        warnings.append(PipelineWarning(
            code=WarningCode.MALFORMED_INPUT,
            source="SituationValidation",
            message=f"Total vulnerable victims ({vulnerable}) exceeds total victim count ({total_victims}). Adjusting total victims to match."
        ))
        result.is_valid = False
        result.confidence_score -= 0.2
        state.request.incident.victim_count = vulnerable
        result.explanations.append(f"Auto-corrected total victim count from {total_victims} to {vulnerable} based on validation constraints.")

    # 3. Valid location bounds
    lat = state.request.incident.latitude
    lon = state.request.incident.longitude
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        warnings.append(PipelineWarning(
            code=WarningCode.INVALID_COORDINATES,
            source="SituationValidation",
            message=f"Invalid coordinates ({lat}, {lon}). Marking as invalid."
        ))
        result.is_valid = False
        result.confidence_score = 0.0

    result.confidence_score = max(0.0, min(1.0, result.confidence_score))
    return result, warnings


def validate_risk(result: RiskResult, state: DisasterAnalysisState) -> Tuple[RiskResult, List[PipelineWarning]]:
    warnings = []
    
    # Priority enum should inherently limit priority choices, but let's ensure score is bounded
    if not (0.0 <= result.score <= 100.0):
        warnings.append(PipelineWarning(
            code=WarningCode.RISK_FAILURE,
            source="RiskValidation",
            message=f"Risk score {result.score} is out of bounds (0-100). Clamping."
        ))
        result.score = max(0.0, min(100.0, result.score))
        
    if not result.reasons:
        warnings.append(PipelineWarning(
            code=WarningCode.RISK_FAILURE,
            source="RiskValidation",
            message="Risk assessment provided no reasons. Supplying generic fallback."
        ))
        result.reasons.append("Generic fallback reason due to empty validation.")
        result.confidence -= 0.2
        
    result.confidence = max(0.0, min(1.0, result.confidence))
    return result, warnings


def validate_prediction(result: PredictiveAgentResult, state: DisasterAnalysisState) -> Tuple[PredictiveAgentResult, List[PipelineWarning]]:
    warnings = []
    
    if not result.forecast:
        warnings.append(PipelineWarning(
            code=WarningCode.PREDICTION_FAILURE,
            source="PredictiveValidation",
            message="No forecast items returned. Injecting default stable forecast."
        ))
        result.forecast.append(ForecastItem(horizon_minutes=60, risk_level=result.current_risk))
        result.escalation_detected = False
        result.confidence -= 0.5
        
    for item in result.forecast:
        if item.horizon_minutes <= 0:
            warnings.append(PipelineWarning(
                code=WarningCode.PREDICTION_FAILURE,
                source="PredictiveValidation",
                message=f"Invalid forecast horizon ({item.horizon_minutes}m). Clamping to 60m."
            ))
            item.horizon_minutes = 60
            result.confidence -= 0.1

    if not result.explanation:
        result.explanation.append("Fallback prediction explanation.")
            
    result.confidence = max(0.0, min(1.0, result.confidence))
    return result, warnings


def validate_resources(result: ResourceAgentResult, state: DisasterAnalysisState) -> Tuple[ResourceAgentResult, List[PipelineWarning]]:
    warnings = []
    
    available_resources = {r.id: r for r in state.request.resources if r.status.value == "AVAILABLE"}
    seen_assigned = set()
    
    valid_assignments = []
    for assignment in result.assignments:
        rid = assignment.resource_id
        
        if rid in seen_assigned:
            warnings.append(PipelineWarning(
                code=WarningCode.RESOURCE_FAILURE,
                source="ResourceValidation",
                message=f"Resource {rid} was assigned multiple times. Removing duplicates."
            ))
            continue
            
        if rid not in available_resources:
            warnings.append(PipelineWarning(
                code=WarningCode.RESOURCE_FAILURE,
                source="ResourceValidation",
                message=f"Resource {rid} does not exist or is not available. Removing from assignment."
            ))
            result.unfulfilled_requirements.append(rid)
            continue
            
        seen_assigned.add(rid)
        valid_assignments.append(assignment)
        
    result.assignments = valid_assignments
    return result, warnings


def validate_routes(routes: List[RouteResult], state: DisasterAnalysisState) -> Tuple[List[RouteResult], List[PipelineWarning]]:
    warnings = []
    
    for route in routes:
        if route.estimated_time_mins < 0:
            warnings.append(PipelineWarning(
                code=WarningCode.ROUTE_FAILURE,
                source="RouteValidation",
                message=f"Negative ETA for route {route.resource_id}. Fallback applied."
            ))
            route.estimated_time_mins = 60.0
            
        if route.distance_km < 0:
            warnings.append(PipelineWarning(
                code=WarningCode.ROUTE_FAILURE,
                source="RouteValidation",
                message=f"Negative distance for route {route.resource_id}. Fallback applied."
            ))
            route.distance_km = 40.0
            
        if route.route_status == RoadAccessStatus.BLOCKED:
            warnings.append(PipelineWarning(
                code=WarningCode.ROUTE_FAILURE,
                source="RouteValidation",
                message=f"Route for {route.resource_id} uses blocked access path."
            ))

    return routes, warnings


def validate_coordinator_plan(plan: FullResponsePlan, state: DisasterAnalysisState) -> Tuple[FullResponsePlan, List[PipelineWarning]]:
    warnings = []
    
    if plan.situation is None or plan.risk is None:
        warnings.append(PipelineWarning(
            code=WarningCode.SITUATION_FAILURE,
            source="CoordinatorValidation",
            message="Plan is missing required situation or risk assessments."
        ))
        plan.degraded = True
        
    if plan.recommended_action == RecommendedAction.IMMEDIATE_DISPATCH:
        if plan.risk and plan.risk.priority in [Priority.P4_LOW, Priority.P5_MONITOR]:
            warnings.append(PipelineWarning(
                code=WarningCode.OPTIMIZATION_FAILURE,
                source="CoordinatorValidation",
                message="Action is IMMEDIATE_DISPATCH but Risk Priority is LOW/MONITOR. Demoting to DISPATCH."
            ))
            plan.recommended_action = RecommendedAction.DISPATCH
            
            warnings.append(PipelineWarning(
                code=WarningCode.OPTIMIZATION_FAILURE,
                source="CoordinatorValidation",
                message="Action is IMMEDIATE_DISPATCH but zero resources were assigned. Escalating to human."
            ))

    return plan, warnings
