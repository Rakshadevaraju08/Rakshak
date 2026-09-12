from enum import Enum
from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class EventType(str, Enum):
    NEW_INCIDENT = "NEW_INCIDENT"
    ROAD_BLOCKED = "ROAD_BLOCKED"
    RESOURCE_UNAVAILABLE = "RESOURCE_UNAVAILABLE"
    HOSPITAL_FULL = "HOSPITAL_FULL"
    WATER_LEVEL_CHANGED = "WATER_LEVEL_CHANGED"
    RAINFALL_CHANGED = "RAINFALL_CHANGED"
    
class EventMessage(BaseModel):
    """
    Standard envelope for all events flowing from Redis Pub/Sub or Kafka.
    """
    event_id: str = Field(..., description="Unique identifier for the event")
    type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: Dict[str, Any] = Field(..., description="The actual data of the event")
    source: str = Field(default="backend-service", description="Origin of the event")
    correlation_id: Optional[str] = Field(None, description="Used to trace an event across distributed systems")
