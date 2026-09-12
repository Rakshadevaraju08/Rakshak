from typing import List, Tuple, Optional
from app.schemas.domain import RouteResult, RoadAccessStatus
from app.services.routing_service import RoutingService

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
        
        # Note: Standard OSRM HTTP API does not natively support dynamic avoidance 
        # of specific coordinate polygons without custom graph preprocessing. 
        # If blocked roads are provided, we log them but still rely on OSRM's primary graph.
        
        route_data = self.routing_service.get_route(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon
        )
        
        status = RoadAccessStatus.OPEN if route_data["success"] else RoadAccessStatus.ROUTE_UNAVAILABLE
        
        return RouteResult(
            resource_id=resource_id,
            destination_id=destination_id,
            estimated_time_mins=route_data["time_mins"],
            distance_km=route_data["distance_km"],
            waypoints=route_data["waypoints"],
            route_status=status,
            explanation=route_data["explanation"]
        )
