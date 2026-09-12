from app.schemas.domain import DisasterAnalysisRequest, SituationResult, IncidentType

class SituationAgent:
    """
    The Situation Agent acts as the first layer of the pipeline.
    It parses the incoming request, normalizes data, detects missing or inconsistent
    information, and constructs a coherent understanding of the situation.
    """

    def analyze(self, request: DisasterAnalysisRequest) -> SituationResult:
        incident = request.incident
        explanations = []
        missing_info = []
        
        is_valid = True
        confidence = 1.0

        # 1. Normalize Incident Type
        normalized_type = incident.type.value
        explanations.append(f"Incident identified as {normalized_type}.")

        # 2. Victim Validation
        total_vulnerable = incident.elderly_count + incident.children_count + incident.disabled_count
        
        if total_vulnerable > incident.victim_count:
            explanations.append(f"Data inconsistency: Total vulnerable victims ({total_vulnerable}) exceeds total victim count ({incident.victim_count}).")
            is_valid = False
            confidence -= 0.3
            # Attempt to normalize by fixing the total victim count
            incident.victim_count = total_vulnerable
            explanations.append(f"Auto-corrected total victim count to {incident.victim_count}.")
        elif incident.victim_count > 0:
            explanations.append(f"Verified {incident.victim_count} total victims.")

        if total_vulnerable > 0:
            vulnerable_impact = f"High impact on vulnerable populations: {total_vulnerable} individuals at risk."
        else:
            vulnerable_impact = "No specific vulnerable populations identified."

        # 3. Data Completeness & Specific Checks
        if incident.type == IncidentType.FLOOD:
            if incident.water_level is None:
                missing_info.append("water_level")
                confidence -= 0.2
                explanations.append("Missing water level data for a FLOOD incident.")
            if incident.rainfall is None:
                missing_info.append("rainfall")
                confidence -= 0.1
                explanations.append("Missing rainfall data for a FLOOD incident.")

        if incident.road_access is None:
            missing_info.append("road_access")
            confidence -= 0.1

        # Calculate severity baseline based purely on situation
        severity = "LOW"
        if incident.victim_count > 10 or total_vulnerable > 5:
            severity = "CRITICAL"
        elif incident.victim_count > 0:
            severity = "HIGH"
        
        # Weather / Environment impact
        weather_context = ""
        if request.environment and request.environment.general_weather:
            weather_context = f" Weather conditions: {request.environment.general_weather}."
            if "rain" in request.environment.general_weather.lower() and incident.type == IncidentType.FLOOD:
                severity = "CRITICAL" if severity == "HIGH" else severity

        # Final Summary formulation
        summary = f"A {normalized_type} incident reported at coordinates ({incident.latitude}, {incident.longitude}) with {incident.victim_count} victims.{weather_context}"

        # Ensure confidence boundaries
        confidence = max(0.0, min(1.0, confidence))

        return SituationResult(
            is_valid=is_valid,
            summary=summary,
            severity_assessment=severity,
            vulnerable_population_impact=vulnerable_impact,
            missing_information=missing_info,
            confidence_score=round(confidence, 2),
            explanations=explanations,
            normalized_incident_type=normalized_type
        )
