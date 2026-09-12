from typing import List, Tuple
from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    RiskLevel,
    PredictiveAgentResult,
    ForecastItem,
    IncidentType
)

class PredictiveAgent:
    """
    The Predictive Agent estimates how disaster risk may change in the near future.
    Currently uses a deterministic baseline model with hooks prepared for ML forecasting.
    Purpose: Predictive pre-positioning rather than merely reacting to current SOS reports.
    """

    def __init__(self, use_ml: bool = False):
        self.use_ml = use_ml
        self.horizons = [20, 45, 60]

    def analyze(self, request: DisasterAnalysisRequest, current_risk: RiskResult) -> PredictiveAgentResult:
        if self.use_ml:
            return self._run_ml_model(request, current_risk)
        return self._run_baseline_prediction(request, current_risk)

    def _run_baseline_prediction(self, request: DisasterAnalysisRequest, current_risk: RiskResult) -> PredictiveAgentResult:
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

        if not explanation:
            explanation.append("Conditions are projected to remain stable.")

        confidence = max(0.0, min(1.0, confidence))

        return PredictiveAgentResult(
            current_risk=current_risk.risk_level,
            forecast=forecast,
            escalation_detected=escalation_detected,
            explanation=explanation,
            confidence=round(confidence, 2)
        )

    def _run_ml_model(self, request: DisasterAnalysisRequest, current_risk: RiskResult) -> PredictiveAgentResult:
        """
        Placeholder structure to replace rule-based predictions with a scikit-learn model 
        (e.g. Random Forest Regressor or Time-Series model) when real historical data exists.
        
        Assumptions & Limitations:
        - Real historical disaster labeled data with temporal risk progressions is REQUIRED for validation.
        - Using synthetic data for temporal ML predictions creates dangerous false confidence during disasters.
        """
        raise NotImplementedError("ML Model integration requires real historical labeled time-series data.")
