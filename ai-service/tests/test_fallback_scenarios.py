import pytest
from datetime import datetime, timedelta
from typing import List

from app.schemas.domain import (
    DisasterAnalysisRequest,
    DisasterAnalysisState,
    Incident,
    IncidentType,
    Observation,
    RoadAccessStatus
)
from app.agents.risk_agent import RiskAgent
from app.agents.predictive_agent import PredictiveAgent
from app.agents.route_agent import RouteAgent
from app.agents.data_quality_agent import DataQualityAgent
from app.errors import PipelineWarning


@pytest.fixture
def base_state():
    incident = Incident(
        id="INC_FB",
        type=IncidentType.FIRE,
        latitude=10.0,
        longitude=20.0,
        victim_count=5,
    )
    request = DisasterAnalysisRequest(
        incident=incident,
        resources=[],
        hospitals=[],
        roads=[]
    )
    return DisasterAnalysisState(request=request)


def test_risk_ml_fallback_observability(base_state):
    """Test that when ML fails in RiskAgent, the fallback is explicitly observable."""
    agent = RiskAgent(use_ml=True)
    
    # Mock ml_service to fail
    if agent.ml_service:
        agent.ml_service.predict = lambda features: (_ for _ in ()).throw(ValueError("Simulated ML Failure"))
        
    state = agent.analyze(base_state)
    result = state.risk
    
    # Validation
    assert result.used_fallback is True
    assert result.degraded_mode is True
    assert "ML prediction failed" in result.fallback_reason
    
    # Ensure warnings captured this
    warnings = getattr(result, '_pipeline_warnings', [])
    assert any("ML prediction failed" in w.message for w in warnings)


def test_predictive_ml_fallback_observability(base_state):
    """Test that when Predictive ML fails, fallback is explicit."""
    # Need to simulate current_risk for PredictiveAgent
    from app.schemas.domain import RiskResult, Priority, RiskLevel
    base_state.risk = RiskResult(
        priority=Priority.P3_MEDIUM,
        risk_level=RiskLevel.MEDIUM,
        severity="MODERATE",
        score=50.0,
        reasons=[],
        confidence=1.0
    )
    
    from unittest.mock import patch
    agent = PredictiveAgent(use_ml=True)
    
    # Mock ml_service
    with patch("app.services.flood_prediction_service.FloodPredictionService") as MockService:
        instance = MockService.return_value
        instance.is_available.return_value = True
        instance.predict_flood_risk.side_effect = ValueError("Simulated Predictive Failure")
        
        state = agent.analyze(base_state)
        
    result = state.prediction
    
    assert result.used_fallback is True
    assert result.degraded_mode is True
    assert "Using baseline" in result.fallback_reason


def test_route_agent_fallback_observability():
    """Test that RouteAgent explicitly marks straight-line fallback."""
    agent = RouteAgent()
    
    # Mock routing service to fail
    agent.routing_service.get_route = lambda origin_lat, origin_lon, dest_lat, dest_lon: {
        "success": False,
        "distance_km": 10.0,
        "time_mins": 10.0,
        "waypoints": [],
        "explanation": "Failed route",
        "warnings": []
    }
    
    result = agent.analyze(
        resource_id="RES_1",
        destination_id="INC_1",
        origin_lat=10.0,
        origin_lon=20.0,
        dest_lat=11.0,
        dest_lon=21.0
    )
    
    assert result.used_fallback is True
    assert result.degraded_mode is True
    assert "straight-line" in result.fallback_reason.lower()


def test_data_quality_stale_fallback(base_state):
    """Test that DataQualityAgent marks cache use as a fallback when data is stale."""
    # Inject very old data
    old_time = datetime.utcnow() - timedelta(hours=5)
    
    base_state.request.incident.water_level = Observation(
        value=5.0,
        timestamp=old_time,
        source="SENSOR_A"
    )
    
    agent = DataQualityAgent()
    state = agent.analyze(base_state)
    
    result = state.data_quality
    assert result.used_fallback is True
    assert result.degraded_mode is True
    assert "stale" in result.fallback_reason.lower()
    assert "water_level" in result.stale_fields
