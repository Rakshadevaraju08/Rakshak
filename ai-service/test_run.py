from app.schemas.domain import DisasterAnalysisRequest, Incident, IncidentType, Resource, ResourceType, ResourceStatus, Environment
from app.agents.master_coordinator import MasterCoordinator

# 1. Initialize the Coordinator
coordinator = MasterCoordinator()

# 2. Create some fake disaster data
request = DisasterAnalysisRequest(
    incident=Incident(
        id="TEST_001",
        type=IncidentType.FIRE,
        latitude=34.05,
        longitude=-118.24,
        victim_count=12,
        elderly_count=3
    ),
    resources=[
        Resource(id="FIRE_TRUCK_1", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.AVAILABLE, latitude=34.00, longitude=-118.20)
    ],
    environment=Environment(
        rainfall_trend_mm_per_hour=0.0,
        water_level_trend_m_per_hour=0.0
    )
)

# 3. Run the complete pipeline
plan = coordinator.analyze(request)

# 4. Print the final response plan
print("--- MASTER COORDINATOR FINAL PLAN ---")
print(plan.model_dump_json(indent=2))
