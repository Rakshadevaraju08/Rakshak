# AI API Documentation

The AI Service exposes a synchronous HTTP API built with FastAPI.

## `GET /health`
Verifies that the API is running.

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "disaster-response-ai"
}
```

---

## `POST /api/ai/analyze`
The primary endpoint. Accepts a snapshot of the current disaster state and returns a `FullResponsePlan`.

**Request Body:**
```json
{
  "incident": {
    "id": "INC_001",
    "type": "FLOOD",
    "latitude": 26.1445,
    "longitude": 91.7362,
    "victim_count": 12,
    "elderly_count": 2,
    "children_count": 4,
    "disabled_count": 0,
    "water_level": 2.5,
    "rainfall": 150,
    "road_access": "BLOCKED"
  },
  "resources": [
    {
      "id": "AMB_01",
      "type": "AMBULANCE",
      "latitude": 26.1500,
      "longitude": 91.7400,
      "status": "AVAILABLE",
      "capacity": 2
    }
  ],
  "hospitals": [],
  "environment": {
    "general_weather": "Heavy Rain",
    "rainfall_current": 15,
    "elevation_m": 45
  }
}
```

**Response (200 OK):**
```json
{
  "incident_id": "INC_001",
  "situation": { ... },
  "risk": { "priority": 1, "risk_level": "CRITICAL", ... },
  "prediction": { "escalation_detected": true, ... },
  "assignments": [
    {
      "resource_id": "AMB_01",
      "action": "DISPATCH_TO_INCIDENT",
      "estimated_arrival_time_mins": 5.4
    }
  ],
  "recommended_action": "IMMEDIATE_DISPATCH",
  "explanation": [ ... ],
  "warnings": [
    {
      "code": "EMPTY_HOSPITAL_LIST",
      "source": "SituationAgent",
      "message": "No hospitals provided. Medical evacuation routing will be unavailable."
    }
  ],
  "degraded": false,
  "human_approval_required": true
}
```

---

## `POST /api/ai/reanalyze`
Generates a diff between a previous plan and a new situational snapshot.

**Request Body:**
```json
{
  "previous_plan": { /* Output from /analyze */ },
  "updated_state": { /* Same schema as /analyze request */ }
}
```

**Response (200 OK):**
```json
{
  "revision_number": 1,
  "incident_id": "INC_001",
  "previous_action": "PREPARE",
  "new_action": "IMMEDIATE_DISPATCH",
  "changes": [
    "Priority escalated from P3_MEDIUM to P1_CRITICAL.",
    "Resource 'AMB_01' added to assignments."
  ],
  "new_plan": { ... },
  "is_significant_change": true
}
```

---

## `POST /api/ai/predict-flood-risk`
Standalone endpoint to query the ML model without running the full coordination pipeline.

**Request Body:**
```json
{
  "latitude": 26.14,
  "longitude": 91.73,
  "rainfallCurrent": 25,
  "rainfall1h": 25,
  "rainfall3h": 40,
  "rainfall6h": 80,
  "elevation": 45
}
```

**Response (200 OK):**
```json
{
  "riskLevel": "HIGH",
  "probability": 0.85,
  "predictionHorizonMinutes": 30,
  "factors": [
    "Location is in a low-lying vulnerable area"
  ]
}
```
