# Planning, Resource Allocation & Dispatch Audit

**Date**: November 16, 2026  
**Status**: Step 1 Complete (Audit & Data Layer Specification)  
**Scope**: Planning & Dispatch Workspace (`/dispatch`), Data Services (`src/services/dispatchService.ts`), Backend Integration (`backend/src/routes/api.js`, `backend/src/services/dispatch.js`), AI Service Contracts (`ai-service/app/schemas/domain.py`), and Shared Boundaries  

---

## 1. Executive Summary

The **Planning, Resource Allocation & Dispatch** module is the operational decision-execution hub within Rakshak. While the **Incidents** module handles emergency report intake, the **AI Intelligence Centre** provides transparent inspection of multi-agent reasoning, and the **Decision Engine** facilitates human-in-the-loop review, the **Dispatch** module is responsible for:
1. Reviewing pending dispatch plans generated for incidents.
2. Assessing assigned resources (ambulances, rescue teams, fire units) and their operational availability.
3. Reviewing designated receiving facilities (hospitals) and their current bed capacity.
4. Evaluating route access, distances, and estimated times of arrival (ETAs) where available.
5. Distinguishing between **suggested** AI/rule allocations and **confirmed/executed** operational dispatches.
6. Triggering official dispatch execution through the backend API to transition units to `DISPATCHED` status in the field.

---

## 2. File Map & Architecture Topology

| Layer / Area | File Path | Role | Status / Constraint |
|---|---|---|---|
| **Frontend Page** | [`src/App.tsx`](file:///c:/Users/Raksha/Rakshak/src/App.tsx#L92-L96) | Route `/dispatch` currently pointing to `<PlaceholderPage section={sections[5]} />` | Modifying in Step 2; Step 1 defines types/service |
| **Dispatch Service** | [`src/services/dispatchService.ts`](file:///c:/Users/Raksha/Rakshak/src/services/dispatchService.ts) | Canonical dispatch models, normalizers, fetchers, execution APIs, and hooks (`useDispatchPlans`, `useDispatchPlan`) | **New (Step 1)** |
| **Dispatch Unit Tests** | [`src/services/dispatchService.test.ts`](file:///c:/Users/Raksha/Rakshak/src/services/dispatchService.test.ts) | Unit tests verifying safe normalization, null resilience, unknown statuses, and envelope handling | **New (Step 1)** |
| **API Re-export Hub** | [`src/services/api.ts`](file:///c:/Users/Raksha/Rakshak/src/services/api.ts) | Re-exports shared types and fetchers across modules | Re-export new dispatch types while keeping all existing exports intact |
| **Hospital & Resource Module** | [`src/pages/HospitalsPage.tsx`](file:///c:/Users/Raksha/Rakshak/src/pages/HospitalsPage.tsx) & [`src/utils/hospitalManagement.ts`](file:///c:/Users/Raksha/Rakshak/src/utils/hospitalManagement.ts) | Hospital bed capacity, resource inventory, filtering | **DO NOT TOUCH** (Read-only consumer of `fetchHospitals`, `fetchResources`) |
| **Incidents Service** | [`src/services/incidentService.ts`](file:///c:/Users/Raksha/Rakshak/src/services/incidentService.ts) | `Incident`, `IncidentDispatchPlan`, `fetchIncidentById`, `fetchIncidents` | Existing exports preserved; provides incident details |
| **Decision Engine** | [`src/pages/DecisionEnginePage.tsx`](file:///c:/Users/Raksha/Rakshak/src/pages/DecisionEnginePage.tsx) | Review of latest AI recommendation and human review status | Compatible; uses `latestAnalysis` and `useIncident` |
| **Backend Prisma Schema** | [`backend/prisma/schema.prisma`](file:///c:/Users/Raksha/Rakshak/backend/prisma/schema.prisma#L152-L161) | Data models: `DispatchPlan`, `Resource`, `Hospital`, `HospitalCapacity`, `Road`, `Incident` | Source of truth; **Do not modify backend** |
| **Backend Routes** | [`backend/src/routes/api.js`](file:///c:/Users/Raksha/Rakshak/backend/src/routes/api.js#L62-L64) | Routes: `POST /dispatch/plan`, `POST /dispatch/execute`, `GET /resources`, `GET /hospitals`, `GET /roads`, `GET /incidents/:id` | Real backend endpoints |
| **Backend Dispatch Service** | [`backend/src/services/dispatch.js`](file:///c:/Users/Raksha/Rakshak/backend/src/services/dispatch.js) | Rule-based fallback and AI dispatch plan generation logic | Source of truth for backend dispatch behavior |
| **AI Domain Schemas** | [`ai-service/app/schemas/domain.py`](file:///c:/Users/Raksha/Rakshak/ai-service/app/schemas/domain.py#L319-L365) | `FullResponsePlan`, `ResourceAssignment`, `RouteResult`, `SafetyCheckResult` | Source of truth for AI recommendation JSON |

---

## 3. Real Backend Data Contracts & Schema Analysis

### 3.1 Database Models (`backend/prisma/schema.prisma`)

#### `DispatchPlan`
```prisma
model DispatchPlan {
  id          String   @id @default(uuid())
  status      String   @default("PENDING") // PENDING, APPROVED, EXECUTED, CANCELLED
  details     Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  incidentId  String
  incident    Incident @relation(fields: [incidentId], references: [id])
}
```

#### `Resource`
```prisma
model Resource {
  id          String   @id @default(uuid())
  type        String   // AMBULANCE, RESCUE_TEAM
  status      String   @default("AVAILABLE") // AVAILABLE, DISPATCHED, MAINTENANCE
  name        String
  locationLat Float?
  locationLng Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  ambulances  Ambulance[]
  rescueTeams RescueTeam[]
}
```

#### `Hospital` & `HospitalCapacity`
```prisma
model Hospital {
  id          String   @id @default(uuid())
  name        String
  locationLat Float?
  locationLng Float?
  capacities  HospitalCapacity[]
}

model HospitalCapacity {
  id         String   @id @default(uuid())
  totalBeds  Int
  available  Int
  updatedAt  DateTime @updatedAt
  hospitalId String
  hospital   Hospital @relation(fields: [hospitalId], references: [id])
}
```

#### `Road`
```prisma
model Road {
  id         String   @id @default(uuid())
  name       String
  status     String   @default("OPEN") // OPEN, BLOCKED, HAZARDOUS
  updatedAt  DateTime @updatedAt
  incidentId String?
  incident   Incident? @relation(fields: [incidentId], references: [id])
}
```

---

## 4. Confirmed Endpoints & Response Shapes

### 4.1 Dispatch Execution Endpoint
- **Endpoint**: `POST /api/dispatch/execute`
- **Access Control**: Requires authentication token with role `OPERATOR` or `ADMIN`.
- **Request Body**:
  ```json
  {
    "planId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
  ```
- **Backend Behavior**:
  1. Updates `DispatchPlan` with `id: planId` to `status: "EXECUTED"`.
  2. Reads `plan.details.recommendedResources || []`.
  3. If resource IDs are present, updates `prisma.resource.updateMany({ where: { id: { in: ids } }, data: { status: "DISPATCHED" } })`.
  4. Publishes Redis event `DISPATCH_APPROVED`.
  5. Returns the updated `DispatchPlan` record.
- **Response Shape (HTTP 200)**:
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "EXECUTED",
    "details": { ... },
    "createdAt": "2026-11-16T12:00:00.000Z",
    "updatedAt": "2026-11-16T12:05:00.000Z",
    "incidentId": "incident-123"
  }
  ```

### 4.2 Dispatch Plan Creation Endpoint
- **Endpoint**: `POST /api/dispatch/plan`
- **Access Control**: Requires authentication token with role `OPERATOR` or `ADMIN`.
- **Request Body**:
  ```json
  {
    "incidentId": "incident-123"
  }
  ```
- **Response Shape (HTTP 201)**:
  ```json
  {
    "id": "plan-uuid",
    "status": "PENDING",
    "details": {
      "incidentId": "incident-123",
      "recommendedResources": ["res-1", "res-2"],
      "recommendedHospitalId": "hosp-1",
      "usableRoadIds": ["road-1"],
      "notes": "Awaiting operator approval.",
      "aiRecommendation": { ... }
    },
    "createdAt": "2026-11-16T12:00:00.000Z",
    "updatedAt": "2026-11-16T12:00:00.000Z",
    "incidentId": "incident-123"
  }
  ```

### 4.3 AI Analysis Dispatch Creation
- **Endpoint**: `POST /api/incidents/:id/analyze`
- **Backend Behavior**: Creates a `DispatchPlan` record with `status: "PENDING"` and `details: aiRecommendation` (`FullResponsePlan`), publishes `DISPATCH_PLANNED`, and returns the `FullResponsePlan`.
- **Response Shape (HTTP 201)**: Contains `assignments`, `recommended_action`, `warnings`, `explanation`, `safety_check`, and `autonomy_decision`.

### 4.4 Plan Retrieval Endpoints
- **Endpoint**: `GET /api/incidents/:id`
- **Response Shape (HTTP 200)**:
  ```json
  {
    "id": "incident-123",
    "title": "Severe flooding near Market St",
    "status": "ACTIVE",
    "reports": [...],
    "predictions": [...],
    "dispatchPlans": [
      {
        "id": "plan-uuid-1",
        "status": "PENDING",
        "details": { ... },
        "createdAt": "2026-11-16T12:00:00.000Z",
        "updatedAt": "2026-11-16T12:00:00.000Z",
        "incidentId": "incident-123"
      }
    ]
  }
  ```

### 4.5 Resource & Hospital Retrieval Endpoints
- **Resources**: `GET /api/resources` -> returns `Resource[]` with sub-arrays `ambulances` and `rescueTeams`.
- **Hospitals**: `GET /api/hospitals` -> returns `Hospital[]` with `capacities` (latest bed count).
- **Roads**: `GET /api/roads` -> returns `Road[]` with `status: "OPEN" | "BLOCKED" | "HAZARDOUS"`.

---

## 5. Suggested vs Confirmed / Assigned Allocations

A central requirement of the Dispatch interface is correctly representing the operational state of resource assignments:
1. **Suggested Allocations (`SUGGESTED`)**:
   - When a `DispatchPlan` has `status: "PENDING"`, its resource assignments are recommendations generated by the AI agent pipeline or rule-based fallback.
   - The resources in the database remain in `AVAILABLE` (or their current physical) status.
   - In AI recommendations, `human_review_required` is explicitly set to `true`.
   - The UI must visually badge these as **Suggested** (or **Proposed**) and clearly state that no physical dispatch has been executed yet.
2. **Confirmed / Executed Allocations (`CONFIRMED` / `DISPATCHED`)**:
   - When an operator clicks **Execute Dispatch**, `POST /api/dispatch/execute` transitions the `DispatchPlan` to `status: "EXECUTED"`.
   - The backend synchronously updates the corresponding records in the `Resource` table to `status: "DISPATCHED"`.
   - The UI visually reflects these as **Dispatched / Confirmed**, showing timestamp of execution.
3. **Database Representation**:
   - The state is stored in `DispatchPlan.status` (`PENDING` vs `EXECUTED`) and mirrored in `Resource.status` (`AVAILABLE` vs `DISPATCHED`).
   - There is no separate `DispatchAssignment` join table in the database; assignments are serialized within the `details` JSON field of `DispatchPlan`.

---

## 6. Route, ETA & Waypoint Availability

- **AI Recommendations (`FullResponsePlan.assignments[].route`)**:
  - The AI service `RouteResult` schema specifies:
    - `estimated_time_mins`: number (minutes)
    - `distance_km`: number (kilometers)
    - `waypoints`: array of `[latitude, longitude]` tuples
    - `route_status`: `"OPEN" | "PARTIAL" | "BLOCKED" | "ROUTE_UNAVAILABLE"`
    - `explanation`: string
- **Backend Fallback Plans (`backend/src/services/dispatch.js`)**:
  - In rule-based fallback plans, **no route, distance, or ETA data is computed or stored**. The details object only contains `recommendedResources`, `recommendedHospitalId`, and `usableRoadIds`.
- **Frontend Normalizer Rule**:
  - Every route, ETA, and distance property must be typed as `number | null` / `string | null`.
  - Normalizers **must never fabricate mock coordinates, distances, or ETAs**. When absent from the payload, they resolve to `null`, and the UI renders a neutral `"Not available"` indicator.

---

## 7. Shared Boundaries & Protected Modules

1. **Hospital & Resource Management (`src/pages/HospitalsPage.tsx`, `src/utils/hospitalManagement.ts`)**:
   - **Constraint**: Must NOT be modified.
   - **Integration**: The dispatch data layer reuses `fetchHospitals`, `fetchResources`, `Hospital`, and `Resource` from `src/services/api.ts` (read-only import).
2. **Incidents Management (`src/pages/IncidentsPage.tsx`, `src/services/incidentService.ts`)**:
   - **Constraint**: Must NOT break or rename any existing exports (`fetchIncidents`, `fetchIncidentById`, `Incident`, `IncidentDispatchPlan`).
   - **Integration**: Reuses `fetchIncidentById` to load plan history when top-level dispatch routes are unavailable.
3. **AI Intelligence Centre (`src/pages/AiIntelligencePage.tsx`, `src/contexts/AnalysisContext.tsx`)**:
   - **Constraint**: `AnalysisContext` and `FullResponsePlan` models must remain untouched.
4. **Decision Engine (`src/pages/DecisionEnginePage.tsx`)**:
   - **Constraint**: Compatible with `IncidentDispatchPlan` and does not conflict with decision status presentations.
5. **Backend Database & APIs**:
   - **Constraint**: No modifications to `backend/prisma/schema.prisma` or backend route controllers.

---

## 8. Backend Discrepancies & Gaps Found

During the code audit, several critical backend gaps and bugs were identified that directly impact how the dispatch frontend must be built:

| Gap / Bug | Location | Impact | Frontend Handling Strategy |
|---|---|---|---|
| **1. Missing `requestDispatchRecommendation` export** | `backend/src/services/dispatch.js:2` imports from `backend/src/services/ai.js`, which does not export it | Calling `POST /api/dispatch/plan` throws a 500 `TypeError` on the backend | The frontend dispatch service wraps `createDispatchPlan` with defensive error handling, surfacing clear server error messages, and relies on `POST /incidents/:id/analyze` as the primary functional plan generation endpoint. |
| **2. Missing `GET /api/dispatch/plans` endpoint** | `backend/src/routes/api.js` | There is no dedicated endpoint to list all dispatch plans across incidents | `fetchDispatchPlans` attempts `GET /dispatch/plans`, but upon receiving 404, gracefully falls back to aggregating plans from `fetchIncidentById(incidentId)` or recent incidents via `fetchIncidents()`. |
| **3. Missing `GET /api/dispatch/plans/:id` endpoint** | `backend/src/routes/api.js` | There is no direct plan-by-id endpoint | `fetchDispatchPlanById` attempts `/dispatch/plans/:id`, and upon 404, locates the plan by querying incident details. |
| **4. Inconsistent Resource ID Key in Details** | `backend/src/routes/api.js:63` checks `plan.details.recommendedResources` | AI plans store resources under `details.assignments[].resource_id`, while fallback plans store them under `details.recommendedResources` | The frontend normalizer inspects both paths (`details.assignments` and `details.recommendedResources`) so resources are extracted regardless of which backend generator created the plan. |
| **5. No Standalone `APPROVED` or `CANCEL` Endpoint** | `backend/src/routes/api.js` | Prisma schema defines `APPROVED` and `CANCELLED`, but routes only support `PENDING` -> `EXECUTED` | The UI and service will only offer the real `execute` action supported by the backend, preventing phantom transitions that would fail. |
| **6. Missing Route / ETA in Fallback Plans** | `backend/src/services/dispatch.js` | Distance, duration, and waypoints are omitted in non-AI plans | The `RouteEta` model marks all fields optional (`null`), and the UI renders "Not available" without crashing. |

---

## 9. Final State & Implementation Trace (Steps 1, 2, and 3 Complete)

The Planning, Resource Allocation & Dispatch interface has been developed, hardened, and verified end-to-end across three planned steps:

### 9.1 Files Created & Modified
1. [`src/services/dispatchService.ts`](file:///c:/Users/Raksha/Rakshak/src/services/dispatchService.ts) (**New - Step 1**):
   - Canonical domain models (`DispatchPlan`, `ResourceAssignment`, `HospitalDestination`, `RouteEta`, `DispatchExecutionPayload`, `DispatchExecutionResult`).
   - Normalizers tolerating null/missing fields, stringified JSON, non-array payloads, and missing IDs.
   - Core API fetchers (`fetchDispatchPlans`, `fetchDispatchPlanById`, `executeDispatchPlan`, `fetchDispatchContextData`).
   - Shared reactive hooks (`useDispatchPlans`, `useDispatchPlan`).
2. [`src/services/dispatchService.test.ts`](file:///c:/Users/Raksha/Rakshak/src/services/dispatchService.test.ts) (**New - Step 1**):
   - 8 test suites verifying normalization safety, unknown status mapping, absent route preservation (`null`), and enveloped responses.
3. [`src/services/dispatchPresentation.ts`](file:///c:/Users/Raksha/Rakshak/src/services/dispatchPresentation.ts) (**New - Step 2/3**):
   - Pure presentation helpers: `filterDispatchPlans`, `sortDispatchPlans`, `getIncompletePlanItems`, `getPlanResourceBreakdown`, `formatRouteDistance`, `formatRouteDuration`, `canExecuteDispatchPlan`, `getExecutionStatusBadge`, and `formatDispatchSummary`.
4. [`src/services/dispatchPresentation.test.ts`](file:///c:/Users/Raksha/Rakshak/src/services/dispatchPresentation.test.ts) (**New - Step 2/3**):
   - 10 test suites verifying search, filtering, newest/oldest sorting, incomplete item detection, route formatting, and execution precondition checks.
5. [`src/pages/DispatchPage.tsx`](file:///c:/Users/Raksha/Rakshak/src/pages/DispatchPage.tsx) (**New - Step 2/3**):
   - Complete Planning, Resource Allocation & Dispatch page:
     - Dispatch plan queue with search, status filter, incident filter, and sort order.
     - 3-stage operational workflow chain (`Incident Source` -> `Assigned Units` -> `Receiving Hospital`).
     - Resource allocation inspector clearly segregating `SUGGESTED` (awaiting operator confirmation) from `CONFIRMED` (units actively dispatched in the field) with an explanatory legend.
     - Receiving hospital panel with real bed metrics (available beds, total beds, occupancy percentage).
     - Road access & route section showing distance and ETA strictly when returned by the backend.
     - Accessible review modal dialog with summary, focus trap, and Escape key cancel.
     - Real execution via `POST /api/dispatch/execute` with no optimistic updates.
     - Success confirmation banner and aria-live announcements.
     - Shared cache synchronization (`refetchPlans`, `fetchDispatchContextData`, `updateCachedIncident`).
6. [`src/App.tsx`](file:///c:/Users/Raksha/Rakshak/src/App.tsx) (**Modified - Step 2**):
   - Mounted `<DispatchPage />` at route `/dispatch`.
7. [`src/services/api.ts`](file:///c:/Users/Raksha/Rakshak/src/services/api.ts) (**Modified - Step 1/2/3**):
   - Re-exported dispatch models, fetchers, and presentation helpers.
8. [`src/index.css`](file:///c:/Users/Raksha/Rakshak/src/index.css) (**Modified - Step 2/3**):
   - Scoped styles for the dispatch workspace, status badges, workflow chain, allocation cards, modal dialog, loading skeletons, responsive stacking (`<=960px` and `<=640px`), and `prefers-reduced-motion` support.
9. [`package.json`](file:///c:/Users/Raksha/Rakshak/package.json) (**Modified - Step 1/2**):
   - Updated `npm test` script to run all 8 workspace test suites.

---

## 10. Known Backend Gaps & Engineering Recommendations

| # | Gap / Discrepancy | Location | Current Frontend Handling Strategy | Recommended Backend Fix |
|---|---|---|---|---|
| 1 | **Missing `requestDispatchRecommendation` export** | `backend/src/services/dispatch.js:2` | Defensively handled; surfaces error if called. Relies primarily on `POST /incidents/:id/analyze`. | In `backend/src/services/ai.js`, export `requestDispatchRecommendation` or alias it to `requestAIAnalysis`. |
| 2 | **Missing `GET /api/dispatch/plans`** | `backend/src/routes/api.js` | Falls back to aggregating plans from recent incidents via `fetchIncidents()` and `fetchIncidentById()`. | Add `router.get('/dispatch/plans', async (req, res, next) => { res.json(await prisma.dispatchPlan.findMany({ orderBy: { createdAt: 'desc' } })); });` |
| 3 | **Missing `GET /api/dispatch/plans/:id`** | `backend/src/routes/api.js` | Falls back to locating the plan in the loaded incident plans cache. | Add `router.get('/dispatch/plans/:id', async (req, res, next) => { ... });` |
| 4 | **No Route / ETA in Fallback Generator** | `backend/src/services/dispatch.js` | `RouteEta` marks all properties optional (`null`); UI renders `"Route information not available"` / `"ETA not available"` without crashing. | Calculate distance and travel time in `dispatch.js` using haversine formula and road graph. |
| 5 | **Missing Standalone Cancel Route** | `backend/src/routes/api.js` | Only `execute` action is exposed in UI; phantom cancel/reject actions are omitted to prevent 404/500 errors. | Add `router.post('/dispatch/cancel', ops, async (req, res, next) => { ... });` |
| 6 | **Resource ID Mismatch in Details JSON** | `backend/src/routes/api.js:63` | Frontend normalizer inspects both `details.assignments[].resource_id` and `details.recommendedResources: string[]`. | Standardize `createPlan` and AI analysis outputs to use consistent assignment structures. |

