import logging
from typing import List

from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    ResourceAgentResult,
    ResourceAssignment,
    RouteResult,
    RoadAccessStatus,
    DisasterAnalysisState,
    DecisionProvenance
)
from app.services.optimization_service import OptimizationService
from app.errors import PipelineWarning, WarningCode
from app.agents.validation import validate_resources

logger = logging.getLogger("disaster.resource")


class ResourceAgent:
    """
    The Resource Agent maps available resources to incidents using Google OR-Tools.
    Prioritizes capable, available resources for higher-priority incidents 
    while minimizing travel distance.
    """

    def __init__(self):
        self.optimizer = OptimizationService()

    def analyze(self, state: DisasterAnalysisState) -> DisasterAnalysisState:
        pipeline_warnings: List[PipelineWarning] = []
        request = state.request
        risk_result = state.risk
        
        if not risk_result:
            raise ValueError("ResourceAgent requires risk assessment to be present in the state.")

        # --- Guard: no resources provided ---
        if not request.resources:
            w = PipelineWarning(
                code=WarningCode.MISSING_RESOURCES,
                source="ResourceAgent",
                message="No resources provided in the request. Cannot dispatch any units.",
            )
            w.log()
            pipeline_warnings.append(w)
            result = ResourceAgentResult(
                assignments=[],
                unfulfilled_requirements=[request.incident.id],
                reasons=["No resources were provided in the request."],
            )
            result._pipeline_warnings = pipeline_warnings
            state.resource_assignments = result
            return state

        # --- Guard: empty hospital list (warning only, not blocking) ---
        if not request.hospitals:
            w = PipelineWarning(
                code=WarningCode.EMPTY_HOSPITAL_LIST,
                source="ResourceAgent",
                message="No hospitals provided. Medical evacuation routing will be unavailable.",
            )
            w.log()
            pipeline_warnings.append(w)

        # Prepare inputs for optimization
        # The agent can easily be extended to handle multiple incidents in the future,
        # but for now we wrap the single incident from the request.
        incidents = [(request.incident, risk_result.priority.value)]
        resources = request.resources

        # Run optimization
        try:
            opt_result = self.optimizer.optimize_dispatch(incidents, resources)
        except Exception as exc:
            logger.error(f"Optimization service raised an exception: {type(exc).__name__}")
            w = PipelineWarning(
                code=WarningCode.OPTIMIZATION_FAILURE,
                source="ResourceAgent",
                message=f"Resource optimization failed ({type(exc).__name__}). No resources dispatched.",
                detail=str(exc),
            )
            w.log()
            pipeline_warnings.append(w)
            result = ResourceAgentResult(
                assignments=[],
                unfulfilled_requirements=[request.incident.id],
                reasons=[f"Optimization failed: {type(exc).__name__}"],
            )
            result._pipeline_warnings = pipeline_warnings
            state.resource_assignments = result
            return state

        # Collect any warnings from the optimization service
        opt_warnings = opt_result.get("warnings", [])
        pipeline_warnings.extend(opt_warnings)

        assignments: List[ResourceAssignment] = []
        reasons: List[str] = []
        unfulfilled: List[str] = []

        # Process Assignments
        for mapping in opt_result["assignments"]:
            res = mapping["resource"]
            inc = mapping["incident"]
            dist = mapping["distance_km"]
            
            # Simulated speed of 60km/h for Euclidean distances
            est_time_mins = (dist / 60.0) * 60.0

            route = RouteResult(
                resource_id=res.id,
                destination_id=inc.id,
                estimated_time_mins=round(est_time_mins, 2),
                distance_km=round(dist, 2),
                waypoints=[],  # To be filled by Route Agent/OSRM later
                route_status=RoadAccessStatus.OPEN  # Placeholder
            )

            assignment = ResourceAssignment(
                resource_id=res.id,
                action="DISPATCH_TO_INCIDENT",
                route=route,
                estimated_arrival_time_mins=round(est_time_mins, 2)
            )
            assignments.append(assignment)
            reasons.append(
                f"{res.type.value} '{res.id}' selected because:\n"
                f"- available\n"
                f"- compatible\n"
                f"- closest suitable resource ({round(dist, 2)}km)"
            )

        # Process Unfulfilled
        for inc in opt_result["unfulfilled_incidents"]:
            unfulfilled.append(inc.id)
            reasons.append(f"Failed to find a compatible/available resource for incident '{inc.id}'.")

        # Emit structured warning for unfulfilled incidents
        if unfulfilled:
            w = PipelineWarning(
                code=WarningCode.NO_SUITABLE_RESOURCE,
                source="ResourceAgent",
                message=f"No suitable resource found for incident(s): {', '.join(unfulfilled)}.",
            )
            w.log()
            pipeline_warnings.append(w)

        provenance = DecisionProvenance(
            agent="ResourceAgent",
            method="or_tools_optimization",
            confidence=1.0,  # Optimization is deterministic given inputs
            inputs=["resources", "incident_priority", "locations"],
            reasons=reasons,
            warnings=[w.message for w in pipeline_warnings],
            fallback_used=False
        )

        result = ResourceAgentResult(
            assignments=assignments,
            unfulfilled_requirements=unfulfilled,
            reasons=reasons,
            decision_provenance=provenance
        )
        
        result, validation_warnings = validate_resources(result, state)
        if validation_warnings:
            pipeline_warnings.extend(validation_warnings)
            for w in validation_warnings:
                w.log()
                
        result._pipeline_warnings = pipeline_warnings
        state.resource_assignments = result
        return state
