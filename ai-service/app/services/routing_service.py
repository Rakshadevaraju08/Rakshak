import os
import requests
import math
import logging
from typing import Tuple, List, Dict, Any

from app.errors import PipelineWarning, WarningCode

logger = logging.getLogger("disaster.routing")


class RoutingService:
    def __init__(self):
        # Allow override via environment variable, fallback to public demo server
        self.osrm_base_url = os.getenv("OSRM_BASE_URL", "http://router.project-osrm.org")
        self.timeout_sec = 5.0

    @staticmethod
    def _validate_coordinate(lat: float, lon: float) -> bool:
        """Return True if lat/lon are valid finite numbers in range."""
        if lat is None or lon is None:
            return False
        try:
            if not (-90.0 <= float(lat) <= 90.0):
                return False
            if not (-180.0 <= float(lon) <= 180.0):
                return False
        except (TypeError, ValueError):
            return False
        return True

    def _calculate_straight_line(self, lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
        """Calculates straight-line distance in km and assumes 60km/h for time."""
        if None in (lat1, lon1, lat2, lon2):
            return 0.0, 0.0
            
        distance_km = math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2) * 111.0
        time_mins = (distance_km / 60.0) * 60.0
        return round(distance_km, 2), round(time_mins, 2)

    def get_route(self, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> Dict[str, Any]:
        """
        Fetches route from OSRM. Returns a dictionary with route details.
        Gracefully falls back to straight-line distance if OSRM is unavailable.

        Returned dict always contains:
            success (bool), distance_km, time_mins, waypoints, explanation,
            warnings (List[PipelineWarning])
        """
        warnings: List[PipelineWarning] = []

        # --- Coordinate validation ---
        if not self._validate_coordinate(origin_lat, origin_lon):
            w = PipelineWarning(
                code=WarningCode.INVALID_COORDINATES,
                source="RoutingService",
                message=f"Invalid origin coordinates (lat={origin_lat}, lon={origin_lon}). Cannot compute route.",
            )
            w.log()
            warnings.append(w)
            return {
                "success": False,
                "distance_km": 0.0,
                "time_mins": 0.0,
                "waypoints": [],
                "explanation": "Origin coordinates are invalid or missing.",
                "warnings": warnings,
            }

        if not self._validate_coordinate(dest_lat, dest_lon):
            w = PipelineWarning(
                code=WarningCode.INVALID_COORDINATES,
                source="RoutingService",
                message=f"Invalid destination coordinates (lat={dest_lat}, lon={dest_lon}). Cannot compute route.",
            )
            w.log()
            warnings.append(w)
            return {
                "success": False,
                "distance_km": 0.0,
                "time_mins": 0.0,
                "waypoints": [],
                "explanation": "Destination coordinates are invalid or missing.",
                "warnings": warnings,
            }

        # --- OSRM call ---
        # OSRM expects coordinates in lon,lat format
        url = f"{self.osrm_base_url}/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}?overview=false"

        try:
            response = requests.get(url, timeout=self.timeout_sec)
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") == "Ok" and len(data.get("routes", [])) > 0:
                route = data["routes"][0]
                distance_km = route["distance"] / 1000.0
                time_mins = route["duration"] / 60.0
                
                return {
                    "success": True,
                    "distance_km": round(distance_km, 2),
                    "time_mins": round(time_mins, 2),
                    "waypoints": [(origin_lat, origin_lon), (dest_lat, dest_lon)],  # simplified
                    "explanation": "Successfully retrieved driving route from OSRM.",
                    "warnings": warnings,
                }
            else:
                raise ValueError("OSRM returned non-OK status or no routes.")

        except requests.exceptions.Timeout as exc:
            logger.warning("OSRM request timed out. Falling back to straight-line estimate.")
            w = PipelineWarning(
                code=WarningCode.OSRM_UNAVAILABLE,
                source="RoutingService",
                message="OSRM request timed out. Using straight-line distance estimate.",
                detail=str(exc),
            )
            w.log()
            warnings.append(w)

        except requests.exceptions.ConnectionError as exc:
            logger.warning("OSRM connection failed. Falling back to straight-line estimate.")
            w = PipelineWarning(
                code=WarningCode.OSRM_UNAVAILABLE,
                source="RoutingService",
                message="OSRM service unreachable. Using straight-line distance estimate.",
                detail=str(exc),
            )
            w.log()
            warnings.append(w)

        except Exception as exc:
            logger.warning(f"OSRM routing failed ({type(exc).__name__}). Falling back to straight-line estimate.")
            w = PipelineWarning(
                code=WarningCode.OSRM_UNAVAILABLE,
                source="RoutingService",
                message="Route calculation failed. Using straight-line distance estimate.",
                detail=str(exc),
            )
            w.log()
            warnings.append(w)

        # --- Fallback ---
        dist, time = self._calculate_straight_line(origin_lat, origin_lon, dest_lat, dest_lon)
        return {
            "success": False,
            "distance_km": dist,
            "time_mins": time,
            "waypoints": [(origin_lat, origin_lon), (dest_lat, dest_lon)],
            "explanation": "WARNING: Route unavailable. Using straight-line distance estimate for demo purposes. Not a real road route.",
            "warnings": warnings,
        }
