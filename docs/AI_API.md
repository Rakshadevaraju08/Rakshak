# AI Service API Documentation

## 1. Architecture
The AI Service runs as an independent Python FastAPI application communicating directly with the Node.js/Express backend. The frontend does not interact with the AI Service directly.

```text
Browser → Node Backend → FastAPI AI Service
```

## 2. Base URL
Local environment: `http://localhost:8000`

## 3. Environment Variable
The backend relies on the `AI_SERVICE_URL` environment variable to connect to the FastAPI application.
```env
AI_SERVICE_URL=http://localhost:8000
```

## 4. Endpoint
### POST `/api/ai/analyze`
Generates a complete disaster response plan utilizing five independent agents.

## 5. Request Schema (`DisasterAnalysisRequest`)
**Content-Type:** `application/json`

```json
{
  "incident": {
    "id": "string (UUID)",
    "type": "string (FLOOD, FIRE, MEDICAL, EARTHQUAKE, OTHER)",
    "latitude": "float",
    "longitude": "float",
    "victim_count": "integer",
    "elderly_count": "integer",
    "children_count": "integer",
    "disabled_count": "integer",
    "water_level": "float (optional, meters)",
    "rainfall": "float (optional, mm)",
    "road_access": "string (OPEN, PARTIAL, BLOCKED)"
  },
  "resources": [
    {
      "id": "string (UUID)",
      "type": "string (AMBULANCE, RESCUE_TEAM, RESCUE_BOAT, MEDICAL_TEAM)",
      "status": "string (AVAILABLE, DISPATCHED, MAINTENANCE)",
      "latitude": "float",
      "longitude": "float"
    }
  ],
  "hospitals": [
    {
      "id": "string (UUID)",
      "name": "string",
      "latitude": "float",
      "longitude": "float",
      "available_beds": "integer"
    }
  ],
  "roads": [
    {
      "id": "string (UUID)",
      "name": "string",
      "status": "string (OPEN, BLOCKED, HAZARDOUS)"
    }
  ],
  "environment": {
    "rainfall_trend_mm_per_hour": "float (optional)",
    "water_level_trend_m_per_hour": "float (optional)"
  }
}
```

## 6. Response Schema (`FullResponsePlan`)
```json
{
  "incident_id": "string",
  "priority": "integer (1-5)",
  "risk_level": "string (CRITICAL, HIGH, MEDIUM, LOW)",
  "recommended_action": "string (IMMEDIATE_DISPATCH, DISPATCH, PRE_POSITION, PREPARE, MONITOR)",
  "resource_assignments": [
    {
      "resource_id": "string",
      "action": "string",
      "route": {
        "resource_id": "string",
        "destination_id": "string",
        "estimated_time_mins": "float",
        "distance_km": "float",
        "waypoints": [
          ["float (lat)", "float (lng)"]
        ],
        "route_status": "string",
        "explanation": "string"
      },
      "estimated_arrival_time_mins": "float"
    }
  ],
  "unfulfilled_requirements": ["string (Incident IDs)"],
  "explanation": ["string (Bullet points)"],
  "warnings": [
    {
      "code": "string",
      "source": "string",
      "message": "string",
      "detail": "string"
    }
  ]
}
```

## 7. Enums
- **Priority:** `1` (Critical) to `5` (Monitor)
- **RiskLevel:** `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- **RecommendedAction:** `IMMEDIATE_DISPATCH`, `DISPATCH`, `PRE_POSITION`, `PREPARE`, `MONITOR`
- **WarningCode:** `MISSING_ENVIRONMENT_DATA`, `MISSING_RESOURCES`, `NO_AVAILABLE_RESOURCE`, `NO_SUITABLE_RESOURCE`, `OSRM_UNAVAILABLE`, `INVALID_COORDINATES`, `MODEL_FILE_MISSING`, `MODEL_PREDICTION_FAILED`, `MALFORMED_INPUT`, `EMPTY_HOSPITAL_LIST`, `INCOMPLETE_INCIDENT_INFO`, `OPTIMIZATION_FAILURE`, `PREDICTION_FAILURE`

## 8. Error Responses

**400 Bad Request** (Validation Error)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid disaster analysis request",
  "details": [
    {
      "loc": ["body", "incident", "latitude"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**503 Service Unavailable** (AI Backend Offline)
```json
{
  "error": "AI_SERVICE_UNAVAILABLE",
  "message": "AI service is currently unavailable"
}
```

**504 Gateway Timeout** (Request exceeded 15 seconds)
```json
{
  "error": "AI_SERVICE_TIMEOUT",
  "message": "AI analysis timed out"
}
```

## 9. Timeout Behavior
The backend uses a strict **15-second** timeout for all requests to the AI Service. If the request exceeds this time, the client receives a `504 Gateway Timeout` response.

## 10. Example Request
```json
{
  "incident": {
    "id": "INC001",
    "type": "FLOOD",
    "latitude": 12.2958,
    "longitude": 76.6394,
    "victim_count": 3,
    "elderly_count": 1,
    "children_count": 0,
    "disabled_count": 0,
    "water_level": 1.8,
    "rainfall": 92.5,
    "road_access": "PARTIAL"
  },
  "resources": [],
  "hospitals": [],
  "roads": [],
  "environment": {}
}
```

## 11. Example Response
```json
{
  "incident_id": "INC001",
  "priority": 2,
  "risk_level": "HIGH",
  "recommended_action": "DISPATCH",
  "resource_assignments": [],
  "unfulfilled_requirements": [
    "INC001"
  ],
  "explanation": [
    "Priority 2 because:\n- multiple victims (3)\n- vulnerable individuals present (1)\n- high water level (>1.0m)\n- heavy rainfall (>50mm)",
    "Risk expected to remain stable because:\n- no environmental data provided. Prediction relies entirely on static incident data.",
    "DISPATCH recommended because:\n- risk level is HIGH\n- vulnerable individuals present"
  ],
  "warnings": [
    {
      "code": "MISSING_ENVIRONMENT_DATA",
      "source": "PredictiveAgent",
      "message": "No environmental data provided. Prediction confidence significantly reduced.",
      "detail": null
    },
    {
      "code": "MISSING_RESOURCES",
      "source": "ResourceAgent",
      "message": "No resources provided in the request. Cannot dispatch any units.",
      "detail": null
    },
    {
      "code": "EMPTY_HOSPITAL_LIST",
      "source": "ResourceAgent",
      "message": "No hospitals provided. Medical evacuation routing will be unavailable.",
      "detail": null
    }
  ]
}
```

## 12. Backend Integration Flow
```text
POST /api/incidents/:id/analyze
       ↓
Node backend retrieves Incident, Resources, Hospitals, Roads, Environmental data
       ↓
Constructs DisasterAnalysisRequest
       ↓
fetch(AI_SERVICE_URL + '/api/ai/analyze')
       ↓
FastAPI Master Coordinator executes Pipeline
       ↓
FullResponsePlan returned
       ↓
Node backend persists to DispatchPlan
       ↓
Frontend
```
