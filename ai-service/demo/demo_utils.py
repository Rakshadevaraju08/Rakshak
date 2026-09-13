from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.schemas.domain import (
    DisasterAnalysisRequest,
    Incident,
    Observation,
    IncidentType,
    RoadAccessStatus,
    SafetyStatus,
    AutonomyMode
)
from datetime import datetime, timedelta

class DemoScenario(BaseModel):
    id: int
    name: str
    description: str
    request: DisasterAnalysisRequest
    expected_safety: Optional[SafetyStatus] = None
    expected_autonomy: Optional[AutonomyMode] = None
    expected_blocked_resource: Optional[bool] = False
    expected_fallback_route: Optional[bool] = False
    expected_escalation: Optional[bool] = False
    safety_critical: bool = False
    data_source: str = "SYNTHETIC DEMO SIMULATION"
    is_hallucination_test: bool = False
    is_data_quality_test: bool = False

def create_base_incident(incident_id: str, type: IncidentType, victims: int = 0) -> Incident:
    return Incident(
        id=incident_id,
        type=type,
        timestamp=datetime.utcnow(),
        latitude=12.9716,
        longitude=77.5946,
        victim_count=victims,
        source="DEMO_SYSTEM"
    )

def print_section(title: str):
    print(f"\n{title}")
    print("-" * 60)

def print_case_header(case_num: int, title: str):
    print(f"\n{'=' * 60}")
    print(f"CASE {case_num:02d} — {title.upper()}")
    print(f"{'=' * 60}")
