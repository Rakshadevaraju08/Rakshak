import logging
from typing import Tuple, List

from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    RiskLevel,
    Priority,
    IncidentType,
    RoadAccessStatus
)
from app.errors import PipelineWarning, WarningCode

logger = logging.getLogger("disaster.risk")


class RiskAgent:
    """
    The Risk Agent determines how urgent and dangerous an incident is.
    Currently uses a transparent, deterministic rule-based scoring baseline.
    Designed to allow integration of an ML model (e.g., scikit-learn) in the future.
    """

    def __init__(self, use_ml: bool = False):
        self.use_ml = use_ml
        self._pipeline_warnings: List[PipelineWarning] = []
        if self.use_ml:
            try:
                from app.services.ml_service import MLService
                self.ml_service = MLService()
                # Propagate model load warnings
                self._pipeline_warnings.extend(self.ml_service.load_warnings)
            except Exception as exc:
                logger.error(f"Failed to initialize MLService: {type(exc).__name__}")
                self.ml_service = None
                self._pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.MODEL_FILE_MISSING,
                    source="RiskAgent",
                    message="ML service could not be initialized. Using rule-based fallback.",
                    detail=str(exc),
                ))

    def analyze(self, request: DisasterAnalysisRequest) -> RiskResult:
        # Reset per-call warnings (keep init warnings)
        call_warnings: List[PipelineWarning] = []

        if self.use_ml:
            result = self._run_ml_model(request, call_warnings)
        else:
            result = self._run_rule_based_scoring(request, call_warnings)

        # Attach warnings for coordinator pickup
        result._pipeline_warnings = self._pipeline_warnings + call_warnings
        return result

    def _run_rule_based_scoring(self, request: DisasterAnalysisRequest, call_warnings: List[PipelineWarning]) -> RiskResult:
        score = 0.0
        conditions: List[str] = []
        incident = request.incident
        confidence = 1.0

        # 1. Victim Assessment
        if incident.victim_count > 0:
            victim_pts = min(incident.victim_count * 5, 40)
            score += victim_pts
            conditions.append(f"multiple victims ({incident.victim_count})")
            
        vulnerable = incident.elderly_count + incident.children_count + incident.disabled_count
        if vulnerable > 0:
            score += min(vulnerable * 10, 30)
            conditions.append(f"vulnerable individuals present ({vulnerable})")

        # 2. Environmental / Physical Hazards
        if incident.type == IncidentType.FLOOD and incident.water_level is not None:
            if incident.water_level > 2.0:
                score += 30
                conditions.append("dangerously high water level (>2.0m)")
            elif incident.water_level > 1.0:
                score += 15
                conditions.append("high water level (>1.0m)")
        elif incident.type == IncidentType.FLOOD and incident.water_level is None:
            # Missing critical data lowers confidence
            confidence -= 0.2

        if incident.rainfall is not None:
            if incident.rainfall > 100:
                score += 20
                conditions.append("extreme rainfall (>100mm)")
            elif incident.rainfall > 50:
                score += 10
                conditions.append("heavy rainfall (>50mm)")
        else:
            confidence -= 0.1

        # 3. Incident Type Modifiers
        if incident.type == IncidentType.FIRE:
            score += 20
            conditions.append("fire incidents carry high potential for rapid spread")
        elif incident.type == IncidentType.EARTHQUAKE:
            score += 25
            conditions.append("earthquake structural risks")

        # 4. Infrastructure Impact
        if incident.road_access == RoadAccessStatus.BLOCKED:
            score += 15
            conditions.append("road access is blocked, complicating rescue")

        # Cap score at 100
        score = min(score, 100.0)

        # 5. Determine Priority and Risk Level based on Score
        priority, risk_level, severity = self._map_score_to_levels(score)

        if not conditions:
            conditions.append("standard incident baseline")
            
        confidence = max(0.0, min(1.0, confidence))
        
        explanation = f"Priority {priority.value} because:\n" + "\n".join(f"- {c}" for c in conditions)

        return RiskResult(
            priority=priority,
            risk_level=risk_level,
            severity=severity,
            score=round(score, 2),
            reasons=[explanation],
            confidence=round(confidence, 2)
        )

    def _map_score_to_levels(self, score: float) -> Tuple[Priority, RiskLevel, str]:
        if score >= 80:
            return Priority.P1_CRITICAL, RiskLevel.CRITICAL, "CRITICAL"
        elif score >= 50:
            return Priority.P2_HIGH, RiskLevel.HIGH, "HIGH"
        elif score >= 25:
            return Priority.P3_MEDIUM, RiskLevel.MEDIUM, "MEDIUM"
        elif score >= 10:
            return Priority.P4_LOW, RiskLevel.LOW, "LOW"
        else:
            return Priority.P5_MONITOR, RiskLevel.LOW, "MINIMAL"

    def _run_ml_model(self, request: DisasterAnalysisRequest, call_warnings: List[PipelineWarning]) -> RiskResult:
        """
        Extracts structured features and runs them through the scikit-learn model.
        Gracefully falls back to rule-based logic if ML fails or data is missing.
        """
        try:
            if not getattr(self, 'ml_service', None) or not self.ml_service.is_available:
                raise ValueError("ML model not available.")

            incident = request.incident
            
            # 1. Feature Extraction using shared ml module
            from app.ml.features import extract_risk_features
            
            # Convert incident Pydantic model to a dict for the extractor
            incident_dict = incident.model_dump()
            
            features = extract_risk_features(incident_dict)

            # 2. Prediction
            priority_val = self.ml_service.predict(features)
            
            # Map predicted priority integer (1-5) to our Enums
            priority = Priority(priority_val)
            
            # Assign risk level based on priority
            risk_level_map = {
                1: (RiskLevel.CRITICAL, "CRITICAL", 95.0),
                2: (RiskLevel.HIGH, "HIGH", 75.0),
                3: (RiskLevel.MEDIUM, "MEDIUM", 50.0),
                4: (RiskLevel.LOW, "LOW", 20.0),
                5: (RiskLevel.LOW, "MINIMAL", 0.0)
            }
            
            risk_level, severity, base_score = risk_level_map[priority_val]

            return RiskResult(
                priority=priority,
                risk_level=risk_level,
                severity=severity,
                score=base_score,
                reasons=[f"Priority {priority_val} because:\n- ML model identified matching risk patterns in incident features"],
                confidence=0.85  # Arbitrary confidence for demo ML
            )

        except Exception as e:
            logger.warning(f"ML Prediction failed: {type(e).__name__}. Falling back to rule-based scoring.")
            call_warnings.append(PipelineWarning(
                code=WarningCode.MODEL_PREDICTION_FAILED,
                source="RiskAgent",
                message=f"ML prediction failed ({type(e).__name__}). Using rule-based risk assessment.",
                detail=str(e),
            ))
            return self._run_rule_based_scoring(request, call_warnings)
