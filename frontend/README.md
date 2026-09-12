# DisasterLink Operator Frontend

The operator web application for DisasterLink. It provides an operator enrollment screen and a command view with a six-agent incident-analysis pipeline.

## Current functionality

- Operator signup form with client-side validation for callsign, email, sector, role, and password.
- Operator command view after successful local form submission.
- Six-agent pipeline panel with idle, processing, and completed states.
- A **Run incident analysis** demonstration that updates pipeline state in the browser.
- Interactive OpenStreetMap operator map with Mysore and Assam demo assignments, jurisdiction viewport, and demo incident markers.
- Backend health check via `GET /api/health`; the connection status is shown in the command header.

The signup form does **not** transmit credentials yet. The current backend does not expose an authentication endpoint, so credentials remain in the browser and the screen transitions locally.

The map uses temporary client-side assignment data in `src/App.jsx`. When authentication is available, replace that data with the authenticated operator's assigned region, including `label`, `center` (`[latitude, longitude]`), `zoom`, and incident coordinates.

## Run locally

1. Copy the example environment file and set the backend URL if it differs:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   The default is `VITE_API_URL=http://localhost:3001/api`.

2. Start the backend in a separate terminal (it serves the health endpoint on port 3001):

   ```powershell
   cd ..\backend
   npm install
   npm start
   ```

3. Start the frontend:

   ```powershell
   cd ..\frontend
   npm install
   npm run dev
   ```

4. Verify a production build before pushing:

   ```powershell
   npm run lint
   npm run build
   ```

## Backend work required for full integration

The frontend is visually and locally functional, but the following API work is required before it becomes a production operator system.

| Feature | Required endpoint(s) | Frontend work after the API exists |
| --- | --- | --- |
| Operator authentication | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` | Send signup data securely, persist a session, and protect the command view. |
| Incident triage | `GET /api/incidents`, `GET /api/incidents/:id`, `PATCH /api/incidents/:id` | Populate the triage stream and select a real incident. |
| AI response pipeline | `POST /api/dispatch/plan` or a dedicated `POST /api/incidents/:id/analyze` | Replace the demo button with real agent states, summaries, and a plan. |
| Dispatch approval | `POST /api/dispatch/execute` | Enable approve/reject actions and show dispatch results. |
| Resources and hospitals | `GET/PATCH /api/resources`, `GET/PATCH /api/hospitals` | Display live availability and capacity. |
| Road and prediction data | `GET/PATCH /api/roads`, `GET /api/predictions` | Render live routing hazards and predictive risk. |
| Live updates | WebSocket or Server-Sent Events endpoint | Update incidents, agent progress, resources, and dispatch status without refresh. |
| Authorization and audit trail | Role checks plus audit-log endpoints | Enforce dispatcher/supervisor/admin permissions and record approvals. |

The planned non-auth endpoints are documented in [`../docs/API.md`](../docs/API.md). Keep response schemas stable and document errors so the frontend can display clear operator feedback.

## Important environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend API base URL, including `/api`; defaults to `http://localhost:3001/api`. |

Never put secrets in a `VITE_` variable: Vite exposes these values to the browser.
