import logging
import math
from typing import Dict, List, Optional

from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    RiskLevel,
    PredictiveAgentResult,
    ForecastItem,
    IncidentType,
    DisasterAnalysisState,
    DecisionProvenance,
)
from app.errors import PipelineWarning, WarningCode
from app.agents.validation import validate_prediction

logger = logging.getLogger("disaster.predictive")

RISK_ORDER = {
    RiskLevel.LOW: 1,
    RiskLevel.MEDIUM: 2,
    RiskLevel.HIGH: 3,
    RiskLevel.CRITICAL: 4,
}


class PredictiveAgent:
    """Estimate possible risk changes only when observed trend evidence is available."""

    def __init__(self, use_ml: bool = False):
        self.use_ml = use_ml
        self.horizons = [20, 45, 60]

    def analyze(self, state: DisasterAnalysisState) -> DisasterAnalysisState:
        pipeline_warnings: List[PipelineWarning] = []
        request = state.request
        current_risk = state.risk

        if not current_risk:
            raise ValueError("PredictiveAgent requires risk assessment to be present in the state.")

        if self.use_ml:
            try:
                result = self._run_ml_model(
                    request,
                    current_risk,
                    state.data_quality.confidence if state.data_quality else None,
                )
                result, validation_warnings = validate_prediction(result, state)
                pipeline_warnings.extend(validation_warnings)
                for warning in validation_warnings:
                    warning.log()
                result._pipeline_warnings = pipeline_warnings
                state.prediction = result
                return state
            except Exception as exc:
                logger.warning("ML prediction unavailable: %s", type(exc).__name__)
                pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.PREDICTION_FAILURE,
                    source="PredictiveAgent",
                    message=f"ML prediction unavailable ({type(exc).__name__}); checking for observed trend data.",
                    detail=str(exc),
                ))

        result = self._run_baseline_prediction(
            request,
            current_risk,
            pipeline_warnings,
            state.data_quality.confidence if state.data_quality else None,
        )
        if self.use_ml:
            result.used_fallback = True
            result.fallback_reason = "Using baseline trend rules only when observed environmental trends are available."
            result.degraded_mode = True

        result, validation_warnings = validate_prediction(result, state)
        pipeline_warnings.extend(validation_warnings)
        for warning in validation_warnings:
            warning.log()

        result._pipeline_warnings = pipeline_warnings
        state.prediction = result
        return state

    def _run_baseline_prediction(
        self,
        request: DisasterAnalysisRequest,
        current_risk: RiskResult,
        pipeline_warnings: List[PipelineWarning],
        data_quality_confidence: Optional[float] = None,
    ) -> PredictiveAgentResult:
        incident_type = request.incident.type
        if incident_type != IncidentType.FLOOD:
            message = (
                f"Prediction is unavailable for {incident_type.value}; the existing trend rules "
                "have no validated mapping for this incident type."
            )
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.PREDICTION_FAILURE,
                source="PredictiveAgent",
                message=message,
            ))
            return self._unavailable_result(current_risk, message)

        relevant_trends: Dict[str, Optional[float]] = {
            "rainfall_trend_mm_per_hour": (
                request.environment.rainfall_trend_mm_per_hour
                if request.environment else None
            )
        }
        relevant_trends["water_level_trend_m_per_hour"] = (
            request.environment.water_level_trend_m_per_hour
            if request.environment else None
        )

        missing_trends = [name for name, value in relevant_trends.items() if value is None]
        available_trends = {name: value for name, value in relevant_trends.items() if value is not None}
        confidence = len(available_trends) / len(relevant_trends) if relevant_trends else 0.0
        if data_quality_confidence is not None:
            confidence = min(confidence, data_quality_confidence)

        if current_risk.risk_level == RiskLevel.UNDETERMINED:
            message = "Prediction is unavailable because the current risk classification is undetermined."
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.PREDICTION_FAILURE,
                source="PredictiveAgent",
                message=message,
            ))
            return self._unavailable_result(current_risk, message)

        if not available_trends:
            if request.environment is None:
                message = "No environmental data was provided; prediction is unavailable."
                pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.MISSING_ENVIRONMENT_DATA,
                    source="PredictiveAgent",
                    message=message,
                ))
            else:
                message = "Prediction is unavailable because no relevant observed environmental trend is available."
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.PREDICTION_FAILURE,
                source="PredictiveAgent",
                message=message,
            ))
            return self._unavailable_result(current_risk, message)

        trend_score = 0.0
        evidence = []
        rainfall_trend = relevant_trends["rainfall_trend_mm_per_hour"]
        if rainfall_trend is None:
            evidence.append("rainfall trend missing")
        elif rainfall_trend > 10.0:
            trend_score += 1.0
            evidence.append(f"rainfall trend rising at {rainfall_trend:g} mm/hour")
        elif rainfall_trend > 0.0:
            trend_score += 0.5
            evidence.append(f"rainfall trend rising at {rainfall_trend:g} mm/hour")
        elif rainfall_trend < 0.0:
            trend_score -= 0.5
            evidence.append(f"rainfall trend decreasing at {rainfall_trend:g} mm/hour")
        else:
            evidence.append("rainfall trend observed at 0 mm/hour")

        water_trend = relevant_trends.get("water_level_trend_m_per_hour")
        if "water_level_trend_m_per_hour" in relevant_trends:
            if water_trend is None:
                evidence.append("water-level trend missing")
            elif water_trend > 0.5:
                trend_score += 1.5
                evidence.append(f"water level rising at {water_trend:g} m/hour")
            elif water_trend > 0.0:
                trend_score += 0.5
                evidence.append(f"water level rising at {water_trend:g} m/hour")
            elif water_trend < 0.0:
                trend_score -= 1.0
                evidence.append(f"water level receding at {water_trend:g} m/hour")
            else:
                evidence.append("water-level trend observed at 0 m/hour")

        if missing_trends:
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.MISSING_ENVIRONMENT_DATA,
                source="PredictiveAgent",
                message=f"Some relevant trend inputs are missing: {', '.join(missing_trends)}.",
            ))

        current_level = RISK_ORDER[current_risk.risk_level]
        inverse_risk_order = {value: key for key, value in RISK_ORDER.items()}
        forecast = []
        escalation_detected = False

        for horizon in self.horizons:
            projected = current_level + trend_score * (horizon / 60.0)
            bounded = max(1, min(4, int(round(projected))))
            projected_risk = inverse_risk_order[bounded]
            escalation_detected = escalation_detected or bounded > current_level
            forecast.append(ForecastItem(horizon_minutes=horizon, risk_level=projected_risk))

        explanation = [
            "Deterministic rule-based trend estimate; it is not a trained or empirically calibrated forecast.",
            f"Observed evidence: {'; '.join(evidence)}.",
            (
                f"Trend-input coverage is {len(available_trends)}/{len(relevant_trends)}; "
                f"confidence {confidence:.0%} reflects input coverage/data quality, not forecast probability."
            ),
        ]
        if missing_trends:
            explanation.append(f"Unavailable trend inputs: {', '.join(missing_trends)}.")
        if escalation_detected:
            explanation.append("The fixed trend rules project at least one horizon above the current risk class.")
        else:
            explanation.append("The fixed trend rules do not project an increase above the current risk class.")

        provenance = DecisionProvenance(
            agent="PredictiveAgent",
            method="deterministic_trend_estimate",
            confidence=confidence,
            inputs=["observed environmental trends", "current risk classification"],
            reasons=explanation,
            warnings=[warning.message for warning in pipeline_warnings],
            fallback_used=False,
        )
        return PredictiveAgentResult(
            current_risk=current_risk.risk_level,
            forecast=forecast,
            escalation_detected=escalation_detected,
            prediction_available=True,
            explanation=explanation,
            confidence=round(confidence, 2),
            decision_provenance=provenance,
        )

    @staticmethod
    def _unavailable_result(current_risk: RiskResult, reason: str) -> PredictiveAgentResult:
        explanation = [
            reason,
            "No stable or escalating forecast has been inferred in the absence of supporting trend evidence.",
        ]
        provenance = DecisionProvenance(
            agent="PredictiveAgent",
            method="unavailable",
            confidence=0.0,
            inputs=["current risk classification", "observed environmental trends"],
            reasons=explanation,
            warnings=[reason],
            fallback_used=False,
        )
        return PredictiveAgentResult(
            current_risk=current_risk.risk_level,
            forecast=[],
            escalation_detected=False,
            prediction_available=False,
            explanation=explanation,
            confidence=0.0,
            decision_provenance=provenance,
        )

    def _run_ml_model(
        self,
        request: DisasterAnalysisRequest,
        current_risk: RiskResult,
        data_quality_confidence: Optional[float],
    ) -> PredictiveAgentResult:
        from app.services.flood_prediction_service import FloodPredictionService

        if request.incident.type != IncidentType.FLOOD:
            raise NotImplementedError("The available prediction model only supports flood incidents.")
        if current_risk.risk_level == RiskLevel.UNDETERMINED:
            raise ValueError("An undetermined current risk cannot be used as a model baseline.")

        service = FloodPredictionService()
        if not service.is_operational():
            raise NotImplementedError("No non-demo flood prediction model is available.")
        metadata = service.metadata
        if metadata and (
            metadata.is_demo_model
            or metadata.dataset_type.upper() == "SYNTHETIC"
        ):
            raise NotImplementedError("Synthetic demo prediction models are not used for operational predictions.")

        environment = request.environment
        if environment is None:
            raise ValueError("Environment data is required for ML prediction.")

        feature_sources = {
            "rainfall_current": environment.rainfall_current_mm,
            "rainfall_1h": environment.rainfall_1h_mm,
            "rainfall_3h": environment.rainfall_3h_mm,
            "rainfall_6h": environment.rainfall_6h_mm,
            "rainfall_24h": environment.rainfall_24h_mm,
            "rainfall_trend": environment.rainfall_trend_mm_per_hour,
            "elevation_m": environment.elevation_m,
        }
        missing = [name for name, value in feature_sources.items() if value is None]
        if missing:
            raise ValueError(f"ML prediction requires measured features: {', '.join(missing)}.")
        if any(not math.isfinite(float(value)) for value in feature_sources.values()):
            raise ValueError("ML prediction features must be finite measured values.")

        prediction = service.predict_flood_risk(feature_sources)
        current_level = RISK_ORDER[current_risk.risk_level]
        predicted_level = RiskLevel(prediction["riskLevel"])
        predicted_order = RISK_ORDER[predicted_level]
        confidence = 1.0 if data_quality_confidence is None else min(1.0, data_quality_confidence)
        explanation = [
            f"Model output: {predicted_level.value} at {prediction['predictionHorizonMinutes']} minutes.",
            f"Model positive-class score: {prediction['probability']}; calibration is not established by this interface.",
            "All model input fields were supplied as measured values; no rolling windows or elevation were synthesized.",
            *prediction["factors"],
        ]
        provenance = DecisionProvenance(
            agent="PredictiveAgent",
            method="ml_model",
            confidence=confidence,
            inputs=list(feature_sources.keys()),
            reasons=explanation,
            warnings=[],
            fallback_used=False,
        )
        return PredictiveAgentResult(
            current_risk=current_risk.risk_level,
            forecast=[ForecastItem(
                horizon_minutes=prediction["predictionHorizonMinutes"],
                risk_level=predicted_level,
            )],
            escalation_detected=predicted_order > current_level,
            prediction_available=True,
            explanation=explanation,
            confidence=round(confidence, 2),
            decision_provenance=provenance,
        )
