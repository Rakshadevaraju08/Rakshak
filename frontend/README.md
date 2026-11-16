# Frontend

This folder is currently a thin workspace for the web administration interface. The actively used operator dashboard in this repository is located at the repository root under `src/`, and the root `package.json` is the script entry for the admin app.

## Current application status

- Active app: root `src/`
- App tooling: Vite + React + TypeScript
- Main entry: `src/App.tsx`
- Dev server: `npm run dev` from repo root

## Structure

```text
frontend/
├── README.md
├── src/
├── package-lock.json
└── legacy references
```

This project has not yet been fully migrated to a dedicated `frontend/` package layout. Until that migration is intentional and complete, keep the root app as the canonical frontend workspace and avoid creating duplicate package configuration.

## Local run

```bash
cd .
npm install
npm run dev
```

The current dashboard is served from the repository root at `http://localhost:3000`.

## Notes

- If the project is migrated to a full `frontend/` package later, update Vite config, aliases, env files, and docs together.
- Keep any root and nested frontend structures aligned to avoid duplicate UI deployments.

## Reports and operational monitoring

The Reports page in the root app summarizes and filters incident records returned by `GET /api/incidents`, and reads resource timestamps from `GET /api/resources`. Its seven-day trend uses incident `createdAt` values. Operational events are received from the existing `GET /api/events` server-sent event stream.

The backend does not provide persisted alert records or alert severity/acknowledgement fields. The page therefore only displays qualifying live events (blocked roads, full hospitals, and unavailable resources) received while it is open; it does not present an alert history or infer severity.
