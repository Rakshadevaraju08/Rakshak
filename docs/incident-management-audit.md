# Incident Management Audit & Data Layer Contract

**Date**: November 15, 2026  
**Status**: Steps 1, 2, and 3 Complete (Data Layer, Listing, Details View & Status Workflow Production Ready)  
**Scope**: Rakshak Admin Frontend (`src/`), Backend API (`backend/src/routes/api.js`), and Integration Points  

---

## 1. Executive Summary & Repository Topology

The Rakshak platform coordinates disaster response across a citizen mobile SOS client, an operator admin dashboard, a Node.js/Express backend with MySQL via Prisma, and a Python/FastAPI multi-agent AI analysis service.

### Canonical Frontend Location
- **Active Admin Frontend**: Located at the repository root under `src/`, built with Vite, React 19, and TypeScript (`tsconfig.json` includes `src/` and `vite.config.ts`).
- **Legacy `frontend/` directory**: Contains legacy components and scripts from earlier prototypes (`frontend/README.md` explicitly designates root `src/` as the canonical operational workspace).
- **No Mock Incident Data**: Both `src/` and `frontend/` have retired previous static mock incident files (`src/data/incidents.ts` was removed in cleanup commit `6d6106f`). The Incidents page currently connects to the live backend API.

---

## 2. Component, Hook, Service & Route Map

### Routes (`src/App.tsx`)
| Route | Component | Status | Description |
|---|---|---|---|
| `/` | `OverviewPage` (inline in `App.tsx`) | Active | High-level operations overview, response workflow diagram, and link to `/incidents`. |
| `/incidents` | `IncidentsPage` (`src/pages/IncidentsPage.tsx`) | Active | Queue of incoming emergency incidents, selection, and AI analysis trigger. |
| `/intelligence` | `AiIntelligencePage` (`src/pages/AiIntelligencePage.tsx`) | Active | Inspection of 9 AI agents, execution traces, data quality, risk, and safety decisions. |
| `/routing` | `SearchRoutingPage` (`src/pages/SearchRoutingPage.tsx`) | Active | Standalone grid search simulation (BFS, DFS, Greedy, A*); does not consume incident data. |
| `/decisions` | `PlaceholderPage` | Placeholder | Future decision engine workspace. |
| `/dispatch` | `PlaceholderPage` | Placeholder | Future dispatch coordination workspace. |
| `/hospitals` | `HospitalsPage` (`src/pages/HospitalsPage.tsx`) | Active | Hospital capacity and emergency resource availability. |
| `/reports` | `PlaceholderPage` | Placeholder | Future operational reporting workspace. |

### Component Hierarchy (`src/pages/IncidentsPage.tsx`)
- `IncidentsPage`: Container managing incident list loading, refresh state, active selection, and AI analysis execution.
  - `.incident-list-panel`: Queue view rendering `.incident-card` for each incident (title, category badge, status badge, location coordinates, timestamp, victim summary, ID, and "Analyse with AI" action).
  - `AnalysisPanel`: Side panel showing selected incident context, loading/error state, or analysis results.
    - `AnalysisDetails`: Breaks down `FullResponsePlan` into Situation Summary, Metrics, Prediction, Recommended Resources, Assignments, Explanation, Data Quality, Warnings, Safety & Human Review, and Execution Trace.
    - `AnalysisSection`, `StringList`, `QualityField`: Reusable presentation primitives.

### Contexts & State
- `AnalysisContext` (`src/contexts/AnalysisContext.tsx`):
  - In-memory React Context mounted at the root of the route tree.
  - State: `latestAnalysis: { incident: Incident, response: FullResponsePlan, receivedAt: string } | null`.
  - Action: `recordAnalysis(incident: Incident, response: FullResponsePlan): void`.

---

## 3. Incident Data Consumers Outside Incidents Page

### 1. AI Intelligence Centre (`src/pages/AiIntelligencePage.tsx`)
- **Consumption Method**: React Context via `useAnalysisContext()`.
- **Handoff Contract**:
  1. Operator clicks "Analyse with AI" on an incident in `IncidentsPage`.
  2. `IncidentsPage` executes `analyzeIncident(incident.id)` (`POST /api/incidents/:id/analyze`).
  3. On success, `IncidentsPage` invokes `recordAnalysis(incident, response)` on `AnalysisContext`.
  4. When the operator navigates to `/intelligence`, `AiIntelligencePage` retrieves `latestAnalysis`:
     - Reads `latestAnalysis.incident` for incident metadata:
       - `title`: incident title
       - `type`: incident category / hazard type
       - `description`: incident description
       - `locationLat` & `locationLng`: coordinates formatted to 5 decimals
       - `createdAt`: reported timestamp formatted via `Intl.DateTimeFormat`
       - `victimCount`: number of reported victims
       - `elderlyCount`, `childrenCount`, `disabledCount`: vulnerable group breakdown
     - Reads `latestAnalysis.response` (`FullResponsePlan`) for AI pipeline execution output.
- **Session Lifecycle**: Kept in browser memory for the current session. Refreshing resets state.

### 2. Overview Dashboard (`src/App.tsx` -> `OverviewPage`)
- Currently static:
  - Hero action link: `<Link className="primary-button" to="/incidents">Explore incidents</Link>`.
  - Workflow step 1: `Understand · Incident context`.
  - "Recent activity" panel shows a placeholder waiting for live operational connections.

### 3. Navigation / Sidebar (`src/App.tsx` -> `Workspace`)
- Contains navigation item: `{ path: '/incidents', title: 'Incidents', icon: ClipboardList }`.
- Does not currently render live badge counts.

---

## 4. Backend Endpoints, Real Response Shapes & Field Names

All backend endpoints are implemented in `backend/src/routes/api.js` backed by Prisma ORM (`backend/prisma/schema.prisma`).

### Endpoint Summary
| Method | Endpoint | Auth Required | Backend Handler | Description |
|---|---|---|---|---|
| `GET` | `/api/incidents` | None (Open) | `prisma.incident.findMany({ orderBy: { createdAt: 'desc' } })` | List all incidents |
| `GET` | `/api/incidents/:id` | None (Open) | `prisma.incident.findUnique({ include: { reports, predictions, dispatchPlans } })` | Get incident detail with sub-records |
| `PATCH` | `/api/incidents/:id` | `OPERATOR`, `ADMIN` (when auth configured) | `prisma.incident.update({ data: pick(['title', 'description', 'status', 'locationLat', 'locationLng']) })` | Update status, metadata, coordinates |
| `POST` | `/api/incidents/:id/reports` | None (Open) | `prisma.incidentReport.create({ data: { incidentId, content } })` | Add follow-up report |
| `POST` | `/api/incidents/:id/outcomes` | `OPERATOR`, `ADMIN` | `prisma.incidentOutcome.create(...)` & `prisma.incident.update(status: 'RESOLVED')` | Resolve incident with outcome record |
| `POST` | `/api/incidents/:id/analyze` | `OPERATOR`, `ADMIN` | Validates coords, builds AI context, calls AI service, persists `dispatchPlan` | Trigger multi-agent AI analysis |
| `POST` | `/api/sos` | None (Open) | `prisma.incident.create(...)` | Citizen SOS submission |
| `GET` | `/api/events` | None (Open) | Redis pub/sub Server-Sent Events | Live event stream |

---

### Real Response Shapes & Field Specifications

#### 1. `GET /api/incidents`
Returns HTTP 200 with JSON Array:
```json
[
  {
    "id": "c1f76d90-0b65-4f05-8274-94e80f2eb111",
    "title": "Severe Flash Flood near Adyar River",
    "description": "Rapid water level rise, 3 families trapped on roof.",
    "status": "NEW",
    "type": "FLOOD",
    "locationLat": 13.0067,
    "locationLng": 80.2565,
    "victimCount": 12,
    "elderlyCount": 3,
    "childrenCount": 4,
    "disabledCount": 1,
    "waterLevel": 2.4,
    "rainfall": 68.5,
    "roadAccess": "PARTIAL",
    "reporterId": null,
    "createdAt": "2026-11-15T11:20:00.000Z",
    "updatedAt": "2026-11-15T11:25:00.000Z"
  }
]
```

#### 2. `GET /api/incidents/:id`
Returns HTTP 200 with JSON Object (or 404 `{ "error": "Incident not found" }`):
```json
{
  "id": "c1f76d90-0b65-4f05-8274-94e80f2eb111",
  "title": "Severe Flash Flood near Adyar River",
  "description": "Rapid water level rise, 3 families trapped on roof.",
  "status": "NEW",
  "type": "FLOOD",
  "locationLat": 13.0067,
  "locationLng": 80.2565,
  "victimCount": 12,
  "elderlyCount": 3,
  "childrenCount": 4,
  "disabledCount": 1,
  "waterLevel": 2.4,
  "rainfall": 68.5,
  "roadAccess": "PARTIAL",
  "reporterId": null,
  "createdAt": "2026-11-15T11:20:00.000Z",
  "updatedAt": "2026-11-15T11:25:00.000Z",
  "reports": [
    {
      "id": "r-9921",
      "content": "Water rising above ground floor. Electricity disconnected.",
      "createdAt": "2026-11-15T11:22:00.000Z",
      "incidentId": "c1f76d90-0b65-4f05-8274-94e80f2eb111"
    }
  ],
  "predictions": [
    {
      "id": "p-101",
      "predictedRisk": 82.5,
      "predictedWorsening": true,
      "timestamp": "2026-11-15T11:23:00.000Z",
      "incidentId": "c1f76d90-0b65-4f05-8274-94e80f2eb111",
      "weatherObservationId": null,
      "waterLevelId": null
    }
  ],
  "dispatchPlans": [
    {
      "id": "dp-441",
      "status": "PENDING",
      "details": { /* AI response plan */ },
      "createdAt": "2026-11-15T11:24:00.000Z",
      "updatedAt": "2026-11-15T11:24:00.000Z",
      "incidentId": "c1f76d90-0b65-4f05-8274-94e80f2eb111"
    }
  ]
}
```

#### 3. `PATCH /api/incidents/:id`
- Request body: `{ "status": "ACTIVE", "title": "Updated Title", "description": "...", "locationLat": 13.00, "locationLng": 80.25 }`
- Note: Backend explicitly filters payload with `pick(req.body, ['title', 'description', 'status', 'locationLat', 'locationLng'])`. Other keys are ignored.
- Response: HTTP 200 with updated incident record.

#### 4. `POST /api/incidents/:id/reports`
- Request body: `{ "content": "Water level dropped 20cm." }`
- Validation: Returns 400 `{ "error": "content is required" }` if content is missing or whitespace.
- Response: HTTP 201:
  ```json
  {
    "id": "report-uuid",
    "content": "Water level dropped 20cm.",
    "createdAt": "2026-11-15T11:30:00.000Z",
    "incidentId": "incident-uuid"
  }
  ```

#### 5. `POST /api/incidents/:id/outcomes`
- Request body: `{ "resolution": "All victims evacuated safely", "feedback": "Boat team deployed" }`
- Validation: Returns 400 `{ "error": "resolution is required" }` if resolution is empty.
- Side Effect: Sets incident status to `'RESOLVED'` and emits `INCIDENT_RESOLVED`.
- Response: HTTP 201:
  ```json
  {
    "id": "outcome-uuid",
    "resolution": "All victims evacuated safely",
    "feedback": "Boat team deployed",
    "createdAt": "2026-11-15T11:45:00.000Z",
    "incidentId": "incident-uuid"
  }
  ```

#### 6. `POST /api/incidents/:id/analyze`
- Request: Empty POST body with incident ID in path.
- Response: HTTP 201 with `FullResponsePlan` schema:
  - `incident_id`: string
  - `recommended_action`: string
  - `overall_confidence`: float (0..1)
  - `human_review_required`: boolean
  - `fallback_used`: boolean
  - `degraded`: boolean
  - `data_quality`: object (overall_quality, missing_fields, etc.)
  - `situation`: object (summary, normalized_incident_type, etc.)
  - `risk`: object (priority, risk_level, score, reasons)
  - `prediction`: object (current_risk, escalation_detected, forecast, explanation)
  - `resource_agent_result`: object (assignments, unfulfilled_requirements)
  - `assignments`: array of assigned resources and calculated routes
  - `safety_check`: object (status, is_safe_for_autonomous_execution, checks_performed)
  - `autonomy_decision`: object (mode, reason, human_review_required)
  - `trace`: object (trace_id, total_execution_time_ms, steps)

---

## 5. Discrepancies, Bugs & Backend Architectural Blockers

1. **Entire Page Crash on Bad Record**:
   - In `src/services/api.ts`, `fetchIncidents` iterated over records and threw `new Error('The backend returned an invalid incident at position ...')` if any single record lacked an ID or title. A single corrupted record crashed the entire incident queue.
   - **Fix**: Replaced by safe normalization that logs `console.warn` and skips records without a usable ID while parsing valid records safely.

2. **Database Schema Lacks a Dedicated `priority` Column**:
   - The Prisma schema `Incident` model has `type` and `status`, but **no `priority` column**. Priority is computed dynamically during AI analysis (`risk.priority` in `1..5` scale).
   - **Impact**: When displaying incidents in the queue before AI analysis, raw records have no `priority` field.
   - **Resolution**: Normalization maps missing/unknown priority to `'UNKNOWN'`. In future UI steps, a client heuristic (e.g. based on `victimCount`, `type`, and prediction history) or backend schema migration can supply explicit priority.

3. **Backend `PATCH /api/incidents/:id` Whitelist Restriction**:
   - The backend route handler strictly uses:
     `pick(req.body, ['title', 'description', 'status', 'locationLat', 'locationLng'])`.
   - Any attempt by the frontend to update `victimCount`, `type`, `waterLevel`, `rainfall`, or `roadAccess` via this endpoint is silently discarded by the backend.
   - **Status**: Non-blocking for Step 1, but noted for operator editing features in Step 2/3.

4. **No Pagination or Query Filters on `GET /api/incidents`**:
   - `prisma.incident.findMany({ orderBy: { createdAt: 'desc' } })` returns all records in a single array.
   - As data scales, client-side filtering and sorting must be handled by the frontend until backend pagination (`skip`, `take`, `where`) is added.

5. **`GET /api/incidents` Does Not Include Sub-records**:
   - `reports`, `predictions`, and `dispatchPlans` are only returned by `GET /api/incidents/:id`.
   - The list view must operate with empty sub-record arrays until a specific incident is fetched in detail.

6. **Authentication Token Passing**:
   - Backend routes `PATCH /incidents/:id`, `POST /incidents/:id/outcomes`, and `POST /incidents/:id/analyze` enforce `requireRole('OPERATOR', 'ADMIN')` when `JWT_SECRET` is set.
   - The frontend service client must attach `Authorization: Bearer <token>` from `localStorage` (`rakshak_token` or `disasterlink_token`).

7. **Network Timeout Handling**:
   - Previous `fetch` calls in `src/services/api.ts` had no timeout configuration and would hang indefinitely if the backend or AI service became unresponsive.
   - Handled via `AbortSignal` with configurable timeout (default: 15,000ms) with standardized timeout error messaging.

---

## 6. Data Layer Architecture Implemented (Step 1)

1. **`src/services/incidentService.ts`**:
   - Consolidated singleton service for incident data operations.
   - Typed models: `Incident`, `IncidentStatus`, `IncidentPriority`, `IncidentType`, `IncidentReport`, `IncidentPrediction`, `IncidentDispatchPlan`, `IncidentUpdate`.
   - Normalization functions: `normalizeIncident`, `normalizeIncidentList`.
   - Client functions: `fetchIncidents`, `fetchIncidentById`, `updateIncidentStatus`, `updateIncident`, `addIncidentReport`, `resolveIncident`, `analyzeIncident`.
   - Consistent error classification: handles Network Failure, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 5xx Server Errors, and Request Timeouts.

2. **`src/hooks/useIncidents.ts`**:
   - Shared reactive hook `useIncidents`: returns `{ data, loading, error, refetch }`.
   - Shared reactive hook `useIncident(id)`: returns `{ data, loading, error, refetch }`.
   - Automatic abort on unmount or ID change, clean refresh cycles, no memory leaks.

3. **Backwards Compatibility**:
   - `src/services/api.ts` re-exports all existing types (`Incident`, `JsonRecord`, `PipelineTraceStep`, `FullResponsePlan`), helpers (`ApiRequestError`, `isJsonRecord`), and functions (`fetchIncidents`, `analyzeIncident`, `updateIncidentStatus`, `addIncidentReport`).
   - Consumers (`AnalysisContext`, `AiIntelligencePage`, `IncidentsPage`, `OverviewPage`, `Workspace`) remain 100% operational without regression.
   - AI analysis handoff contract preserved in full.

---

## 7. Incidents Listing, Filter & Search (Step 2)

1. **Card Presentation**:
   - Distinct, accessible visual presentation showing category badge, priority badge, and status dot + text badge (both color and textual labels for high accessibility).
   - Card displays ID, human-readable relative timestamp (with exact ISO date and time on hover), coordinates, victim counts, and full description on hover/title.
   - "Analyse with AI" direct action preserved with inline spinner when analysis is in progress.

2. **Search, Filtering, and Sorting Pipeline (`src/utils/incidentFilters.ts`)**:
   - **Debounced Search (~300ms)**: Case-insensitive matching across `title`, `description`, `id`, `type`, `locationCoordinates`, and `victimInformation`. Tolerates null/undefined fields without throwing.
   - **Dynamic Multi-Select Filters**: Options for Status, Priority, and Category are derived dynamically from currently loaded backend records, preventing stale/hardcoded options.
   - **Date Range Filters**: All time, past 24 hours, past 7 days, and past 30 days.
   - **Priority-Ranked & Date Sorting**:
     - `newest`: Most recent timestamp first; missing/invalid timestamps sort last.
     - `oldest`: Oldest timestamp first; missing/invalid timestamps sort last.
     - `priority-desc`: Critical -> High -> Medium -> Low -> Unknown.
     - `priority-asc`: Low -> Medium -> High -> Critical -> Unknown.
     - `status`: New -> Active -> Resolved.
     - `title`: Alphabetical (A–Z).
   - **URL Query Parameters Synchronization**:
     - State persists across page refreshes and browser Back/Forward navigation using `useSearchParams`:
       `?q=...&status=...&priority=...&type=...&range=...&sort=...&page=...&selected=...`.
   - **Client-Side Pagination**:
     - Paginated at 10 items per page with page numbers and next/prev controls.
     - Displays "Showing X of Y incidents" and an active filter chips toolbar with a "Clear all filters" control.

3. **States & Boundary Handling**:
   - Loading skeletons and spinner.
   - Distinct Empty Queue vs. Empty-After-Filtering states with one-click filter reset.
   - Non-blocking notice for dropped invalid records (`droppedCount > 0`).
   - Error banner with "Try again" action.

---

## 8. Incident Details View, Status Workflow & Final State (Step 3)

1. **Incident Details View (`IncidentDetailsPanel`)**:
   - Selected incident resolved either through direct route query parameter (`?selected=<id>`) or queue card selection.
   - Utilizes `useIncident(id)` hook to load single-record sub-records (`reports`, `predictions`, `dispatchPlans`) from `GET /api/incidents/:id`.
   - **Complete Data Representation**:
     - Incident Type / Category
     - Priority badge with rank class
     - Status badge with dot and text
     - Full Description (unabridged)
     - Coordinates (latitude & longitude)
     - Created and Last Updated timestamps (relative + absolute on hover)
     - Reporter identifier
     - Victim Breakdown: Total victims, elderly, children, persons with disabilities
     - Environmental & Infrastructure Indicators: Water level (m), rainfall (mm), road access condition
   - **Missing Field Neutrality**: All missing, null, or undefined fields render a neutral `"Not provided"` in italicized neutral gray, eliminating empty blanks or `"undefined"`.
   - **Boundary States**:
     - Unselected: Clear prompt inviting the operator to choose an incident.
     - Loading: Independent skeleton and loader.
     - 404 Not Found: Specific HTTP 404 banner with a "Back to queue" escape route.
     - API Error: Error banner with "Try again" refetch and "Back to queue" actions.

2. **Status Lifecycle Workflow**:
   - Operates against backend `PATCH /api/incidents/:id` with `{ status: targetStatus }`.
   - **Zero Optimistic UI**: Status only updates in the UI following a 200/201 response from the server.
   - **Double-Submission & No-Op Prevention**:
     - Controls are disabled while an update is in flight with a progress spinner.
     - Current status is disabled as a no-op transition.
   - **Failure & Success Feedback**:
     - On failure: original status is retained; error feedback banner is displayed with retry.
     - On success: success feedback banner is displayed; `updateCachedIncident` is called and both detail and list views are re-synchronized via pub/sub listener.
     - Navigation badge in `App.tsx` and recent activity in `OverviewPage` automatically sync.

3. **Situation Reports & Timeline**:
   - Aggregates `reports`, `predictions`, `dispatchPlans`, and initial intake into a unified chronological log.
   - Order toggleable between newest-first and oldest-first.
   - Each entry features its source badge ("Situation Report", "Dispatch Plan", "Incident Intake", "AI Risk Prediction"), timestamp, and content.
   - Form allowing operators to log follow-up situation reports (`POST /api/incidents/:id/reports`). Submissions automatically append to the incident timeline upon server confirmation.

4. **AI Intelligence Analysis Handoff**:
   - Triggerable from both the listing card and the details panel action bar.
   - Calls `POST /api/incidents/:id/analyze`.
   - Populates the in-memory `AnalysisContext` via `recordAnalysis(incident, response)`.
   - When operator navigates to `/intelligence`, `AiIntelligencePage` seamlessly consumes the latest analysis plan.
   - If analysis is initiated within the details panel, the full multi-agent breakdown (`AnalysisDetails`) is rendered immediately below the timeline.

---

## 9. Verification & Acceptance Criteria Trace

| Acceptance Criterion | Verification Method | Result |
|---|---|---|
| **Real backend records only** | Mock files removed; data layer normalized from `GET /api/incidents` and `GET /api/incidents/:id` | **PASSED** |
| **Resilient normalizer** | Tested sparse records, unparseable timestamps, out-of-range coordinates, missing IDs | **PASSED** (10 unit tests in `src/services/incidentService.test.ts`) |
| **Search, filter, sort** | Tested special characters, multi-select filters, priority ranking, invalid timestamp sorting | **PASSED** (7 unit tests in `src/utils/incidentFilters.test.ts`) |
| **URL query persistence** | State synced to URL `?q=...&status=...&priority=...&type=...&range=...&sort=...&page=...&selected=...` | **PASSED** |
| **Details completeness** | Displays type, coordinates, full description, timestamps, victim breakdown, environmental metrics; missing render "Not provided" | **PASSED** |
| **Non-optimistic status workflow** | `updateIncidentStatus` only updates UI on 200; disabled during flight; error preserves status; no-ops prevented | **PASSED** |
| **Reports & updates timeline** | Aggregates sub-records chronologically; supports `POST /api/incidents/:id/reports` with independent loading/error | **PASSED** |
| **AI analysis preservation** | `analyzeIncident` triggered from list & detail; passes context to `AnalysisContext`; renders `AnalysisDetails` | **PASSED** |
| **TypeScript check** | `tsc --noEmit` (`npm run lint`) | **PASSED** (0 errors) |
| **Production build** | `vite build` (`npm run build`) | **PASSED** (0 errors, dist generated) |

---

## 10. Summary of Backend Gaps & Future Recommendations

1. **Database Schema Priority Column**:
   - `Incident` table in MySQL has no `priority` column. Currently derived from AI prediction score or fallback to `'UNKNOWN'`.
   - *Recommendation*: Add a Prisma migration: `priority String @default("MEDIUM")`.

2. **Backend Pagination & Query Parameters**:
   - `GET /api/incidents` returns all rows without `take`, `skip`, or search filters.
   - *Recommendation*: Implement `take` and `skip` query parameters on `GET /api/incidents`.

3. **Backend `PATCH /api/incidents/:id` Whitelist Expansion**:
   - Current whitelist: `['title', 'description', 'status', 'locationLat', 'locationLng']`.
   - *Recommendation*: Allow updating `victimCount`, `elderlyCount`, `childrenCount`, `disabledCount`, `waterLevel`, and `rainfall`.

4. **Incident Deletion**:
   - No `DELETE /api/incidents/:id` endpoint exists in the backend.


