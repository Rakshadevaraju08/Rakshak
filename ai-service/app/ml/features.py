import math
from typing import Dict, Any, List

# Feature names explicitly defined to ensure strict ordering everywhere
RISK_FEATURE_NAMES = [
    'victim_count', 
    'elderly_count', 
    'children_count', 
    'disabled_count',
    'rainfall', 
    'water_level', 
    'road_access_blocked', 
    'is_flood', 
    'is_fire', 
    'is_earthquake'
]

PREDICTIVE_FEATURE_NAMES = [
    'rainfall_current', 
    'rainfall_1h', 
    'rainfall_3h', 
    'rainfall_6h', 
    'rainfall_24h', 
    'rainfall_trend', 
    'elevation_m'
]

def _required_number(value: Any, name: str) -> float:
    if value is None:
        raise ValueError(f"Required feature '{name}' is missing.")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"Required feature '{name}' must be finite.")
    return number

def extract_risk_features(incident_data: Dict[str, Any]) -> List[float]:
    """
    Extracts numerical feature vector for the Risk Model from raw incident dictionaries.
    Used uniformly by both training scripts and real-time inference services.
    """
    def _required_observation_value(observation: Any, name: str) -> float:
        if observation is None:
            raise ValueError(f"Required risk observation '{name}' is missing.")
        if isinstance(observation, dict):
            if observation.get("quality") == "INVALID":
                raise ValueError(f"Required risk observation '{name}' is invalid.")
            value = observation.get("value")
        else:
            value = observation
        return _required_number(value, name)

    rainfall = _required_observation_value(incident_data.get('rainfall'), 'rainfall')
    water_level = _required_observation_value(incident_data.get('water_level'), 'water_level')

    road_access = incident_data.get('road_access')
    if hasattr(road_access, "value"):
        road_access = road_access.value
    if road_access is None:
        raise ValueError("Required risk feature 'road_access' is missing.")
    if road_access not in {'OPEN', 'BLOCKED', 'ROUTE_UNAVAILABLE'}:
        raise ValueError(f"Risk model does not support road access status '{road_access}'.")
    road_blocked = 1.0 if road_access in ('BLOCKED', 'ROUTE_UNAVAILABLE') else 0.0

    incident_type = incident_data.get('type')
    if hasattr(incident_type, "value"):
        incident_type = incident_type.value
    if incident_type not in {'FLOOD', 'FIRE', 'EARTHQUAKE', 'OTHER'}:
        raise ValueError(f"Risk model does not support incident type '{incident_type}'.")
    is_flood = 1.0 if incident_type == 'FLOOD' else 0.0
    is_fire = 1.0 if incident_type == 'FIRE' else 0.0
    is_earthquake = 1.0 if incident_type == 'EARTHQUAKE' else 0.0
    
    return [
        _required_number(incident_data.get('victim_count'), 'victim_count'),
        _required_number(incident_data.get('elderly_count'), 'elderly_count'),
        _required_number(incident_data.get('children_count'), 'children_count'),
        _required_number(incident_data.get('disabled_count'), 'disabled_count'),
        rainfall,
        water_level,
        road_blocked,
        is_flood,
        is_fire,
        is_earthquake
    ]

def extract_predictive_features(env_data: Dict[str, Any]) -> List[float]:
    """
    Extracts complete, finite measurements for the Predictive Model.
    """
    return [
        _required_number(env_data.get(name), name)
        for name in PREDICTIVE_FEATURE_NAMES
    ]
