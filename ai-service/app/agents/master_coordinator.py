import logging
from typing import List
from app.schemas.domain import (
    DisasterAnalysisRequest,
    FullResponsePlan,
    RecommendedAction,
    RiskLevel
)
from app.agents.situation_agent import SituationAgent
from app.agents.risk_agent import RiskAgent
from app.agents.predictive_agent import PredictiveAgent
from app.agents.resource_agent import ResourceAgent
from app.agents.route_agent import RouteAgent

class MasterCoordinator:
    """
    The Master Coordinator orchestrates the entire AI pipeline.
    It combines results from all specialized agents into a FullResponsePlan.
    Gracefully handles failures in optional components to ensure system stability.
    """

    def __init__(self, use_ml_risk: bool = False):
        self.situation_agent = SituationAgent()
        self.risk_agent = RiskAgent(use_ml=use_ml_risk)
        self.predictive_agent = PredictiveAgent()
        self.resource_agent = ResourceAgent()
        self.route_agent = RouteAgent()

    def analyze(self, request: DisasterAnalysisRequest) -> FullResponsePlan:
        explanation: List[str] = []
        warnings: List[str] = []
        
        # 1. Run Situation Agent (Required)
        try:
            situation = self.situation_agent.analyze(request)
            if situation.missing_information:
                warnings.append(f"Missing data: {', '.join(situation.missing_information)}")
            explanation.extend(situation.explanations)
        except Exception as e:
            logging.error(f"Situation Agent failed critically: {e}")
            raise RuntimeError("Situation analysis is a strict dependency but it failed.") from e

        # 2. Run Risk Agent (Required)
        try:
            risk = self.risk_agent.analyze(request)
            explanation.extend(risk.reasons)
        except Exception as e:
            logging.error(f"Risk Agent failed critically: {e}")
            raise RuntimeError("Risk analysis is a strict dependency but it failed.") from e

        # 3. Run Predictive Agent (Optional/Graceful)
        prediction = None
        try:
            prediction = self.predictive_agent.analyze(request, risk)
            explanation.extend(prediction.explanation)
        except Exception as e:
            msg = f"Predictive Agent failed: {e}"
            logging.warning(msg)
            warnings.append(msg)

        # 4. Run Resource Agent (Optional/Graceful)
        resource_result = None
        assignments = []
        try:
            resource_result = self.resource_agent.analyze(request, risk)
            assignments = resource_result.assignments
            explanation.extend(resource_result.reasons)
            if resource_result.unfulfilled_requirements:
                warnings.append(f"Unfulfilled incident requirements for: {', '.join(resource_result.unfulfilled_requirements)}")
        except Exception as e:
            msg = f"Resource Agent failed: {e}"
            logging.warning(msg)
            warnings.append(msg)

        # 5. Run Route Agent for selected resources (Optional/Graceful)
        if assignments:
            for assignment in assignments:
                try:
                    # Find the resource object from the request
                    res_obj = next((r for r in request.resources if r.id == assignment.resource_id), None)
                    if res_obj:
                        route = self.route_agent.analyze(
                            resource_id=res_obj.id,
                            destination_id=request.incident.id,
                            origin_lat=res_obj.latitude,
                            origin_lon=res_obj.longitude,
                            dest_lat=request.incident.latitude,
                            dest_lon=request.incident.longitude
                        )
                        assignment.route = route
                        assignment.estimated_arrival_time_mins = route.estimated_time_mins
                except Exception as e:
                    msg = f"Route Agent failed for {assignment.resource_id}: {e}"
                    logging.warning(msg)
                    warnings.append(msg)

        # 6. Determine Recommended Action
        escalating = prediction.escalation_detected if prediction else False
        risk_lvl = risk.risk_level

        if risk_lvl == RiskLevel.CRITICAL:
            action = RecommendedAction.IMMEDIATE_DISPATCH
        elif risk_lvl == RiskLevel.HIGH and escalating:
            action = RecommendedAction.IMMEDIATE_DISPATCH
        elif risk_lvl == RiskLevel.HIGH:
            action = RecommendedAction.DISPATCH
        elif risk_lvl == RiskLevel.MEDIUM and escalating:
            action = RecommendedAction.PRE_POSITION
        elif risk_lvl == RiskLevel.MEDIUM:
            action = RecommendedAction.PREPARE
        else:
            action = RecommendedAction.MONITOR

        # Finalize Response Plan
        plan = FullResponsePlan(
            incident_id=request.incident.id,
            situation=situation,
            risk=risk,
            prediction=prediction,
            assignments=assignments,
            recommended_action=action,
            explanation=explanation,
            warnings=warnings,
            human_approval_required=True
        )

        return plan
