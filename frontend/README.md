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
