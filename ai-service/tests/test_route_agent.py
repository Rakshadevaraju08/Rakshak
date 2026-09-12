import pytest
from unittest.mock import patch, Mock
import requests
from app.agents.route_agent import RouteAgent
from app.schemas.domain import RoadAccessStatus

@pytest.fixture
def agent():
    return RouteAgent()

@patch('app.services.routing_service.requests.get')
def test_successful_osrm_route(mock_get, agent):
    """Test successful retrieval of OSRM route."""
    # Mock successful JSON response from OSRM
    mock_response = Mock()
    mock_response.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 15000.0, # 15 km
                "duration": 1200.0   # 20 mins
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
    assert "Successfully retrieved driving route" in result.explanation

@patch('app.services.routing_service.requests.get')
def test_osrm_fallback(mock_get, agent):
    """Test fallback to straight-line distance when OSRM fails."""
    # Mock a timeout or connection error
    mock_get.side_effect = requests.exceptions.ConnectionError("Connection Refused")

    result = agent.analyze(
        resource_id="AMB_1",
        destination_id="INC_1",
        origin_lat=10.0,
        origin_lon=20.0,
        dest_lat=10.1,
        dest_lon=20.0 # Straight line distance calculation: 0.1 deg lat = ~11.1km
    )

    assert result.route_status == RoadAccessStatus.ROUTE_UNAVAILABLE
    # math.sqrt((10.0 - 10.1)**2 + (20.0 - 20.0)**2) * 111.0 = 11.1
    assert result.distance_km == 11.1
    assert result.estimated_time_mins == 11.1 # 11.1km at 60km/h = 11.1 mins
    assert "WARNING: Route unavailable" in result.explanation
    assert "demo purposes" in result.explanation
