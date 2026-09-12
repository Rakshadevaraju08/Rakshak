import pytest
from datetime import datetime, timedelta
from app.agents.data_quality_agent import DataQualityAgent
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    IncidentType,
    Observation,
    QualityStatus,
    Environment,
    DisasterAnalysisState
)

@pytest.fixture
def agent():
    return DataQualityAgent()

def _make_state(water_level_val=1.0, rainfall_val=10.0, env_trend=None, obs_time_offset=0):
    now = datetime.utcnow()
    obs_time = now - timedelta(minutes=obs_time_offset)
    
    incident = Incident(
        id="TEST_INC",
        type=IncidentType.FLOOD,
        latitude=10.0,
        longitude=10.0,
        water_level=Observation(value=water_level_val, timestamp=obs_time) if water_level_val is not None else None,
        rainfall=Observation(value=rainfall_val, timestamp=obs_time) if rainfall_val is not None else None,
    )
    
    env = None
    if env_trend is not None:
        env = Environment(water_level_trend_m_per_hour=env_trend)
        
    req = DisasterAnalysisRequest(incident=incident, environment=env)
    return DisasterAnalysisState(request=req)

def test_valid_data(agent):
    state = _make_state(water_level_val=1.0, rainfall_val=10.0)
    result = agent.analyze(state).data_quality
    
    assert result.overall_quality == QualityStatus.VALID
    assert result.confidence == 1.0
    assert not result.stale_fields
    assert not result.invalid_fields
    assert not result.missing_fields
    assert not result.conflicting_fields

def test_stale_data(agent):
    # offset by 150 mins (> STALE_MINUTES)
    state = _make_state(water_level_val=1.0, rainfall_val=10.0, obs_time_offset=150)
    result = agent.analyze(state).data_quality
    
    assert result.overall_quality == QualityStatus.SUSPECT
    assert "water_level" in result.stale_fields
    assert "rainfall" in result.stale_fields
    assert result.confidence < 1.0

def test_impossible_values(agent):
    # water level 20.0 is > max (15.0)
    state = _make_state(water_level_val=20.0, rainfall_val=10.0)
    result = agent.analyze(state).data_quality
    
    assert result.overall_quality == QualityStatus.INVALID
    assert "water_level" in result.invalid_fields
    assert result.confidence < 1.0

def test_missing_flood_data(agent):
    state = _make_state(water_level_val=None, rainfall_val=None)
    result = agent.analyze(state).data_quality
    
    assert result.overall_quality == QualityStatus.SUSPECT
    assert "water_level" in result.missing_fields
    assert "rainfall" in result.missing_fields
    assert result.confidence < 1.0

def test_conflicting_observations(agent):
    # high water level (2.0) but environment receding rapidly (-1.0)
    state = _make_state(water_level_val=2.0, rainfall_val=10.0, env_trend=-1.0)
    result = agent.analyze(state).data_quality
    
    assert result.overall_quality == QualityStatus.SUSPECT
    assert "water_level" in result.conflicting_fields
    assert "environment.water_level_trend" in result.conflicting_fields
    assert result.confidence < 1.0
