import logging
from datetime import datetime, timedelta
from typing import List

from app.schemas.domain import (
    DisasterAnalysisState, 
    DataQualityResult, 
    QualityStatus,
    IncidentType,
    WarningCode
)
from app.errors import PipelineWarning

logger = logging.getLogger("disaster.data_quality")

class DataQualityAgent:
    """
    The Data Quality Agent is the first gatekeeper.
    It validates freshness, boundaries, missing fields, and cross-source conflicts
    for external environmental data to establish provenance and confidence.
    """
    
    def __init__(self):
        # Configurable thresholds
        self.STALE_MINUTES = 120
        self.WATER_LEVEL_MIN = 0.0
        self.WATER_LEVEL_MAX = 15.0 # Max realistic flood in meters
        self.RAINFALL_MIN = 0.0
        self.RAINFALL_MAX = 500.0 # Max realistic rainfall in mm
        
    def analyze(self, state: DisasterAnalysisState) -> DisasterAnalysisState:
        request = state.request
        incident = request.incident
        
        overall_quality = QualityStatus.VALID
        confidence = 1.0
        stale_fields = []
        invalid_fields = []
        missing_fields = []
        conflicting_fields = []
        warnings = []
        provenance = []
        pipeline_warnings: List[PipelineWarning] = []
        
        now = datetime.utcnow()
        
        # Helper to check an observation
        def check_observation(obs, field_name: str, min_val: float, max_val: float):
            nonlocal confidence, overall_quality
            
            if obs is None:
                return
                
            provenance.append(f"{field_name} from {obs.source} at {obs.timestamp.isoformat()}")
            
            # 1. Freshness (Timestamp validation)
            if (now - obs.timestamp.replace(tzinfo=None)) > timedelta(minutes=self.STALE_MINUTES):
                stale_fields.append(field_name)
                confidence -= 0.1
                obs.quality = QualityStatus.SUSPECT
                warnings.append(f"{field_name} data is stale (> {self.STALE_MINUTES} mins).")
                pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.STALE_DATA,
                    source="DataQualityAgent",
                    message=f"{field_name} data is stale (> {self.STALE_MINUTES} mins)."
                ))
                
            # 2. Numeric Boundaries (Schema/Numeric validation)
            if obs.value < min_val or obs.value > max_val:
                invalid_fields.append(field_name)
                confidence -= 0.3
                obs.quality = QualityStatus.INVALID
                overall_quality = QualityStatus.INVALID
                warnings.append(f"{field_name} value {obs.value} is outside realistic bounds [{min_val}, {max_val}].")
                
            # 3. Incorporate observation's inherent confidence
            if obs.confidence < 1.0:
                confidence = min(confidence, obs.confidence)

        # Validate water_level
        check_observation(incident.water_level, "water_level", self.WATER_LEVEL_MIN, self.WATER_LEVEL_MAX)
        
        # Validate rainfall
        check_observation(incident.rainfall, "rainfall", self.RAINFALL_MIN, self.RAINFALL_MAX)
        
        # Missing data detection for FLOOD
        if incident.type == IncidentType.FLOOD:
            if incident.water_level is None:
                missing_fields.append("water_level")
                confidence -= 0.2
                warnings.append("Missing water_level for FLOOD incident.")
                pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.INCOMPLETE_INCIDENT,
                    source="DataQualityAgent",
                    message="Missing water_level for FLOOD incident."
                ))
            if incident.rainfall is None:
                missing_fields.append("rainfall")
                confidence -= 0.1
                warnings.append("Missing rainfall for FLOOD incident.")
                pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.INCOMPLETE_INCIDENT,
                    source="DataQualityAgent",
                    message="Missing rainfall for FLOOD incident."
                ))
                
        # Cross-source conflict detection
        if incident.type == IncidentType.FLOOD and incident.water_level and incident.water_level.quality != QualityStatus.INVALID:
            if request.environment and request.environment.water_level_trend_m_per_hour is not None:
                if incident.water_level.value > 1.0 and request.environment.water_level_trend_m_per_hour < -0.5:
                    conflicting_fields.append("water_level")
                    conflicting_fields.append("environment.water_level_trend")
                    confidence -= 0.3
                    overall_quality = QualityStatus.SUSPECT if overall_quality == QualityStatus.VALID else overall_quality
                    incident.water_level.quality = QualityStatus.SUSPECT
                    warnings.append("Conflict: High water level reported but environment shows strongly receding trend.")
                    pipeline_warnings.append(PipelineWarning(
                        code=WarningCode.DATA_CONFLICT,
                        source="DataQualityAgent",
                        message="Conflict: High water level reported but environment shows strongly receding trend."
                    ))

        # Check Incident overall timestamp
        if getattr(incident, 'timestamp', None) and (now - incident.timestamp.replace(tzinfo=None)) > timedelta(minutes=self.STALE_MINUTES):
            stale_fields.append("incident.timestamp")
            confidence -= 0.2
            warnings.append(f"Incident data overall is stale (> {self.STALE_MINUTES} mins).")
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.STALE_DATA,
                source="DataQualityAgent",
                message=f"Incident data is older than {self.STALE_MINUTES} minutes."
            ))

        if getattr(incident, 'confidence', None) is not None:
            confidence = min(confidence, incident.confidence)
            
        confidence = max(0.0, min(1.0, confidence))
        
        if invalid_fields:
            overall_quality = QualityStatus.INVALID
        elif stale_fields or missing_fields or conflicting_fields:
            if overall_quality != QualityStatus.INVALID:
                overall_quality = QualityStatus.SUSPECT
                
        used_fallback = bool(stale_fields or missing_fields or conflicting_fields)
        fallback_reason = "Using stale, partial, or conflicting cache data due to live data unavailability." if used_fallback else None

        result = DataQualityResult(
            overall_quality=overall_quality,
            confidence=round(confidence, 2),
            stale_fields=stale_fields,
            invalid_fields=invalid_fields,
            missing_fields=missing_fields,
            conflicting_fields=conflicting_fields,
            warnings=warnings,
            provenance=provenance,
            used_fallback=used_fallback,
            fallback_reason=fallback_reason,
            degraded_mode=used_fallback
        )
        
        # Attach transient warnings for coordinator
        result._pipeline_warnings = pipeline_warnings
        
        state.data_quality = result
        return state
