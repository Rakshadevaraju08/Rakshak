import uuid
from enum import Enum
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
from app.errors import WarningCode

# -----------------------------------------
# ENUMS
# -----------------------------------------

class IncidentType(str, Enum):
    FLOOD = "FLOOD"
    EARTHQUAKE = "EARTHQUAKE"
    FIRE = "FIRE"
    MEDICAL = "MEDICAL"
    LOCALIZED_ACCIDENT = "LOCALIZED_ACCIDENT"
    OTHER = "OTHER"

class RoadAccessStatus(str, Enum):
    OPEN = "OPEN"
    PARTIAL = "PARTIAL"
    BLOCKED = "BLOCKED"
    ROUTE_UNAVAILABLE = "ROUTE_UNAVAILABLE"

class ResourceType(str, Enum):
    AMBULANCE = "AMBULANCE"
    RESCUE_TEAM = "RESCUE_TEAM"
    FIRE_TRUCK = "FIRE_TRUCK"
    RESCUE_BOAT = "RESCUE_BOAT"
    MEDICAL_TEAM = "MEDICAL_TEAM"

class ResourceStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    DISPATCHED = "DISPATCHED"
    MAINTENANCE = "MAINTENANCE"

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class Priority(int, Enum):
    P1_CRITICAL = 1
    P2_HIGH = 2
    P3_MEDIUM = 3
    P4_LOW = 4
    P5_MONITOR = 5

class QualityStatus(str, Enum):
    VALID = "VALID"
    SUSPECT = "SUSPECT"
    INVALID = "INVALID"

class SafetyStatus(str, Enum):
    SAFE = "SAFE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    BLOCKED = "BLOCKED"

class AutonomyMode(str, Enum):
    AUTO = "AUTO"
    ASSISTED = "ASSISTED"
    HUMAN_REQUIRED = "HUMAN_REQUIRED"

# -----------------------------------------
# INPUT SCHEMAS
# -----------------------------------------

class Observation(BaseModel):
    value: float
    source: str = Field(default="SYSTEM")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    quality: QualityStatus = Field(default=QualityStatus.VALID)
    sensor_id: Optional[str] = None

class Incident(BaseModel):
    id: str = Field(..., description="Unique identifier for the incident")
    type: IncidentType
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When the data was reported")
    source: str = Field(default="SYSTEM", description="Source of the data (e.g. CITIZEN_APP, IOT, DISPATCHER)")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Raw input confidence")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    victim_count: int = Field(default=0, ge=0, description="Total number of victims")
    critical_victim_count: int = Field(default=0, ge=0, description="Number of critically injured victims")
    elderly_count: int = Field(default=0, ge=0, description="Number of elderly victims")
    children_count: int = Field(default=0, ge=0, description="Number of child victims")
    disabled_count: int = Field(default=0, ge=0, description="Number of disabled victims")
    water_level: Optional[Observation] = Field(default=None, description="Water level observation")
    rainfall: Optional[Observation] = Field(default=None, description="Rainfall observation")
    road_access: Optional[RoadAccessStatus] = None

class Resource(BaseModel):
    id: str
    type: ResourceType
    status: ResourceStatus
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="SYSTEM")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    capacity: Optional[int] = Field(None, ge=0, description="E.g., number of seats or payload capacity")

class Hospital(BaseModel):
    id: str
    name: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    total_beds: int = Field(..., ge=0)
    available_beds: int = Field(..., ge=0)

class Road(BaseModel):
    id: str
    name: str
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    status: RoadAccessStatus

class Environment(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="SYSTEM")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    general_weather: Optional[str] = None
    temperature_celsius: Optional[float] = None
    forecast_summary: Optional[str] = None
    rainfall_trend_mm_per_hour: Optional[float] = None
    water_level_trend_m_per_hour: Optional[float] = None

class DisasterAnalysisRequest(BaseModel):
    """The master input payload expected from the Node.js backend."""
    incident: Incident
    resources: List[Resource] = Field(default_factory=list)
    hospitals: List[Hospital] = Field(default_factory=list)
    roads: List[Road] = Field(default_factory=list)
    environment: Optional[Environment] = None

class DisasterAnalysisState(BaseModel):
    """Explicit shared pipeline state passed through and enriched by all agents."""
    request: DisasterAnalysisRequest
    data_quality: Optional['DataQualityResult'] = None
    situation: Optional['SituationResult'] = None
    risk: Optional['RiskResult'] = None
    prediction: Optional['PredictiveAgentResult'] = None
    resource_assignments: Optional['ResourceAgentResult'] = None
    degraded: bool = False
    warnings: List['PipelineWarningResponse'] = Field(default_factory=list)

# -----------------------------------------
# OUTPUT SCHEMAS
# -----------------------------------------

class DecisionProvenance(BaseModel):
    agent: str
    method: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    inputs: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    fallback_used: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data_quality_checks: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

class AgentResultBase(BaseModel):
    used_fallback: bool = Field(default=False)
    fallback_reason: Optional[str] = Field(default=None)
    degraded_mode: bool = Field(default=False)
    decision_provenance: Optional[DecisionProvenance] = None

class DataQualityResult(AgentResultBase):
    overall_quality: QualityStatus
    confidence: float = Field(..., ge=0.0, le=1.0)
    stale_fields: List[str] = Field(default_factory=list)
    invalid_fields: List[str] = Field(default_factory=list)
    missing_fields: List[str] = Field(default_factory=list)
    conflicting_fields: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    provenance: List[str] = Field(default_factory=list)

class SituationResult(AgentResultBase):
    is_valid: bool = Field(..., description="Whether the incident data is valid and coherent")
    summary: str
    severity_assessment: str
    vulnerable_population_impact: str
    missing_information: List[str] = Field(default_factory=list)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanations: List[str] = Field(default_factory=list)
    normalized_incident_type: str

class RiskResult(AgentResultBase):
    priority: Priority
    risk_level: RiskLevel
    severity: str
    score: float = Field(..., ge=0.0, le=100.0, description="Calculated risk score out of 100")
    reasons: List[str] = Field(..., description="Explainability factors for why this risk was assigned")
    confidence: float = Field(..., ge=0.0, le=1.0)

class PredictionResult(AgentResultBase):
    horizon_hours: int = Field(..., ge=1, description="How far into the future this prediction looks")
    predicted_risk_trend: str = Field(..., description="E.g., STABLE, WORSENING, IMPROVING")
    worsening_probability: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score of the AI prediction")

class ForecastItem(BaseModel):
    horizon_minutes: int
    risk_level: RiskLevel

class PredictiveAgentResult(AgentResultBase):
    current_risk: RiskLevel
    forecast: List[ForecastItem]
    escalation_detected: bool
    explanation: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)

class RouteResult(AgentResultBase):
    resource_id: str
    destination_id: str
    estimated_time_mins: float = Field(..., ge=0.0)
    distance_km: float = Field(..., ge=0.0)
    waypoints: List[Tuple[float, float]] = Field(default_factory=list, description="List of (lat, lon) waypoints")
    route_status: RoadAccessStatus
    explanation: str = ""

class ResourceAssignment(BaseModel):
    resource_id: str
    action: str = Field(..., description="E.g., DISPATCH_TO_INCIDENT, STANDBY")
    route: RouteResult
    estimated_arrival_time_mins: float = Field(..., ge=0.0)

class ResponseRecommendation(BaseModel):
    primary_action: str
    required_resources: List[ResourceAssignment]
    target_hospital_id: Optional[str] = None
    autonomy_decision: Optional['AutonomyDecision'] = None

class RecommendedAction(str, Enum):
    MONITOR = "MONITOR"
    PREPARE = "PREPARE"
    PRE_POSITION = "PRE_POSITION"
    DISPATCH = "DISPATCH"
    IMMEDIATE_DISPATCH = "IMMEDIATE_DISPATCH"

class ResourceAgentResult(AgentResultBase):
    assignments: List[ResourceAssignment]
    unfulfilled_requirements: List[str]
    reasons: List[str]

class PipelineWarningResponse(BaseModel):
    """Structured, machine-readable warning returned to API clients."""
    code: WarningCode = Field(..., description="Machine-readable warning code")
    source: str = Field(..., description="Agent or service that produced the warning")
    message: str = Field(..., description="Human-readable summary")

class SafetyCheckResult(BaseModel):
    status: SafetyStatus
    risk_level: RiskLevel
    confidence: float
    blocking_issues: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    checks_performed: int
    recommended_action: RecommendedAction
    is_safe_for_autonomous_execution: bool

class AutonomyDecision(BaseModel):
    mode: AutonomyMode
    reason: str
    confidence: float
    blocking_factors: List[str] = Field(default_factory=list)
    human_review_required: bool

class TraceStepStatus(str, Enum):
    STARTED = "STARTED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TraceStep(BaseModel):
    trace_id: str
    step_name: str
    agent_name: str
    status: TraceStepStatus
    execution_time_ms: Optional[float] = None
    fallback_used: bool = False
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class PipelineTrace(BaseModel):
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    total_execution_time_ms: Optional[float] = None
    steps: List[TraceStep] = Field(default_factory=list)

class FullResponsePlan(BaseModel):
    """The master output payload returned to the Node.js backend."""

    # ── Core identification ────────────────────────────────────────────────
    incident_id: str = Field(..., description="Incident identifier from the original request")

    # ── Agent results (may be None when an agent is skipped/degraded) ──────
    data_quality: Optional[DataQualityResult] = Field(default=None, description="Input data-quality assessment")
    situation: Optional[SituationResult] = Field(default=None, description="Situation agent output")
    risk: Optional[RiskResult] = Field(default=None, description="Risk assessment")
    prediction: Optional[PredictiveAgentResult] = Field(default=None, description="Predictive agent forecast")
    resource_agent_result: Optional[ResourceAgentResult] = Field(default=None, description="Resource assignment agent output")
    assignments: List[ResourceAssignment] = Field(default_factory=list, description="Dispatched resource assignments with routes")

    # ── Recommendation ────────────────────────────────────────────────────
    recommended_action: RecommendedAction = Field(..., description="Top-level recommended action")
    explanation: List[str] = Field(default_factory=list, description="Human-readable explanation of how the decision was reached")

    # ── Warnings & degraded state ─────────────────────────────────────────
    warnings: List[PipelineWarningResponse] = Field(default_factory=list, description="Machine-readable pipeline warnings")
    degraded: bool = Field(default=False, description="True when any agent was skipped or failed")

    # ── Safety & autonomy ─────────────────────────────────────────────────
    safety_check: Optional[SafetyCheckResult] = Field(default=None, description="Response safety checker result")
    autonomy_decision: Optional[AutonomyDecision] = Field(default=None, description="Risk-based autonomy decision")

    # ── Top-level convenience fields for frontend display ─────────────────
    overall_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Minimum confidence across all non-None agents; indicates weakest link in the pipeline"
    )
    trace_id: Optional[str] = Field(
        default=None,
        description="Pipeline trace ID for log correlation and observability"
    )
    human_review_required: bool = Field(
        default=False,
        description="True when the autonomy decision requires human approval before execution"
    )
    fallback_used: bool = Field(
        default=False,
        description="True when any agent fell back to a degraded/rule-based method"
    )
    provenance: List[DecisionProvenance] = Field(
        default_factory=list,
        description="Collected decision provenance from all agents (for audit trail)"
    )

    # ── Observability trace ───────────────────────────────────────────────
    trace: Optional[PipelineTrace] = Field(default=None, description="Full pipeline execution trace")

# -----------------------------------------
# RE-PLANNING SCHEMAS
# -----------------------------------------

class ChangeCategory(str, Enum):
    PRIORITY_CHANGE = "PRIORITY_CHANGE"
    RISK_LEVEL_CHANGE = "RISK_LEVEL_CHANGE"
    ACTION_CHANGE = "ACTION_CHANGE"
    RESOURCE_REASSIGNED = "RESOURCE_REASSIGNED"
    RESOURCE_ADDED = "RESOURCE_ADDED"
    RESOURCE_REMOVED = "RESOURCE_REMOVED"
    ROUTE_CHANGED = "ROUTE_CHANGED"
    ESCALATION_CHANGE = "ESCALATION_CHANGE"
    SEVERITY_CHANGE = "SEVERITY_CHANGE"

class PlanChange(BaseModel):
    category: ChangeCategory
    field: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    description: str

class ReplanRequest(BaseModel):
    previous_plan: FullResponsePlan
    updated_state: DisasterAnalysisRequest

class ResponsePlanRevision(BaseModel):
    revision_number: int = Field(default=1, description="Sequential revision number")
    incident_id: str
    previous_action: RecommendedAction
    new_action: RecommendedAction
    changes: List[PlanChange] = Field(default_factory=list)
    new_plan: FullResponsePlan
    is_significant_change: bool = False

# -----------------------------------------
# STANDALONE ML PREDICTION SCHEMAS
# -----------------------------------------

class FloodPredictionRequest(BaseModel):
    latitude: float
    longitude: float
    rainfallCurrent: float
    rainfall1h: float
    rainfall3h: float
    rainfall6h: float
    waterLevel: Optional[float] = None
    waterLevelChange: Optional[float] = None
    aboveDangerLevel: Optional[bool] = None
    elevation: float
    historicalFlood: Optional[bool] = None

class FloodPredictionResponse(BaseModel):
    riskLevel: str
    probability: float
    predictionHorizonMinutes: int
    factors: List[str]
