# API overview

This document is a quick map of the backend API exposed by Rakshak. Use it alongside the live service endpoints and the FastAPI docs for the AI service.

## Service endpoints

- Backend API base: `http://localhost:3001/api`
- AI docs: `http://localhost:8000/docs`
- Backend health: `GET /api/health`

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

These endpoints create or validate a user account and return a signed JWT when configured.

## Incident operations

- `POST /api/sos` — create a new incident from an emergency report
- `GET /api/incidents` — list incidents in reverse chronological order
- `GET /api/incidents/:id` — get incident details, reports, predictions, and dispatch plans
- `PATCH /api/incidents/:id` — update incident metadata
- `POST /api/incidents/:id/reports` — add a follow-up report
- `POST /api/incidents/:id/outcomes` — resolve an incident
- `POST /api/incidents/:id/analyze` — trigger the AI pipeline for a specific incident

## Resource and infrastructure data

- `GET /api/resources`
- `POST /api/resources`
- `PATCH /api/resources/:id`
- `GET /api/hospitals`
- `POST /api/hospitals`
- `PATCH /api/hospitals/:id/capacity`
- `GET /api/roads`
- `POST /api/roads`
- `PATCH /api/roads/:id`

## Dispatch and prediction

- `POST /api/dispatch/plan` — create a dispatch recommendation
- `POST /api/dispatch/execute` — execute an approved plan
- `GET /api/predictions`
- `POST /api/predictions`
- `POST /api/observations/weather`
- `POST /api/observations/water-levels`

## Event stream and mesh sync

- `GET /api/events` — live events surfaced through Redis-backed subscriptions
- `POST /api/mesh/sync` — save queued mobile messages after reconnect

## Related docs

- [docs/architecture/system-architecture.md](architecture/system-architecture.md)
- [docs/setup/local-development.md](setup/local-development.md)
- [ai-service/docs/AI_API.md](../ai-service/docs/AI_API.md)
