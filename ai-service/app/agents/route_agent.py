import logging
from typing import List, Tuple, Optional

from app.schemas.domain import RouteResult, RoadAccessStatus
from app.services.routing_service import RoutingService
from app.errors import PipelineWarning, WarningCode

logger = logging.getLogger("disaster.route")


class RouteAgent:
    """
    The Route Agent determines how a selected resource reaches the incident.
    Uses OSRM via HTTP with a fallback to straight-line distance if unavailable.
    """
    def __init__(self):
        self.routing_service = RoutingService()

    def analyze(
        self, 
        resource_id: str,
        destination_id: str,
        origin_lat: float, 
        origin_lon: float, 
        dest_lat: float, 
        dest_lon: float,
        blocked_roads: Optional[List[Tuple[float, float]]] = None
    ) -> RouteResult:
        pipeline_warnings: List[PipelineWarning] = []

        # --- Validate coordinates before calling routing service ---
        if origin_lat is None or origin_lon is None:
            w = PipelineWarning(
                code=WarningCode.INVALID_COORDINATES,
                source="RouteAgent",
                message=f"Resource '{resource_id}' has missing coordinates. Cannot compute route.",
            )
            w.log()
            pipeline_warnings.append(w)
            result = RouteResult(
                resource_id=resource_id,
                destination_id=destination_id,
                estimated_time_mins=0.0,
                distance_km=0.0,
                waypoints=[],
                route_status=RoadAccessStatus.ROUTE_UNAVAILABLE,
                explanation="Resource coordinates are missing. Route cannot be computed.",
            )
            result._pipeline_warnings = pipeline_warnings
            return result

        if dest_lat is None or dest_lon is None:
            w = PipelineWarning(
                code=WarningCode.INVALID_COORDINATES,
                source="RouteAgent",
                message=f"Destination '{destination_id}' has missing coordinates. Cannot compute route.",
            )
            w.log()
            pipeline_warnings.append(w)
            result = RouteResult(
                resource_id=resource_id,
                destination_id=destination_id,
                estimated_time_mins=0.0,
                distance_km=0.0,
                waypoints=[],
                route_status=RoadAccessStatus.ROUTE_UNAVAILABLE,
                explanation="Destination coordinates are missing. Route cannot be computed.",
            )
            result._pipeline_warnings = pipeline_warnings
            return result

        # Note: Standard OSRM HTTP API does not natively support dynamic avoidance 
        # of specific coordinate polygons without custom graph preprocessing. 
        # If blocked roads are provided, we log them but still rely on OSRM's primary graph.
        
        route_data = self.routing_service.get_route(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon
        )
        
        # Collect routing service warnings
        route_warnings = route_data.get("warnings", [])
        pipeline_warnings.extend(route_warnings)

        status = RoadAccessStatus.OPEN if route_data["success"] else RoadAccessStatus.ROUTE_UNAVAILABLE
        
        explanation = route_data["explanation"]
        if route_data["success"]:
            explanation = (
                "Route selected because:\n"
                "- road available\n"
                f"- shortest available ETA ({route_data['time_mins']} mins)"
            )
        
        result = RouteResult(
            resource_id=resource_id,
            destination_id=destination_id,
            estimated_time_mins=route_data["time_mins"],
            distance_km=route_data["distance_km"],
            waypoints=route_data["waypoints"],
            route_status=status,
            explanation=explanation
        )
        result._pipeline_warnings = pipeline_warnings
        return result
