from app.agents.data_quality_agent import DataQualityAgent
from app.agents.risk_agent import RiskAgent
from app.agents.situation_agent import SituationAgent
from app.schemas.domain import (
    DisasterAnalysisRequest,
    DisasterAnalysisState,
    Incident,
    IncidentType,
    Observation,
    RoadAccessStatus,
)


def make_request(incident_type, victim_count, complete=False):
    complete_fields = {}
    if complete:
        complete_fields = {
            "critical_victim_count": 0,
            "elderly_count": 0,
            "children_count": 0,
            "disabled_count": 0,
            "water_level": Observation(value=0.0),
            "rainfall": Observation(value=0.0),
            "road_access": RoadAccessStatus.OPEN,
        }
    return DisasterAnalysisRequest(
        incident=Incident(
            id="mobile-sos-test",
            type=incident_type,
            latitude=12.97,
            longitude=77.59,
            victim_count=victim_count,
            source="RAKSHAK_BACKEND",
            **complete_fields,
        )
    )


def test_flood_and_fire_risk_scoring_uses_reported_victim_counts():
    flood_request = make_request(IncidentType.FLOOD, 7)
    flood_state = RiskAgent(use_ml=False).analyze(
        DisasterAnalysisState(request=flood_request)
    )
    assert flood_state.risk.score == 35.0
    assert "people reported needing help: 7" in flood_state.risk.reasons[0]

    fire_request = make_request(IncidentType.FIRE, 4)
    fire_state = RiskAgent(use_ml=False).analyze(
        DisasterAnalysisState(request=fire_request)
    )
    assert fire_state.risk.score == 40.0
    assert "people reported needing help: 4" in fire_state.risk.reasons[0]


def test_ml_risk_path_receives_reported_counts_and_skips_missing_counts():
    class CapturingML:
        is_available = True

        def __init__(self):
            self.features = None

        def predict(self, features):
            self.features = features
            return 3

    for incident_type, victim_count in ((IncidentType.FLOOD, 7), (IncidentType.FIRE, 4)):
        model = CapturingML()
        agent = RiskAgent(use_ml=False)
        agent.use_ml = True
        agent.ml_service = model
        agent.analyze(DisasterAnalysisState(
            request=make_request(incident_type, victim_count, complete=True)
        ))
        assert model.features[0] == float(victim_count)

    model = CapturingML()
    agent = RiskAgent(use_ml=False)
    agent.use_ml = True
    agent.ml_service = model
    state = agent.analyze(DisasterAnalysisState(
        request=make_request(IncidentType.OTHER, None)
    ))
    assert model.features is None
    assert state.risk.used_fallback is True
    assert "required inputs are missing" in state.risk.fallback_reason.lower()


def test_missing_victim_count_remains_unknown_through_quality_situation_and_risk():
    request = make_request(IncidentType.OTHER, None)
    assert request.incident.victim_count is None

    state = DisasterAnalysisState(request=request)
    state = DataQualityAgent().analyze(state)
    assert "victim_count" in state.data_quality.missing_fields
    assert any("no value was inferred" in warning for warning in state.data_quality.warnings)

    state = SituationAgent().analyze(state)
    assert "victim_count" in state.situation.missing_information
    assert "unreported victim count" in state.situation.summary

    state = RiskAgent(use_ml=False).analyze(state)
    assert "victim count is unreported and was not inferred" in state.risk.reasons[0]
    assert state.risk.confidence < 1.0
    assert state.risk.risk_level.value == "UNDETERMINED"


def test_landslide_is_a_valid_incident_type():
    request = make_request(IncidentType.LANDSLIDE, 2)
    assert request.incident.type == IncidentType.LANDSLIDE
