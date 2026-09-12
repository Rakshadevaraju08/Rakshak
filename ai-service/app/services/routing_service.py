import os
import requests
import math
import logging
from typing import Tuple, List, Dict, Any

class RoutingService:
    def __init__(self):
        # Allow override via environment variable, fallback to public demo server
        self.osrm_base_url = os.getenv("OSRM_BASE_URL", "http://router.project-osrm.org")
        self.timeout_sec = 5.0

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
        """
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
                    "waypoints": [(origin_lat, origin_lon), (dest_lat, dest_lon)], # simplified
                    "explanation": "Successfully retrieved driving route from OSRM."
                }
            else:
                raise ValueError("OSRM returned non-OK status or no routes.")
                
        except Exception as e:
            logging.warning(f"OSRM routing failed ({e}). Falling back to straight-line estimate.")
            
            # Fallback
            dist, time = self._calculate_straight_line(origin_lat, origin_lon, dest_lat, dest_lon)
            return {
                "success": False,
                "distance_km": dist,
                "time_mins": time,
                "waypoints": [(origin_lat, origin_lon), (dest_lat, dest_lon)],
                "explanation": "WARNING: Route unavailable. Using straight-line distance estimate for demo purposes. Not a real road route."
            }
