from datetime import datetime, timedelta
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    Observation,
    IncidentType,
    RoadAccessStatus,
    SafetyStatus,
    AutonomyMode,
    Resource,
    ResourceType,
    ResourceStatus,
    Hospital,
    Road,
    Environment,
    QualityStatus
)
from .demo_utils import DemoScenario, create_base_incident

def get_demo_scenarios():
    scenarios = []
    
    # Common assets
    ambulance_available = Resource(id="AMB_001", type=ResourceType.AMBULANCE, status=ResourceStatus.AVAILABLE, latitude=12.98, longitude=77.60)
    ambulance_busy = Resource(id="AMB_002", type=ResourceType.AMBULANCE, status=ResourceStatus.DISPATCHED, latitude=12.98, longitude=77.60)
    rescue_boat = Resource(id="BOAT_001", type=ResourceType.RESCUE_BOAT, status=ResourceStatus.AVAILABLE, latitude=12.98, longitude=77.60)
    fire_truck = Resource(id="FIRE_001", type=ResourceType.FIRE_TRUCK, status=ResourceStatus.AVAILABLE, latitude=12.98, longitude=77.60)
    hospital_available = Hospital(id="HOSP_001", name="City Hospital", latitude=12.99, longitude=77.59, total_beds=100, available_beds=10)
    hospital_full = Hospital(id="HOSP_002", name="Central Care", latitude=12.99, longitude=77.59, total_beds=50, available_beds=0)

    # 1. Single-person flood emergency
    inc1 = create_base_incident("INC_001", IncidentType.FLOOD, victims=1)
    inc1.elderly_count = 1
    inc1.water_level = Observation(value=2.5)
    inc1.rainfall = Observation(value=50.0)
    scenarios.append(DemoScenario(
        id=1, name="Single-person flood emergency",
        description="Elderly person trapped in rising flood water.",
        request=DisasterAnalysisRequest(
            incident=inc1,
            resources=[ambulance_available, rescue_boat],
            hospitals=[hospital_available]
        ),
        expected_autonomy=AutonomyMode.ASSISTED
    ))

    # 2. Multiple victims
    inc2 = create_base_incident("INC_002", IncidentType.FLOOD, victims=12)
    inc2.children_count = 4
    inc2.elderly_count = 3
    inc2.disabled_count = 1
    inc2.water_level = Observation(value=3.0)
    scenarios.append(DemoScenario(
        id=2, name="Multiple victims flood",
        description="Large group with vulnerable people in flood.",
        request=DisasterAnalysisRequest(
            incident=inc2,
            resources=[rescue_boat],
            hospitals=[hospital_available]
        ),
        expected_autonomy=AutonomyMode.HUMAN_REQUIRED,
        safety_critical=True
    ))

    # 3. Critical medical emergency
    inc3 = create_base_incident("INC_003", IncidentType.MEDICAL, victims=1)
    inc3.critical_victim_count = 1
    scenarios.append(DemoScenario(
        id=3, name="Critical medical emergency",
        description="Single victim with severe condition, needs immediate ambulance.",
        request=DisasterAnalysisRequest(
            incident=inc3,
            resources=[ambulance_available],
            hospitals=[hospital_available]
        ),
        expected_autonomy=AutonomyMode.HUMAN_REQUIRED
    ))

    # 4. Accident at a single location
    inc4 = create_base_incident("INC_004", IncidentType.LOCALIZED_ACCIDENT, victims=3)
    inc4.critical_victim_count = 1
    scenarios.append(DemoScenario(
        id=4, name="Accident at single location",
        description="Road accident with 3 victims, 1 critical.",
        request=DisasterAnalysisRequest(
            incident=inc4,
            resources=[ambulance_available],
            hospitals=[hospital_available]
        ),
        expected_autonomy=AutonomyMode.HUMAN_REQUIRED
    ))

    # 5. Fire emergency
    inc5 = create_base_incident("INC_005", IncidentType.FIRE, victims=6)
    inc5.children_count = 2
    scenarios.append(DemoScenario(
        id=5, name="Fire emergency",
        description="Residential building fire with trapped victims.",
        request=DisasterAnalysisRequest(
            incident=inc5,
            resources=[fire_truck, ambulance_available],
            hospitals=[hospital_available]
        ),
        expected_autonomy=AutonomyMode.HUMAN_REQUIRED
    ))

    # 6. Structural collapse
    inc6 = create_base_incident("INC_006", IncidentType.OTHER, victims=8) # Map collapse to OTHER
    scenarios.append(DemoScenario(
        id=6, name="Structural collapse",
        description="Building collapse, 8 victims trapped.",
        request=DisasterAnalysisRequest(
            incident=inc6,
            resources=[ambulance_available],
            hospitals=[hospital_available]
        ),
        expected_autonomy=AutonomyMode.HUMAN_REQUIRED
    ))

    # 7. Evacuation scenario
    inc7 = create_base_incident("INC_007", IncidentType.FLOOD, victims=50)
    inc7.water_level = Observation(value=4.5)
    env7 = Environment(water_level_trend_m_per_hour=1.2)
    scenarios.append(DemoScenario(
        id=7, name="Evacuation scenario",
        description="Large population exposed to rapidly rising flood risk.",
        request=DisasterAnalysisRequest(
            incident=inc7,
            resources=[rescue_boat],
            hospitals=[hospital_available],
            environment=env7
        ),
        expected_autonomy=AutonomyMode.HUMAN_REQUIRED
    ))

    # 8. High rainfall + rising water
    inc8 = create_base_incident("INC_008", IncidentType.FLOOD, victims=2)
    inc8.rainfall = Observation(value=150.0)
    env8 = Environment(rainfall_trend_mm_per_hour=25.0)
    scenarios.append(DemoScenario(
        id=8, name="High rainfall + rising water",
        description="Assam flood data simulation (synthetic trend).",
        request=DisasterAnalysisRequest(
            incident=inc8,
            resources=[rescue_boat],
            environment=env8
        )
    ))

    # 9. Future risk without current SOS
    inc9 = create_base_incident("INC_009", IncidentType.FLOOD, victims=0)
    inc9.water_level = Observation(value=2.0)
    env9 = Environment(rainfall_trend_mm_per_hour=50.0, water_level_trend_m_per_hour=0.5)
    scenarios.append(DemoScenario(
        id=9, name="Future risk without current SOS",
        description="Increasing environmental danger, no current victims. Predictive agent should flag.",
        request=DisasterAnalysisRequest(
            incident=inc9,
            resources=[],
            environment=env9
        )
    ))

    # 10. Road blocked after assignment
    inc10 = create_base_incident("INC_010", IncidentType.MEDICAL, victims=1)
    road_blocked = Road(id="R1", name="Main Street", status=RoadAccessStatus.BLOCKED)
    scenarios.append(DemoScenario(
        id=10, name="Road blocked",
        description="Test adaptive replanning when a road is marked blocked.",
        request=DisasterAnalysisRequest(
            incident=inc10,
            resources=[ambulance_available],
            hospitals=[hospital_available],
            roads=[road_blocked]
        ),
        expected_fallback_route=True
    ))

    # 11. Hospital full
    inc11 = create_base_incident("INC_011", IncidentType.MEDICAL, victims=1)
    scenarios.append(DemoScenario(
        id=11, name="Hospital full",
        description="Initial hospital selected is full. Should flag conflict or escalate.",
        request=DisasterAnalysisRequest(
            incident=inc11,
            resources=[ambulance_available],
            hospitals=[hospital_full] # Only full hospital available
        ),
        expected_escalation=True
    ))

    # 12. Ambulance unavailable
    inc12 = create_base_incident("INC_012", IncidentType.MEDICAL, victims=1)
    scenarios.append(DemoScenario(
        id=12, name="Ambulance unavailable",
        description="Only busy ambulances exist.",
        request=DisasterAnalysisRequest(
            incident=inc12,
            resources=[ambulance_busy],
            hospitals=[hospital_available]
        ),
        expected_blocked_resource=True
    ))

    # 13. No suitable resource
    inc13 = create_base_incident("INC_013", IncidentType.FIRE, victims=2)
    scenarios.append(DemoScenario(
        id=13, name="No suitable resource",
        description="Fire emergency but only ambulance available.",
        request=DisasterAnalysisRequest(
            incident=inc13,
            resources=[ambulance_available],
            hospitals=[hospital_available]
        ),
        expected_blocked_resource=True
    ))

    # 14. Conflicting reports
    inc14 = create_base_incident("INC_014", IncidentType.FLOOD, victims=5)
    inc14.confidence = 0.3 # Simulate conflicting report lowering confidence
    scenarios.append(DemoScenario(
        id=14, name="Conflicting reports",
        description="Multiple sources give conflicting victim counts. Confidence is low.",
        request=DisasterAnalysisRequest(
            incident=inc14,
            resources=[rescue_boat],
            hospitals=[]
        ),
        expected_escalation=True,
        is_data_quality_test=True
    ))

    # 15. Stale environmental data
    inc15 = create_base_incident("INC_015", IncidentType.FLOOD, victims=2)
    inc15.rainfall = Observation(value=50.0, timestamp=datetime.utcnow() - timedelta(hours=24))
    scenarios.append(DemoScenario(
        id=15, name="Stale environmental data",
        description="Rainfall data is extremely old.",
        request=DisasterAnalysisRequest(
            incident=inc15,
            resources=[rescue_boat]
        ),
        expected_escalation=True,
        is_data_quality_test=True
    ))

    # 16. Fake ambulance
    inc16 = create_base_incident("INC_016", IncidentType.MEDICAL, victims=1)
    fake_amb = Resource(id="AMB_999", type=ResourceType.AMBULANCE, status=ResourceStatus.AVAILABLE)
    fake_amb.confidence = 0.0 # Force hallucination rejection
    scenarios.append(DemoScenario(
        id=16, name="Fake ambulance",
        description="AI suggests AMB-999 which does not exist in trusted DB.",
        request=DisasterAnalysisRequest(
            incident=inc16,
            resources=[fake_amb] # Passing it in but marking it invalid internally if possible, or we let safety checker catch bad IDs
        ),
        is_hallucination_test=True
    ))

    # 17. Fake hospital
    inc17 = create_base_incident("INC_017", IncidentType.MEDICAL, victims=1)
    fake_hosp = Hospital(id="HOSP_999", name="Fake Hosp", latitude=12.9, longitude=77.5, total_beds=10, available_beds=10)
    scenarios.append(DemoScenario(
        id=17, name="Fake hospital",
        description="AI refers to HOSPITAL-999.",
        request=DisasterAnalysisRequest(
            incident=inc17,
            resources=[ambulance_available],
            hospitals=[fake_hosp]
        ),
        is_hallucination_test=True
    ))

    # 18. Fake route / impossible route
    inc18 = create_base_incident("INC_018", IncidentType.MEDICAL, victims=1)
    inc18.latitude = 90.0 # Impossible routing coordinates
    scenarios.append(DemoScenario(
        id=18, name="Impossible route",
        description="Coordinates make routing impossible.",
        request=DisasterAnalysisRequest(
            incident=inc18,
            resources=[ambulance_available]
        ),
        expected_safety=SafetyStatus.REVIEW_REQUIRED,
        is_hallucination_test=True
    ))

    # 19. Fake ETA
    inc19 = create_base_incident("INC_019", IncidentType.MEDICAL, victims=1)
    # We will manually inject a fake ETA validation failure if the safety checker supports it.
    scenarios.append(DemoScenario(
        id=19, name="Fake ETA",
        description="Invalid route result with impossible ETA vs Distance.",
        request=DisasterAnalysisRequest(
            incident=inc19,
            resources=[ambulance_available]
        ),
        is_hallucination_test=True
    ))

    # 20. Fake rainfall
    inc20 = create_base_incident("INC_020", IncidentType.FLOOD, victims=1)
    inc20.rainfall = Observation(value=9000.0, quality=QualityStatus.INVALID)
    scenarios.append(DemoScenario(
        id=20, name="Fake rainfall",
        description="AI claims 9000mm rainfall. Grounding check should reject.",
        request=DisasterAnalysisRequest(
            incident=inc20,
            resources=[rescue_boat]
        ),
        expected_safety=SafetyStatus.REVIEW_REQUIRED,
        is_hallucination_test=True
    ))

    # 21. No internet / offline SOS
    inc21 = create_base_incident("INC_021", IncidentType.MEDICAL, victims=1)
    inc21.source = "OFFLINE_MESH"
    scenarios.append(DemoScenario(
        id=21, name="Offline mesh SOS",
        description="Incident received via offline mesh network.",
        request=DisasterAnalysisRequest(
            incident=inc21,
            resources=[ambulance_available]
        )
    ))

    # 22. Duplicate SOS
    inc22 = create_base_incident("INC_022", IncidentType.FLOOD, victims=1)
    # This is tested in pipeline by handling consecutive same IDs usually, but for demo we just show it processes correctly.
    scenarios.append(DemoScenario(
        id=22, name="Duplicate SOS",
        description="Simulate duplicate SOS handling.",
        request=DisasterAnalysisRequest(
            incident=inc22,
            resources=[rescue_boat]
        )
    ))

    # 23. Low-risk incident
    inc23 = create_base_incident("INC_023", IncidentType.FLOOD, victims=1)
    inc23.water_level = Observation(value=0.5)
    scenarios.append(DemoScenario(
        id=23, name="Low-risk incident",
        description="Safe situation, should get AUTO autonomy.",
        request=DisasterAnalysisRequest(
            incident=inc23,
            resources=[rescue_boat]
        ),
        expected_autonomy=AutonomyMode.AUTO
    ))

    # 24. Multiple simultaneous incidents
    inc24 = create_base_incident("INC_024", IncidentType.MEDICAL, victims=2)
    scenarios.append(DemoScenario(
        id=24, name="Multiple simultaneous incidents",
        description="Testing resource competition logic (simulated by passing limited resources).",
        request=DisasterAnalysisRequest(
            incident=inc24,
            resources=[ambulance_busy]
        ),
        expected_blocked_resource=True
    ))

    # 25. Critical incident + conflicting data
    inc25 = create_base_incident("INC_025", IncidentType.FLOOD, victims=20)
    inc25.children_count = 8
    inc25.confidence = 0.4
    scenarios.append(DemoScenario(
        id=25, name="Critical incident + conflicting data",
        description="High risk + low data confidence = HUMAN_REQUIRED.",
        request=DisasterAnalysisRequest(
            incident=inc25,
            resources=[rescue_boat]
        ),
        expected_autonomy=AutonomyMode.HUMAN_REQUIRED
    ))


    # 26. Existing incident update (Continuity)
    inc26_initial = create_base_incident("INC-ASSAM-001", IncidentType.FLOOD, victims=5)
    inc26_initial.children_count = 2
    inc26_initial.elderly_count = 1
    inc26_initial.water_level = Observation(value=2.1)
    inc26_initial.rainfall = Observation(value=85.0)
    scenarios.append(DemoScenario(
        id=260, name="Original Incident",
        description="STAGE 1: Original Flood Incident",
        request=DisasterAnalysisRequest(
            incident=inc26_initial,
            resources=[ambulance_available]
        )
    ))
    
    inc26_update = create_base_incident("INC-ASSAM-001", IncidentType.FLOOD, victims=6)
    inc26_update.children_count = 2
    inc26_update.elderly_count = 1
    inc26_update.water_level = Observation(value=2.5)
    inc26_update.rainfall = Observation(value=105.0)
    scenarios.append(DemoScenario(
        id=26, name="Incident Continuity",
        description="STAGE 2: Existing incident worsened. Reuses unchanged component states.",
        request=DisasterAnalysisRequest(
            incident=inc26_update,
            resources=[ambulance_available]
        )
    ))

    # 27. Stale previous decision
    inc27_update = create_base_incident("INC-ASSAM-001", IncidentType.FLOOD, victims=6)
    inc27_update.children_count = 2
    inc27_update.elderly_count = 1
    inc27_update.water_level = Observation(value=3.1)
    inc27_update.rainfall = Observation(value=105.0)
    
    blocked_road = Road(
        id="RD-01",
        name="Main Access Road",
        status=RoadAccessStatus.BLOCKED
    )
    
    scenarios.append(DemoScenario(
        id=27, name="Stale Decision / Invalidation",
        description="STAGE 3: Incident worsened AND road blocked. Forces route and resource re-evaluation.",
        request=DisasterAnalysisRequest(
            incident=inc27_update,
            resources=[ambulance_busy],  # Make ambulance busy as well to force resource change
            roads=[blocked_road]
        )
    ))

    return scenarios
