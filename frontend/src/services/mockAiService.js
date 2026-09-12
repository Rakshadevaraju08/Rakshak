import '../types/ai';

/**
 * Generates a mock FullResponsePlan strictly adhering to the schema.
 * 
 * @param {string} incidentId 
 * @returns {Promise<FullResponsePlan>}
 */
export async function fetchMockAIResponsePlan(incidentId) {
  return new Promise((resolve) => setTimeout(() => resolve({
    incident_id: incidentId,
    human_approval_required: true,
    degraded: false,
    recommended_action: 'IMMEDIATE_DISPATCH',
    explanation: [
      "Immediate life-safety risk detected due to rising water levels near a vulnerable population.",
      "Road access is currently open but predicted to worsen within 45 minutes."
    ],
    situation: {
      is_valid: true,
      summary: "Severe flooding affecting residential zone. Multiple individuals trapped.",
      severity_assessment: "Critical emergency requiring immediate extraction.",
      vulnerable_population_impact: "Elderly person and children present on site. High risk of hypothermia or drowning.",
      missing_information: ["Exact number of individuals on second floor"],
      confidence_score: 0.92,
      explanations: ["Victim counts exceed standard thresholds.", "Water level sensors indicate rapid rise."],
      normalized_incident_type: "FLOOD"
    },
    risk: {
      priority: 1, // P1_CRITICAL (using integer mapping from Enum)
      risk_level: 'CRITICAL',
      severity: 'EXTREME',
      score: 95.5,
      reasons: [
        "Multiple victims including elderly and children",
        "High water level (2.4m)",
        "Limited time window before road access is compromised"
      ],
      confidence: 0.95
    },
    prediction: {
      current_risk: 'HIGH',
      escalation_detected: true,
      explanation: [
        "Upstream rainfall indicates water levels will continue to rise rapidly."
      ],
      confidence: 0.88,
      forecast: [
        { horizon_minutes: 20, risk_level: 'HIGH' },
        { horizon_minutes: 45, risk_level: 'CRITICAL' },
        { horizon_minutes: 60, risk_level: 'CRITICAL' }
      ]
    },
    assignments: [
      {
        resource_id: 'Ambulance 3',
        action: 'DISPATCH_TO_INCIDENT',
        estimated_arrival_time_mins: 8.5,
        route: {
          resource_id: 'Ambulance 3',
          destination_id: incidentId,
          estimated_time_mins: 8.5,
          distance_km: 4.2,
          waypoints: [],
          route_status: 'OPEN',
          explanation: 'Using alternative northern route to bypass localized flooding on Main St.'
        }
      }
    ],
    warnings: [
      {
        code: 'SENSOR_DATA_STALE',
        source: 'SituationAgent',
        message: 'Water level sensor data is 15 minutes old.'
      }
    ]
  }), 800)); // Simulate AI processing delay
}
