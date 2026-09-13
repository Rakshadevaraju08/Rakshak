import pytest
from app.agents.master_coordinator import MasterCoordinator
from demo.test_cases import get_demo_scenarios
from app.schemas.domain import FullResponsePlan

def test_demo_runner_all_cases():
    """Ensure all demo scenarios can execute without raising unhandled exceptions in the coordinator."""
    scenarios = get_demo_scenarios()
    assert len(scenarios) == 25, "There should be exactly 25 demo scenarios"
    
    coordinator = MasterCoordinator(use_ml_risk=False)
    
    for scenario in scenarios:
        try:
            plan = coordinator.analyze(scenario.request)
            assert isinstance(plan, FullResponsePlan)
        except Exception as e:
            pytest.fail(f"Demo scenario {scenario.id} ({scenario.name}) failed with exception: {str(e)}")
