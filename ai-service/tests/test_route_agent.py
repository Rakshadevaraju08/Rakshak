import pytest
from unittest.mock import patch, Mock
import requests
from app.agents.route_agent import RouteAgent
from app.schemas.domain import RoadAccessStatus, Road, RoadAccessStatus
from app.errors import WarningCode

@pytest.fixture
def agent():
    return RouteAgent()

@patch('app.services.routing_service.requests.get')
def test_successful_osrm_route_with_steps(mock_get, agent):
    """Test successful retrieval of OSRM route with steps parsed."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 15000.0, # 15 km
                "duration": 1200.0,  # 20 mins
                "legs": [
                    {
                        "steps": [
                            {"name": "Main Street", "maneuver": {"location": [20.0, 10.0]}},
                            {"name": "Hospital Road", "maneuver": {"location": [20.1, 10.1]}}
                        ]
                    }
                ]
            }
        ]
    }
    mock_response.raise_for_status = Mock()
    mock_get.return_value = mock_response

    result = agent.analyze(
        resource_id="AMB_1",
        destination_id="INC_1",
        origin_lat=10.0,
        origin_lon=20.0,
        dest_lat=10.1,
        dest_lon=20.1
    )

    assert result.route_status == RoadAccessStatus.OPEN
    assert result.distance_km == 15.0
    assert result.estimated_time_mins == 20.0
    assert "Recommended Route: AMB_1 \u2192 Main Street \u2192 Hospital Road \u2192 Incident Zone" in result.explanation
    assert "Route Source: OSRM" in result.explanation

@patch('app.services.routing_service.requests.get')
def test_osrm_fallback(mock_get, agent):
    """Test fallback to straight-line distance when OSRM fails."""
    mock_get.side_effect = requests.exceptions.ConnectionError("Connection Refused")

    result = agent.analyze(
        resource_id="AMB_1",
        destination_id="INC_1",
        origin_lat=10.0,
        origin_lon=20.0,
        dest_lat=10.1,
        dest_lon=20.0 
    )

    assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
    assert result.distance_km == 11.1
    assert result.estimated_time_mins == 11.1
    assert "Route Source: FALLBACK" in result.explanation
    assert "Road-network route unavailable; ETA is approximate." in result.explanation
    assert "FALLBACK (straight-line distance)" in result.explanation

    route_warnings = getattr(result, '_pipeline_warnings', [])
    assert any(w.code == WarningCode.OSRM_UNAVAILABLE for w in route_warnings)

@patch('app.services.routing_service.requests.get')
def test_route_blocked_by_road(mock_get, agent):
    """Test route is invalidated when it intersects a blocked road."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 15000.0, 
                "duration": 1200.0,
                "legs": [
                    {
                        "steps": [
                            {"name": "Blocked Avenue", "maneuver": {"location": [20.05, 10.05]}}
                        ]
                    }
                ]
            }
        ]
    }
    mock_response.raise_for_status = Mock()
    mock_get.return_value = mock_response

    blocked_road = Road(
        id="R1", 
        name="Blocked Avenue", 
        latitude=10.05, 
        longitude=20.05, 
        status=RoadAccessStatus.BLOCKED
    )

    result = agent.analyze(
        resource_id="AMB_1",
        destination_id="INC_1",
        origin_lat=10.0,
        origin_lon=20.0,
        dest_lat=10.1,
        dest_lon=20.1,
        blocked_roads=[blocked_road]
    )

    assert result.route_status == RoadAccessStatus.BLOCKED
    assert "Route intersects known blocked road: Blocked Avenue" in result.explanation
    assert result.decision_provenance.confidence == 0.5

def test_missing_coordinates(agent):
    result = agent.analyze(
        resource_id="AMB_1",
        destination_id="INC_1",
        origin_lat=None,
        origin_lon=None,
        dest_lat=10.1,
        dest_lon=20.1
    )
    assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
    assert "missing" in result.explanation.lower()
