# API integration guide

This guide explains how the main application layers connect locally and how to validate the contract between them.

## Frontend to backend

The admin frontend uses the backend REST API for:

- incident listing and updates
- resource management
- hospital and road tracking
- AI analysis trigger requests

The default backend base URL is:

```text
http://localhost:3001/api
```

## Backend to AI service

The backend submits analysis requests to the AI service using `AI_SERVICE_URL` and the AI route configuration. The AI service should respond with structured response plan data that the backend stores in `DispatchPlan` records.

## Event flow

Redis is used as the event backbone for operational updates. The backend publishes update events and the UI or subscribers can consume the stream from `GET /api/events`.

## Local validation steps

1. Start Docker services.
2. Start the backend.
3. Start the AI service.
4. Send an incident to `POST /api/sos`.
5. Trigger `POST /api/incidents/:id/analyze`.
6. Verify the response contains the expected analysis structure.

## Useful checks

```bash
curl http://localhost:3001/api/health
curl http://localhost:8000/health
```

## Common integration issues

- Wrong base URL or port mismatch
- CORS issues caused by stale environment config
- Prisma client not generated after dependency changes
- AI service timeout when the service is not active
- Stale `.env` values during iterative local development

Keep integration changes documented and avoid changing contracts without updating the client and server implementations together.
