# API Documentation

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
- `PATCH /api/hospitals/:id`
  - **Purpose:** Update hospital capacity.

### Roads
- `GET /api/roads`
  - **Purpose:** List road statuses.
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
