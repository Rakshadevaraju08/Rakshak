import logging
from typing import List, Tuple, Optional

from app.schemas.domain import RouteResult, RoadAccessStatus, DecisionProvenance, Road
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
        blocked_roads: Optional[List[Road]] = None
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
            provenance = DecisionProvenance(
                agent="RouteAgent",
                method="validation",
                confidence=1.0,
                inputs=["origin_lat", "origin_lon"],
                reasons=["Missing coordinates"],
                warnings=[w.message for w in pipeline_warnings],
                fallback_used=False
            )
            result = RouteResult(
                resource_id=resource_id,
                destination_id=destination_id,
                estimated_time_mins=0.0,
                distance_km=0.0,
                waypoints=[],
                route_status=RoadAccessStatus.ROUTE_UNAVAILABLE,
                explanation="Resource coordinates are missing. Route cannot be computed.",
                decision_provenance=provenance
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
            provenance = DecisionProvenance(
                agent="RouteAgent",
                method="validation",
                confidence=1.0,
                inputs=["dest_lat", "dest_lon"],
                reasons=["Missing coordinates"],
                warnings=[w.message for w in pipeline_warnings],
                fallback_used=False
            )
            result = RouteResult(
                resource_id=resource_id,
                destination_id=destination_id,
                estimated_time_mins=0.0,
                distance_km=0.0,
                waypoints=[],
                route_status=RoadAccessStatus.ROUTE_UNAVAILABLE,
                explanation="Destination coordinates are missing. Route cannot be computed.",
                decision_provenance=provenance
            )
            result._pipeline_warnings = pipeline_warnings
            return result

        route_data = self.routing_service.get_route(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon
        )
        
        # Collect routing service warnings
        route_warnings = route_data.get("warnings", [])
        pipeline_warnings.extend(route_warnings)

        # Check against blocked roads
        is_blocked = False
        blocked_reason = ""
        if blocked_roads and route_data["success"]:
            for br in blocked_roads:
                if br.latitude is None or br.longitude is None:
                    continue
                # Simple distance check between blocked road and waypoints
                # If any waypoint is within 0.5km of the blocked road, mark blocked
                for wp in route_data.get("waypoints", []):
                    dist, _ = self.routing_service._calculate_straight_line(br.latitude, br.longitude, wp[0], wp[1])
                    if dist < 0.5:
                        is_blocked = True
                        blocked_reason = f"Route intersects known blocked road: {br.name}"
                        break
                if is_blocked:
                    break

        status = RoadAccessStatus.OPEN if route_data["success"] else RoadAccessStatus.ROUTE_UNAVAILABLE
        if is_blocked:
            status = RoadAccessStatus.BLOCKED
            w = PipelineWarning(
                code=WarningCode.ROUTE_FAILURE,
                source="RouteAgent",
                message=f"Route for '{resource_id}' traverses a blocked road ({blocked_reason}).",
            )
            w.log()
            pipeline_warnings.append(w)
            
        # Format textual explanation
        route_source = "OSRM" if route_data["success"] else "FALLBACK"
        route_str = " \u2192 ".join([resource_id] + route_data.get("route_names", []) + ["Incident Zone"])
        
        if is_blocked:
            explanation = (
                f"Recommended Resource: {resource_id}\n"
                f"Recommended Route: {route_str}\n"
                f"Distance: {route_data['distance_km']} km\n"
                f"Estimated Time: {route_data['time_mins']} min\n"
                f"Route Source: {route_source}\n"
                f"Reason: {blocked_reason}"
            )
        else:
            reason = "Shortest currently valid route with the assigned resource." if route_data["success"] else "Road-network route unavailable; ETA is approximate."
            explanation = (
                f"Recommended Resource: {resource_id}\n"
                f"Recommended Route: {route_str}\n"
                f"Distance: {route_data['distance_km']} km\n"
                f"Estimated Time: {route_data['time_mins']} min\n"
                f"Route Source: {route_source}\n"
                f"Reason: {reason}"
            )
        
        provenance = DecisionProvenance(
            agent="RouteAgent",
            method="osrm" if route_data["success"] else "fallback_straight_line",
            confidence=1.0 if not is_blocked and route_data["success"] else 0.5,
            inputs=["origin", "destination", "blocked_roads"],
            reasons=[explanation],
            warnings=[w.message for w in pipeline_warnings],
            fallback_used=not route_data["success"]
        )

        result = RouteResult(
            resource_id=resource_id,
            destination_id=destination_id,
            estimated_time_mins=route_data["time_mins"],
            distance_km=route_data["distance_km"],
            waypoints=route_data["waypoints"],
            route_status=status,
            explanation=explanation,
            decision_provenance=provenance
        )
        
        if not route_data["success"]:
            result.used_fallback = True
            result.fallback_reason = "OSRM routing unavailable. Using straight-line distance estimates."
            result.degraded_mode = True
            
        result._pipeline_warnings = pipeline_warnings
        return result
