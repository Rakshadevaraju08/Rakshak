import logging
from typing import Dict, List, Optional, Tuple

from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    RiskLevel,
    Priority,
    IncidentType,
    RoadAccessStatus,
    QualityStatus,
    DisasterAnalysisState,
    DecisionProvenance,
)
from app.errors import PipelineWarning, WarningCode
from app.agents.validation import validate_risk

logger = logging.getLogger("disaster.risk")

ML_SUPPORTED_TYPES = {
    IncidentType.FLOOD,
    IncidentType.FIRE,
    IncidentType.EARTHQUAKE,
    IncidentType.OTHER,
}


class RiskAgent:
    """Assess incident risk using transparent rules or an eligible ML classifier."""

    def __init__(self, use_ml: bool = False):
        self.ml_requested = use_ml
        self.use_ml = use_ml
        self.ml_service = None
        self._ml_disabled_reason: Optional[str] = None
        self._pipeline_warnings: List[PipelineWarning] = []
        if self.use_ml:
            try:
                from app.services.ml_service import MLService

                self.ml_service = MLService()
                self._pipeline_warnings.extend(self.ml_service.load_warnings)
                metadata = self.ml_service.metadata
                if metadata and (
                    metadata.is_demo_model
                    or metadata.dataset_type.upper() == "SYNTHETIC"
                ):
                    self.use_ml = False
                    self._ml_disabled_reason = (
                        "The risk model is a demo trained on synthetic rule-generated labels; "
                        "it is not used as operational risk evidence."
                    )
                    self._pipeline_warnings.append(PipelineWarning(
                        code=WarningCode.MODEL_NOT_VALIDATED,
                        source="RiskAgent",
                        message=self._ml_disabled_reason,
                    ))
            except Exception as exc:
                logger.error("Failed to initialize MLService: %s", type(exc).__name__)
                self.ml_service = None
                self._pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.MODEL_FILE_MISSING,
                    source="RiskAgent",
                    message="ML service could not be initialized. Using rule-based fallback.",
                    detail=str(exc),
                ))

    def analyze(self, state: DisasterAnalysisState) -> DisasterAnalysisState:
        call_warnings: List[PipelineWarning] = []
        missing_ml_inputs = self._missing_ml_inputs(state.request)

        if self.ml_requested and not self.use_ml:
            result = self._run_rule_based_scoring(
                state.request,
                call_warnings,
                state.data_quality.confidence if state.data_quality else None,
                fallback_used=True,
            )
            result.used_fallback = True
            result.fallback_reason = self._ml_disabled_reason or "ML model is unavailable."
            result.degraded_mode = True
        elif self.use_ml and missing_ml_inputs:
            reason = "The ML model was not used because required inputs are missing or unsupported."
            call_warnings.append(PipelineWarning(
                code=WarningCode.INCOMPLETE_INCIDENT,
                source="RiskAgent",
                message=f"{reason} Missing or unsupported: {', '.join(missing_ml_inputs)}.",
            ))
            result = self._run_rule_based_scoring(
                state.request,
                call_warnings,
                state.data_quality.confidence if state.data_quality else None,
                fallback_used=True,
            )
            result.used_fallback = True
            result.fallback_reason = reason
            result.degraded_mode = True
        elif self.use_ml:
            result = self._run_ml_model(
                state.request,
                call_warnings,
                state.data_quality.confidence if state.data_quality else None,
            )
        else:
            result = self._run_rule_based_scoring(
                state.request,
                call_warnings,
                state.data_quality.confidence if state.data_quality else None,
            )

        result._pipeline_warnings = self._pipeline_warnings + call_warnings
        result, validation_warnings = validate_risk(result, state)
        if validation_warnings:
            result._pipeline_warnings.extend(validation_warnings)
            for warning in validation_warnings:
                warning.log()

        state.risk = result
        return state

    @staticmethod
    def _input_status(request: DisasterAnalysisRequest) -> Dict[str, bool]:
        incident = request.incident
        status = {
            "victim_count": incident.victim_count is not None,
            "critical_victim_count": incident.critical_victim_count is not None,
            "elderly_count": incident.elderly_count is not None,
            "children_count": incident.children_count is not None,
            "disabled_count": incident.disabled_count is not None,
            "rainfall": (
                incident.rainfall is not None
                and incident.rainfall.quality != QualityStatus.INVALID
            ),
            "road_access": incident.road_access is not None,
        }
        if incident.type == IncidentType.FLOOD:
            status["water_level"] = (
                incident.water_level is not None
                and incident.water_level.quality != QualityStatus.INVALID
            )
        return status

    @staticmethod
    def _missing_ml_inputs(request: DisasterAnalysisRequest) -> List[str]:
        incident = request.incident
        missing = [
            field
            for field, value in (
                ("victim_count", incident.victim_count),
                ("elderly_count", incident.elderly_count),
                ("children_count", incident.children_count),
                ("disabled_count", incident.disabled_count),
                ("rainfall", incident.rainfall),
                ("water_level", incident.water_level),
                ("road_access", incident.road_access),
            )
            if value is None
        ]
        if incident.type not in ML_SUPPORTED_TYPES:
            missing.append(f"incident_type={incident.type.value}")
        if incident.critical_victim_count is None or incident.critical_victim_count > 0:
            missing.append("critical_victim_count (not represented by model features)")
        if incident.road_access == RoadAccessStatus.PARTIAL:
            missing.append("road_access=PARTIAL (not represented by model features)")
        if incident.rainfall is not None and incident.rainfall.quality == QualityStatus.INVALID:
            missing.append("rainfall is invalid")
        if incident.water_level is not None and incident.water_level.quality == QualityStatus.INVALID:
            missing.append("water_level is invalid")
        return missing

    @staticmethod
    def _confidence(status: Dict[str, bool], data_quality_confidence: Optional[float]) -> Tuple[float, int, int]:
        available = sum(status.values())
        total = len(status)
        coverage = available / total if total else 0.0
        confidence = min(coverage, data_quality_confidence) if data_quality_confidence is not None else coverage
        return max(0.0, min(1.0, confidence)), available, total

    def _run_rule_based_scoring(
        self,
        request: DisasterAnalysisRequest,
        call_warnings: List[PipelineWarning],
        data_quality_confidence: Optional[float] = None,
        fallback_used: bool = False,
    ) -> RiskResult:
        score = 0.0
        conditions: List[str] = []
        incident = request.incident
        status = self._input_status(request)
        confidence, available_inputs, total_inputs = self._confidence(status, data_quality_confidence)
        missing_inputs = [name for name, available in status.items() if not available]

        if incident.victim_count is None:
            conditions.append("victim count is unreported and was not inferred")
        elif incident.victim_count > 0:
            score += min(incident.victim_count * 5, 40)
            conditions.append(f"people reported needing help: {incident.victim_count}")
        else:
            conditions.append("reported victim count: 0")

        if (incident.critical_victim_count or 0) > 0:
            score += min(incident.critical_victim_count * 40, 60)
            conditions.append(f"critical victims reported: {incident.critical_victim_count}")

        vulnerable_counts = {
            "elderly_count": incident.elderly_count,
            "children_count": incident.children_count,
            "disabled_count": incident.disabled_count,
        }
        vulnerable = sum(count or 0 for count in vulnerable_counts.values())
        if vulnerable > 0:
            score += min(vulnerable * 10, 30)
            conditions.append(f"vulnerable individuals reported: {vulnerable}")
        elif any(count is None for count in vulnerable_counts.values()):
            conditions.append("vulnerable subgroup counts are unreported; no values were inferred")
        else:
            conditions.append("reported vulnerable subgroup counts: 0")

        if incident.critical_victim_count is None:
            conditions.append("critical-victim count is unreported and was not inferred")

        water_level_valid = (
            incident.water_level is not None
            and incident.water_level.quality != QualityStatus.INVALID
        )
        rainfall_valid = (
            incident.rainfall is not None
            and incident.rainfall.quality != QualityStatus.INVALID
        )

        if incident.type == IncidentType.FLOOD and water_level_valid:
            if incident.water_level.value > 2.0:
                score += 30
                conditions.append("dangerously high water level (>2.0m)")
            elif incident.water_level.value > 1.0:
                score += 15
                conditions.append("high water level (>1.0m)")
        elif incident.type == IncidentType.FLOOD and incident.water_level is not None:
            conditions.append("water-level observation excluded because it is marked invalid")

        if rainfall_valid:
            if incident.rainfall.value > 100:
                score += 20
                conditions.append("extreme rainfall (>100mm)")
            elif incident.rainfall.value > 50:
                score += 10
                conditions.append("heavy rainfall (>50mm)")
        elif incident.rainfall is not None:
            conditions.append("rainfall observation excluded because it is marked invalid")

        if incident.type == IncidentType.FIRE:
            score += 20
            conditions.append("fire incident type")
        elif incident.type == IncidentType.EARTHQUAKE:
            score += 25
            conditions.append("earthquake incident type")
        elif incident.type == IncidentType.LOCALIZED_ACCIDENT:
            score += 15
            conditions.append("localized accident incident type")

        if incident.road_access in (RoadAccessStatus.BLOCKED, RoadAccessStatus.ROUTE_UNAVAILABLE):
            score += 15
            conditions.append(f"road access is {incident.road_access.value.lower()}")
        elif incident.road_access == RoadAccessStatus.PARTIAL:
            conditions.append("road access is partial; no validated score weight is available")

        score = min(score, 100.0)
        priority, risk_level, severity = self._map_score_to_levels(score)

        if score < 25 and missing_inputs:
            risk_level = RiskLevel.UNDETERMINED
            severity = RiskLevel.UNDETERMINED.value
            priority = Priority.P5_MONITOR
            reported_score = None
            conditions.append(
                "classification is undetermined because available evidence is insufficient "
                "to support even a LOW assessment"
            )
        else:
            reported_score = round(score, 2)

        if incident.rainfall is None:
            observed_rainfall = "missing"
        elif not rainfall_valid:
            observed_rainfall = "invalid"
        else:
            observed_rainfall = f"{incident.rainfall.value:g}mm"
        conditions.append(
            "Observed inputs: "
            f"victim_count={incident.victim_count if incident.victim_count is not None else 'missing'}, "
            f"critical_victim_count={incident.critical_victim_count if incident.critical_victim_count is not None else 'missing'}, "
            f"elderly_count={incident.elderly_count if incident.elderly_count is not None else 'missing'}, "
            f"children_count={incident.children_count if incident.children_count is not None else 'missing'}, "
            f"disabled_count={incident.disabled_count if incident.disabled_count is not None else 'missing'}, "
            f"rainfall={observed_rainfall}, "
            f"road_access={incident.road_access.value if incident.road_access else 'missing'}"
        )
        if incident.type == IncidentType.FLOOD:
            if incident.water_level is None:
                observed_water_level = "missing"
            elif not water_level_valid:
                observed_water_level = "invalid"
            else:
                observed_water_level = f"{incident.water_level.value:g}m"
            conditions.append(f"Observed water_level={observed_water_level}")

        if missing_inputs:
            conditions.append(f"Missing or invalid risk inputs: {', '.join(missing_inputs)}")
        conditions.append(
            f"Input/data-quality confidence: {confidence:.0%} "
            f"({available_inputs}/{total_inputs} required risk inputs available); "
            "this is not a probability of the risk classification being correct."
        )
        conditions.append(
            f"Rule-point subtotal: {score:g}/100; this heuristic score is not a probability."
        )

        explanation = f"Risk classification {risk_level.value} using transparent rule-based scoring:\n" + "\n".join(
            f"- {condition}" for condition in conditions
        )
        provenance = DecisionProvenance(
            agent="RiskAgent",
            method="rule_based",
            confidence=confidence,
            inputs=[
                "incident.victim_count",
                "incident.critical_victim_count",
                "incident.type",
                "incident.road_access",
                "incident.water_level",
                "incident.rainfall",
                "incident.elderly_count",
                "incident.children_count",
                "incident.disabled_count",
            ],
            reasons=conditions,
            warnings=[warning.message for warning in call_warnings],
            fallback_used=fallback_used,
        )

        return RiskResult(
            priority=priority,
            risk_level=risk_level,
            severity=severity,
            score=reported_score,
            reasons=[explanation],
            confidence=round(confidence, 2),
            decision_provenance=provenance,
        )

    def _map_score_to_levels(self, score: float) -> Tuple[Priority, RiskLevel, str]:
        if score >= 80:
            return Priority.P1_CRITICAL, RiskLevel.CRITICAL, "CRITICAL"
        if score >= 50:
            return Priority.P2_HIGH, RiskLevel.HIGH, "HIGH"
        if score >= 25:
            return Priority.P3_MEDIUM, RiskLevel.MEDIUM, "MEDIUM"
        if score >= 10:
            return Priority.P4_LOW, RiskLevel.LOW, "LOW"
        return Priority.P5_MONITOR, RiskLevel.LOW, "MINIMAL"

    def _run_ml_model(
        self,
        request: DisasterAnalysisRequest,
        call_warnings: List[PipelineWarning],
        data_quality_confidence: Optional[float],
    ) -> RiskResult:
        """Run an eligible classifier without manufacturing scores or probabilities."""
        try:
            if not self.ml_service or not self.ml_service.is_available:
                raise ValueError("ML model not available.")

            incident = request.incident
            from app.ml.features import extract_risk_features

            features = extract_risk_features(incident.model_dump())
            priority_val = int(self.ml_service.predict(features))
            priority = Priority(priority_val)
            risk_level_map = {
                Priority.P1_CRITICAL: (RiskLevel.CRITICAL, "CRITICAL"),
                Priority.P2_HIGH: (RiskLevel.HIGH, "HIGH"),
                Priority.P3_MEDIUM: (RiskLevel.MEDIUM, "MEDIUM"),
                Priority.P4_LOW: (RiskLevel.LOW, "LOW"),
                Priority.P5_MONITOR: (RiskLevel.LOW, "MINIMAL"),
            }
            risk_level, severity = risk_level_map[priority]
            status = self._input_status(request)
            confidence, available_inputs, total_inputs = self._confidence(status, data_quality_confidence)
            reasons = [
                f"Classifier output: {priority.name}; no calibrated class probability or risk score is available.",
                f"Input/data-quality confidence: {confidence:.0%} "
                f"({available_inputs}/{total_inputs} risk inputs available); not a probability.",
            ]
            provenance = DecisionProvenance(
                agent="RiskAgent",
                method="ml_classifier",
                confidence=confidence,
                inputs=["incident features required by the risk model"],
                reasons=reasons,
                fallback_used=False,
            )
            return RiskResult(
                priority=priority,
                risk_level=risk_level,
                severity=severity,
                score=None,
                reasons=reasons,
                confidence=round(confidence, 2),
                decision_provenance=provenance,
            )
        except Exception as exc:
            logger.warning("ML prediction failed: %s; using rule-based scoring.", type(exc).__name__)
            call_warnings.append(PipelineWarning(
                code=WarningCode.MODEL_PREDICTION_FAILED,
                source="RiskAgent",
                message=f"ML prediction failed ({type(exc).__name__}). Using rule-based fallback.",
                detail=str(exc),
            ))
            fallback_result = self._run_rule_based_scoring(
                request,
                call_warnings,
                data_quality_confidence,
                fallback_used=True,
            )
            fallback_result.used_fallback = True
            fallback_result.fallback_reason = f"ML prediction failed ({type(exc).__name__})."
            fallback_result.degraded_mode = True
            return fallback_result
