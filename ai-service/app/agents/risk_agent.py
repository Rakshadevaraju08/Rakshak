from typing import Tuple, List
from app.schemas.domain import (
    DisasterAnalysisRequest,
    RiskResult,
    RiskLevel,
    Priority,
    IncidentType,
    RoadAccessStatus
)

class RiskAgent:
    """
    The Risk Agent determines how urgent and dangerous an incident is.
    Currently uses a transparent, deterministic rule-based scoring baseline.
    Designed to allow integration of an ML model (e.g., scikit-learn) in the future.
    """

    def __init__(self, use_ml: bool = False):
        self.use_ml = use_ml
        if self.use_ml:
            from app.services.ml_service import MLService
            self.ml_service = MLService()

    def analyze(self, request: DisasterAnalysisRequest) -> RiskResult:
        if self.use_ml:
            return self._run_ml_model(request)
        return self._run_rule_based_scoring(request)

    def _run_rule_based_scoring(self, request: DisasterAnalysisRequest) -> RiskResult:
        score = 0.0
        reasons: List[str] = []
        incident = request.incident
        confidence = 1.0

        # 1. Victim Assessment
        if incident.victim_count > 0:
            victim_pts = min(incident.victim_count * 5, 40)
            score += victim_pts
            reasons.append(f"Multiple victims ({incident.victim_count})")
            
        vulnerable = incident.elderly_count + incident.children_count + incident.disabled_count
        if vulnerable > 0:
            score += min(vulnerable * 10, 30)
            reasons.append(f"Vulnerable individuals present ({vulnerable})")

        # 2. Environmental / Physical Hazards
        if incident.type == IncidentType.FLOOD and incident.water_level is not None:
            if incident.water_level > 2.0:
                score += 30
                reasons.append("Dangerously high water level (>2.0m)")
            elif incident.water_level > 1.0:
                score += 15
                reasons.append("High water level (>1.0m)")
        elif incident.type == IncidentType.FLOOD and incident.water_level is None:
            # Missing critical data lowers confidence
            confidence -= 0.2

        if incident.rainfall is not None:
            if incident.rainfall > 100:
                score += 20
                reasons.append("Extreme rainfall (>100mm)")
            elif incident.rainfall > 50:
                score += 10
                reasons.append("Heavy rainfall (>50mm)")
        else:
            confidence -= 0.1

        # 3. Incident Type Modifiers
        if incident.type == IncidentType.FIRE:
            score += 20
            reasons.append("Fire incidents carry high potential for rapid spread")
        elif incident.type == IncidentType.EARTHQUAKE:
            score += 25
            reasons.append("Earthquake structural risks")

        # 4. Infrastructure Impact
        if incident.road_access == RoadAccessStatus.BLOCKED:
            score += 15
            reasons.append("Road access is blocked, complicating rescue")

        # Cap score at 100
        score = min(score, 100.0)

        # 5. Determine Priority and Risk Level based on Score
        priority, risk_level, severity = self._map_score_to_levels(score)

        if not reasons:
            reasons.append("Standard incident baseline")
            
        confidence = max(0.0, min(1.0, confidence))

        return RiskResult(
            priority=priority,
            risk_level=risk_level,
            severity=severity,
            score=round(score, 2),
            reasons=reasons,
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

    def _run_ml_model(self, request: DisasterAnalysisRequest) -> RiskResult:
        """
        Extracts structured features and runs them through the scikit-learn model.
        Gracefully falls back to rule-based logic if ML fails or data is missing.
        """
        try:
            if not getattr(self, 'ml_service', None) or self.ml_service.model is None:
                raise ValueError("ML model not available.")

            incident = request.incident
            
            # 1. Feature Extraction (must match train_risk.py ordering)
            # ['victim_count', 'elderly_count', 'children_count', 'disabled_count',
            #  'rainfall', 'water_level', 'road_access_blocked', 'is_flood', 'is_fire', 'is_earthquake']
            
            # Treat missing numerical values as 0.0 for the ML baseline
            rainfall = incident.rainfall if incident.rainfall is not None else 0.0
            water_level = incident.water_level if incident.water_level is not None else 0.0
            
            road_blocked = 1 if incident.road_access == RoadAccessStatus.BLOCKED else 0
            is_flood = 1 if incident.type == IncidentType.FLOOD else 0
            is_fire = 1 if incident.type == IncidentType.FIRE else 0
            is_earthquake = 1 if incident.type == IncidentType.EARTHQUAKE else 0
            
            features = [
                incident.victim_count,
                incident.elderly_count,
                incident.children_count,
                incident.disabled_count,
                rainfall,
                water_level,
                road_blocked,
                is_flood,
                is_fire,
                is_earthquake
            ]

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
                reasons=[f"ML model assigned priority {priority_val} based on incident features."],
                confidence=0.85 # Arbitrary confidence for demo ML
            )

        except Exception as e:
            import logging
            logging.error(f"ML Prediction failed: {e}. Falling back to rule-based scoring.")
            return self._run_rule_based_scoring(request)
