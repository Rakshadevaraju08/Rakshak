from typing import List
from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    ResourceAgentResult,
    ResourceAssignment,
    RouteResult,
    RoadAccessStatus
)
from app.services.optimization_service import OptimizationService

class ResourceAgent:
    """
    The Resource Agent maps available resources to incidents using Google OR-Tools.
    Prioritizes capable, available resources for higher-priority incidents 
    while minimizing travel distance.
    """

    def __init__(self):
        self.optimizer = OptimizationService()

    def analyze(self, request: DisasterAnalysisRequest, risk_result: RiskResult) -> ResourceAgentResult:
        # Prepare inputs for optimization
        # The agent can easily be extended to handle multiple incidents in the future,
        # but for now we wrap the single incident from the request.
        incidents = [(request.incident, risk_result.priority.value)]
        resources = request.resources

        # Run optimization
        opt_result = self.optimizer.optimize_dispatch(incidents, resources)
        
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
                waypoints=[], # To be filled by Route Agent/OSRM later
                route_status=RoadAccessStatus.OPEN # Placeholder
            )

            assignment = ResourceAssignment(
                resource_id=res.id,
                action="DISPATCH_TO_INCIDENT",
                route=route,
                estimated_arrival_time_mins=round(est_time_mins, 2)
            )
            assignments.append(assignment)
            reasons.append(f"Assigned {res.type.value} '{res.id}' to incident '{inc.id}' (Distance: {round(dist, 2)}km).")

        # Process Unfulfilled
        for inc in opt_result["unfulfilled_incidents"]:
            unfulfilled.append(inc.id)
            reasons.append(f"Failed to find a compatible/available resource for incident '{inc.id}'.")

        return ResourceAgentResult(
            assignments=assignments,
            unfulfilled_requirements=unfulfilled,
            reasons=reasons
        )
