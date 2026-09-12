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

def extract_risk_features(incident_data: Dict[str, Any]) -> List[float]:
    """
    Extracts numerical feature vector for the Risk Model from raw incident dictionaries.
    Used uniformly by both training scripts and real-time inference services.
    """
    rainfall = float(incident_data.get('rainfall', 0.0) or 0.0)
    water_level = float(incident_data.get('water_level', 0.0) or 0.0)
    
    road_access = incident_data.get('road_access', 'OPEN')
    road_blocked = 1.0 if road_access == 'BLOCKED' else 0.0
    
    incident_type = incident_data.get('type', 'OTHER')
    is_flood = 1.0 if incident_type == 'FLOOD' else 0.0
    is_fire = 1.0 if incident_type == 'FIRE' else 0.0
    is_earthquake = 1.0 if incident_type == 'EARTHQUAKE' else 0.0
    
    return [
        float(incident_data.get('victim_count', 0)),
        float(incident_data.get('elderly_count', 0)),
        float(incident_data.get('children_count', 0)),
        float(incident_data.get('disabled_count', 0)),
        rainfall,
        water_level,
        road_blocked,
        is_flood,
        is_fire,
        is_earthquake
    ]

def extract_predictive_features(env_data: Dict[str, Any]) -> List[float]:
    """
    Extracts numerical feature vector for the Predictive Model from raw environment dictionaries.
    """
    return [
        float(env_data.get('rainfall_current', 0.0) or 0.0),
        float(env_data.get('rainfall_1h', 0.0) or 0.0),
        float(env_data.get('rainfall_3h', 0.0) or 0.0),
        float(env_data.get('rainfall_6h', 0.0) or 0.0),
        float(env_data.get('rainfall_24h', 0.0) or 0.0),
        float(env_data.get('rainfall_trend', 0.0) or 0.0),
        float(env_data.get('elevation_m', 50.0) or 50.0)
    ]
