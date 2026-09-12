import logging
from typing import List

from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    RiskLevel,
    PredictiveAgentResult,
    ForecastItem,
    IncidentType,
    DisasterAnalysisState
)
from app.errors import PipelineWarning, WarningCode
from app.agents.validation import validate_prediction

logger = logging.getLogger("disaster.predictive")


class PredictiveAgent:
    """
    The Predictive Agent estimates how disaster risk may change in the near future.
    Currently uses a deterministic baseline model with hooks prepared for ML forecasting.
    Purpose: Predictive pre-positioning rather than merely reacting to current SOS reports.
    """

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
                result = self._run_ml_model(request, current_risk)
                
                result, validation_warnings = validate_prediction(result, state)
                if validation_warnings:
                    pipeline_warnings.extend(validation_warnings)
                    for w in validation_warnings:
                        w.log()
                
                result._pipeline_warnings = pipeline_warnings
                state.prediction = result
                return state
            except NotImplementedError:
                logger.warning("ML model not implemented for predictions. Falling back to baseline.")
                pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.PREDICTION_FAILURE,
                    source="PredictiveAgent",
                    message="ML prediction model not available. Using baseline deterministic forecast.",
                ))
            except Exception as exc:
                logger.warning(f"ML prediction failed: {type(exc).__name__}. Falling back to baseline.")
                pipeline_warnings.append(PipelineWarning(
                    code=WarningCode.PREDICTION_FAILURE,
                    source="PredictiveAgent",
                    message=f"ML prediction failed ({type(exc).__name__}). Using baseline deterministic forecast.",
                    detail=str(exc),
                ))

        result = self._run_baseline_prediction(request, current_risk, pipeline_warnings)
        
        result, validation_warnings = validate_prediction(result, state)
        if validation_warnings:
            pipeline_warnings.extend(validation_warnings)
            for w in validation_warnings:
                w.log()
                
        result._pipeline_warnings = pipeline_warnings
        state.prediction = result
        return state

    def _run_baseline_prediction(
        self,
        request: DisasterAnalysisRequest,
        current_risk: RiskResult,
        pipeline_warnings: List[PipelineWarning],
    ) -> PredictiveAgentResult:
        explanation: List[str] = []
        confidence = 1.0
        escalation_detected = False
        
        # Risk level mapping to integers for easy shifting
        # LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4
        risk_map = {
            RiskLevel.LOW: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.HIGH: 3,
            RiskLevel.CRITICAL: 4
        }
        inv_risk_map = {v: k for k, v in risk_map.items()}
        
        current_level_int = risk_map[current_risk.risk_level]
        trend_score = 0.0
        
        env = request.environment
        
        if env:
            # Analyze Rainfall
            if env.rainfall_trend_mm_per_hour is not None:
                if env.rainfall_trend_mm_per_hour > 10.0:
                    trend_score += 1.0
                    explanation.append(f"Rainfall trend is heavily increasing (+{env.rainfall_trend_mm_per_hour}mm/hr).")
                elif env.rainfall_trend_mm_per_hour > 0.0:
                    trend_score += 0.5
                    explanation.append(f"Rainfall trend is slightly increasing (+{env.rainfall_trend_mm_per_hour}mm/hr).")
                elif env.rainfall_trend_mm_per_hour < 0.0:
                    trend_score -= 0.5
                    explanation.append(f"Rainfall trend is decreasing ({env.rainfall_trend_mm_per_hour}mm/hr).")
            else:
                confidence -= 0.2
                
            # Analyze Water Level
            if env.water_level_trend_m_per_hour is not None:
                if env.water_level_trend_m_per_hour > 0.5:
                    trend_score += 1.5
                    explanation.append(f"Water level is rising rapidly (+{env.water_level_trend_m_per_hour}m/hr).")
                elif env.water_level_trend_m_per_hour > 0.0:
                    trend_score += 0.5
                    explanation.append(f"Water level is rising (+{env.water_level_trend_m_per_hour}m/hr).")
                elif env.water_level_trend_m_per_hour < 0.0:
                    trend_score -= 1.0
                    explanation.append(f"Water level is receding ({env.water_level_trend_m_per_hour}m/hr).")
            else:
                if request.incident.type == IncidentType.FLOOD:
                    confidence -= 0.3
                    
        else:
            confidence -= 0.5
            explanation.append("No environmental data provided. Prediction relies entirely on static incident data.")
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.MISSING_ENVIRONMENT_DATA,
                source="PredictiveAgent",
                message="No environmental data provided. Prediction confidence significantly reduced.",
            ))

        # Generate forecast based on the trend score
        forecast = []
        current_projected_int = float(current_level_int)
        
        for horizon in self.horizons:
            # Over time, the trend compoundedly affects the risk
            # For 20 mins, we apply a fraction of the hourly trend
            time_factor = horizon / 60.0
            
            projected_val = current_projected_int + (trend_score * time_factor)
            
            # Cap the risk level integer between 1 (LOW) and 4 (CRITICAL)
            bounded_val = max(1, min(4, int(round(projected_val))))
            
            if bounded_val > current_level_int:
                escalation_detected = True
                
            forecast.append(ForecastItem(
                horizon_minutes=horizon,
                risk_level=inv_risk_map[bounded_val]
            ))

        if escalation_detected:
            formatted_explanation = "Risk expected to increase because:\n" + "\n".join(f"- {c[0].lower() + c[1:]}" for c in explanation)
            explanation = [formatted_explanation]
        elif explanation:
            # If there are explanations but no escalation, still format them under a stable header
            formatted_explanation = "Risk expected to remain stable because:\n" + "\n".join(f"- {c[0].lower() + c[1:]}" for c in explanation)
            explanation = [formatted_explanation]
        else:
            explanation = ["Risk expected to remain stable because:\n- no significant worsening trends detected"]

        confidence = max(0.0, min(1.0, confidence))

        return PredictiveAgentResult(
            current_risk=current_risk.risk_level,
            forecast=forecast,
            escalation_detected=escalation_detected,
            explanation=explanation,
            confidence=round(confidence, 2)
        )

    def _run_ml_model(self, request: DisasterAnalysisRequest, current_risk: RiskResult) -> PredictiveAgentResult:
        from app.services.flood_prediction_service import FloodPredictionService
        
        service = FloodPredictionService()
        if not service.is_available():
            raise NotImplementedError("ML Model file is missing or failed to load.")
            
        env = request.environment
        if not env:
            raise ValueError("Environment data is required for ML prediction.")
            
        # Build features dict for the service
        features = {
            'rainfall_current': env.rainfall_current_mm or 0,
            'rainfall_1h': (env.rainfall_current_mm or 0) * 1.5, # approximation since we don't have full history in simple request
            'rainfall_3h': (env.rainfall_current_mm or 0) * 3,
            'rainfall_6h': (env.rainfall_current_mm or 0) * 6,
            'rainfall_24h': (env.rainfall_current_mm or 0) * 24,
            'rainfall_trend': env.rainfall_trend_mm_per_hour or 0,
            'elevation_m': env.elevation_m or 50.0
        }
        
        pred = service.predict_flood_risk(features)
        
        # Determine escalation
        risk_map = {RiskLevel.LOW: 1, RiskLevel.MEDIUM: 2, RiskLevel.HIGH: 3, RiskLevel.CRITICAL: 4}
        current_int = risk_map[current_risk.risk_level]
        predicted_enum = RiskLevel(pred['riskLevel'])
        pred_int = risk_map[predicted_enum]
        
        escalation = pred_int > current_int
        
        forecast = [ForecastItem(horizon_minutes=pred['predictionHorizonMinutes'], risk_level=predicted_enum)]
        
        return PredictiveAgentResult(
            current_risk=current_risk.risk_level,
            forecast=forecast,
            escalation_detected=escalation,
            explanation=pred['factors'],
            confidence=pred['probability']
        )
