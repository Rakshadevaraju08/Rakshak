from enum import Enum
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field
from app.errors import WarningCode

# -----------------------------------------
# ENUMS
# -----------------------------------------

class IncidentType(str, Enum):
    FLOOD = "FLOOD"
    EARTHQUAKE = "EARTHQUAKE"
    FIRE = "FIRE"
    MEDICAL = "MEDICAL"
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

# -----------------------------------------
# INPUT SCHEMAS
# -----------------------------------------

class Incident(BaseModel):
    id: str = Field(..., description="Unique identifier for the incident")
    type: IncidentType
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    victim_count: int = Field(default=0, ge=0, description="Total number of victims")
    elderly_count: int = Field(default=0, ge=0, description="Number of elderly victims")
    children_count: int = Field(default=0, ge=0, description="Number of child victims")
    disabled_count: int = Field(default=0, ge=0, description="Number of disabled victims")
    water_level: Optional[float] = Field(default=None, ge=0.0, description="Water level in meters")
    rainfall: Optional[float] = Field(default=None, ge=0.0, description="Rainfall in mm")
    road_access: Optional[RoadAccessStatus] = None

class Resource(BaseModel):
    id: str
    type: ResourceType
    status: ResourceStatus
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

# -----------------------------------------
# OUTPUT SCHEMAS
# -----------------------------------------

class SituationResult(BaseModel):
    is_valid: bool = Field(..., description="Whether the incident data is valid and coherent")
    summary: str
    severity_assessment: str
    vulnerable_population_impact: str
    missing_information: List[str] = Field(default_factory=list)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanations: List[str] = Field(default_factory=list)
    normalized_incident_type: str

class RiskResult(BaseModel):
    priority: Priority
    risk_level: RiskLevel
    severity: str
    score: float = Field(..., ge=0.0, le=100.0, description="Calculated risk score out of 100")
    reasons: List[str] = Field(..., description="Explainability factors for why this risk was assigned")
    confidence: float = Field(..., ge=0.0, le=1.0)

class PredictionResult(BaseModel):
    horizon_hours: int = Field(..., ge=1, description="How far into the future this prediction looks")
    predicted_risk_trend: str = Field(..., description="E.g., STABLE, WORSENING, IMPROVING")
    worsening_probability: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score of the AI prediction")

class ForecastItem(BaseModel):
    horizon_minutes: int
    risk_level: RiskLevel

class PredictiveAgentResult(BaseModel):
    current_risk: RiskLevel
    forecast: List[ForecastItem]
    escalation_detected: bool
    explanation: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)

class RouteResult(BaseModel):
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
    human_approval_required: bool = True

class RecommendedAction(str, Enum):
    MONITOR = "MONITOR"
    PREPARE = "PREPARE"
    PRE_POSITION = "PRE_POSITION"
    DISPATCH = "DISPATCH"
    IMMEDIATE_DISPATCH = "IMMEDIATE_DISPATCH"

class ResourceAgentResult(BaseModel):
    assignments: List[ResourceAssignment]
    unfulfilled_requirements: List[str]
    reasons: List[str]

class PipelineWarningResponse(BaseModel):
    """Structured, machine-readable warning returned to API clients."""
    code: WarningCode = Field(..., description="Machine-readable warning code")
    source: str = Field(..., description="Agent or service that produced the warning")
    message: str = Field(..., description="Human-readable summary")

class FullResponsePlan(BaseModel):
    """The master output payload returned to the Node.js backend."""
    incident_id: str
    situation: Optional[SituationResult] = None
    risk: Optional[RiskResult] = None
    prediction: Optional[PredictiveAgentResult] = None
    assignments: List[ResourceAssignment] = Field(default_factory=list)
    recommended_action: RecommendedAction
    explanation: List[str] = Field(default_factory=list)
    warnings: List[PipelineWarningResponse] = Field(default_factory=list)
    degraded: bool = Field(default=False, description="True when any agent was skipped or failed")
    human_approval_required: bool = True

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
