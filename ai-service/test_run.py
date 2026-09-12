from app.schemas.domain import DisasterAnalysisRequest, Incident, IncidentType
from app.agents.situation_agent import SituationAgent
from app.agents.risk_agent import RiskAgent

# 1. Initialize the Agents
situation_agent = SituationAgent()
risk_agent = RiskAgent(use_ml=True)

# 2. Create some fake disaster data
request = DisasterAnalysisRequest(
    incident=Incident(
        id="TEST_001",
        type=IncidentType.FIRE,
        latitude=34.05,
        longitude=-118.24,
        victim_count=12,
        elderly_count=3
    )
)

# 3. Run the agents
situation_result = situation_agent.analyze(request)
risk_result = risk_agent.analyze(request)

# 4. Print the results
print("--- SITUATION ---")
print(situation_result.model_dump_json(indent=2))
print("\n--- RISK ---")
print(risk_result.model_dump_json(indent=2))
