import logging
from datetime import datetime, timedelta
from typing import List

from app.schemas.domain import DisasterAnalysisRequest, SituationResult, IncidentType, DisasterAnalysisState, DecisionProvenance
from app.errors import PipelineWarning, WarningCode
from app.agents.validation import validate_situation

logger = logging.getLogger("disaster.situation")


class SituationAgent:
    """
    The Situation Agent acts as the first layer of the pipeline.
    It parses the incoming request, normalizes data, detects missing or inconsistent
    information, and constructs a coherent understanding of the situation.
    """

    def analyze(self, state: DisasterAnalysisState) -> DisasterAnalysisState:
        request = state.request
        incident = request.incident
        explanations = []
        missing_info = []
        pipeline_warnings: List[PipelineWarning] = []
        
        is_valid = True
        confidence = 1.0

        # 0. Base Confidence
        if getattr(incident, 'confidence', None) is not None:
            confidence = min(confidence, incident.confidence)

        # 1. Normalize Incident Type
        normalized_type = incident.type.value
        explanations.append(f"Incident identified as {normalized_type}.")

        # 2. Victim Info Collection
        vulnerable_counts = {
            "elderly_count": incident.elderly_count,
            "children_count": incident.children_count,
            "disabled_count": incident.disabled_count,
        }
        total_vulnerable = sum(count or 0 for count in vulnerable_counts.values())
        missing_vulnerable_counts = [name for name, count in vulnerable_counts.items() if count is None]
        
        if incident.victim_count is None:
            missing_info.append("victim_count")
            confidence -= 0.2
            explanations.append("Victim count was not reported and was not inferred.")
        elif incident.victim_count > 0:
            if incident.critical_victim_count is not None and incident.critical_victim_count > 0:
                explanations.append(f"Verified {incident.victim_count} total victims, including {incident.critical_victim_count} critical.")
            else:
                explanations.append(f"Verified {incident.victim_count} total victims.")

        if incident.critical_victim_count is None:
            missing_info.append("critical_victim_count")
            confidence -= 0.05
            explanations.append("Critical-victim count was not reported.")

        for field_name in missing_vulnerable_counts:
            missing_info.append(field_name)
            confidence -= 0.05
        if missing_vulnerable_counts:
            explanations.append(
                f"Vulnerable subgroup counts were not reported: {', '.join(missing_vulnerable_counts)}."
            )

        if total_vulnerable > 0:
            vulnerable_impact = f"High impact on vulnerable populations: {total_vulnerable} individuals at risk."
        elif missing_vulnerable_counts:
            vulnerable_impact = "Vulnerable-population counts are unreported."
        else:
            vulnerable_impact = "No specific vulnerable populations identified."

        # 3. Specific Checks
        if incident.road_access is None:
            missing_info.append("road_access")
            confidence -= 0.1

        # 4. Environment data check
        if request.environment is None:
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.MISSING_ENVIRONMENT_DATA,
                source="SituationAgent",
                message="No environmental data provided. Severity assessment may be less accurate.",
            ))
            logger.info("No environmental data provided for situation analysis.")

        # 5. Hospital list check
        if not request.hospitals:
            pipeline_warnings.append(PipelineWarning(
                code=WarningCode.EMPTY_HOSPITAL_LIST,
                source="SituationAgent",
                message="No hospitals provided. Medical evacuation routing will be unavailable.",
            ))

        # Calculate severity baseline based purely on situation
        severity = "UNDETERMINED" if incident.victim_count is None else "LOW"
        if (
            (incident.critical_victim_count or 0) > 0
            or (incident.victim_count is not None and incident.victim_count > 10)
            or total_vulnerable > 5
        ):
            severity = "CRITICAL"
        elif incident.victim_count is not None and incident.victim_count > 0:
            severity = "HIGH"
        
        # Weather / Environment impact
        weather_context = ""
        if request.environment and request.environment.general_weather:
            weather_context = f" Weather conditions: {request.environment.general_weather}."
            if "rain" in request.environment.general_weather.lower() and incident.type == IncidentType.FLOOD:
                severity = "CRITICAL" if severity == "HIGH" else severity

        # Final Summary formulation
        crit_str = f" (with {incident.critical_victim_count} critical)" if (incident.critical_victim_count or 0) > 0 else ""
        victim_summary = (
            f"with {incident.victim_count} victims"
            if incident.victim_count is not None
            else "with an unreported victim count"
        )
        summary = f"A {normalized_type} incident reported at coordinates ({incident.latitude}, {incident.longitude}) {victim_summary}{crit_str}.{weather_context}"

        # Ensure confidence boundaries
        confidence = max(0.0, min(1.0, confidence))

        # Log warnings
        for w in pipeline_warnings:
            w.log()

        # Populate decision provenance
        provenance = DecisionProvenance(
            agent="SituationAgent",
            method="rule_based_parsing",
            confidence=confidence,
            inputs=["incident_type", "location", "victim_count", "vulnerable_count", "road_access", "environment"],
            reasons=explanations,
            warnings=[w.message for w in pipeline_warnings]
        )

        # Store warnings on the result for coordinator to collect
        result = SituationResult(
            is_valid=is_valid,
            summary=summary,
            severity_assessment=severity,
            vulnerable_population_impact=vulnerable_impact,
            missing_information=missing_info,
            confidence_score=confidence,
            explanations=explanations,
            normalized_incident_type=normalized_type,
            decision_provenance=provenance
        )
        result._pipeline_warnings = pipeline_warnings
        
        result, validation_warnings = validate_situation(result, state)
        if validation_warnings:
            result._pipeline_warnings.extend(validation_warnings)
            for w in validation_warnings:
                w.log()
        
        state.situation = result
        return state
