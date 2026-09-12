# API Documentation

### Authentication
- `POST /api/auth/register`
  - **Request body:** `{ "email", "password", "name" }`; creates a citizen user.
- `POST /api/auth/login`
  - **Request body:** `{ "email", "password" }`; returns a signed token when `JWT_SECRET` is configured.

## PLANNED ENDPOINTS

### Incidents
- `POST /api/sos`
  - **Purpose:** Submit a new incident/SOS.
  - **Request Body:** `{ "title", "description", "locationLat", "locationLng" }`
  - **Response:** `{ "id", "status" }`
  - **Consumer:** Frontend, Mobile

- `GET /api/incidents`
  - **Purpose:** List all active incidents.
  - **Response:** `[ { "id", "title", "status", ... } ]`
  - **Consumer:** Frontend (Operator Dashboard)

- `GET /api/incidents/:id`
  - **Purpose:** Get incident details.

- `PATCH /api/incidents/:id`
  - **Purpose:** Update incident status.
- `POST /api/incidents/:id/reports`
  - **Purpose:** Add a citizen or operator update to an incident.
- `POST /api/incidents/:id/outcomes`
  - **Purpose:** Resolve an incident and record the outcome.

### Resources
- `GET /api/resources`
  - **Purpose:** List available resources.
- `POST /api/resources`
  - **Purpose:** Add a new resource.
- `PATCH /api/resources/:id`
  - **Purpose:** Update resource status.

### Hospitals
- `GET /api/hospitals`
  - **Purpose:** List hospitals and capacity.
- `POST /api/hospitals`
  - **Purpose:** Create a hospital, optionally with its initial bed capacity.
- `PATCH /api/hospitals/:id/capacity`
  - **Purpose:** Update hospital capacity.

### Roads
- `GET /api/roads`
  - **Purpose:** List road statuses.
- `POST /api/roads`
  - **Purpose:** Create a road for live route monitoring.
- `PATCH /api/roads/:id`
  - **Purpose:** Update road status (e.g., OPEN, BLOCKED).

### Dispatch & Planning
- `POST /api/dispatch/plan`
  - **Purpose:** Request AI to generate a dispatch plan for an incident.
  - **Request Body:** `{ "incidentId" }`
  - **Response:** `{ "planId", "details" }`
  - **Consumer:** Frontend (Operator Dashboard)

- `POST /api/dispatch/execute`
  - **Purpose:** Approve and execute a generated dispatch plan.

### Offline Mesh
- `POST /api/mesh/sync`
  - **Purpose:** Sync batched offline messages from a gateway device.
  - **Request Body:** `[ { "payload", "senderId", "receivedAt" } ]`
  - **Consumer:** Mobile

### Predictions
- `GET /api/predictions`
  - **Purpose:** Retrieve predictions for map visualization.
- `POST /api/predictions`
  - **Purpose:** Store an AI prediction and notify live dashboards.

### Environmental observations
- `POST /api/observations/weather`
  - **Purpose:** Store a weather measurement and publish `WEATHER_CHANGED`.
- `POST /api/observations/water-levels`
  - **Purpose:** Store a water-level reading and publish `WATER_LEVEL_CHANGED`.

### Live updates
- `GET /api/events`
  - **Purpose:** Server-Sent Events stream for SOS, road, hospital, resource,
    prediction, and dispatch changes.
