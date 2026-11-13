# Backend service

The backend is the operational API layer for Rakshak. It exposes the REST endpoints used by the admin dashboard and the mobile application, persists incident and resource data, and interacts with the AI service for deeper disaster analysis.

## Application structure

```text
backend/
├── .env.example
├── package.json
├── prisma/
│   └── schema.prisma
├── server.js
├── src/
│   ├── app.js
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── ...
└── test/
```

## Responsibilities

- manage user authentication and role checks
- store and query incidents, resources, hospitals, roads, and outcomes
- publish Redis events for live updates
- trigger AI analysis for individual incidents
- persist AI-generated dispatch plans and predictions

## Route groups

Core routes are defined in `backend/src/routes/api.js`:

- `/api/auth/*` for user registration and login
- `/api/sos` for incident intake
- `/api/incidents` for incident records and updates
- `/api/resources` for unit tracking
- `/api/hospitals` for hospital capacity and placement
- `/api/roads` for route condition monitoring
- `/api/dispatch/*` for dispatch plans and execution
- `/api/events` for live event subscriptions
- `/api/mesh/sync` for mobile queue synchronization
- `/api/predictions` and `/api/observations/*` for model and environmental data

## Authentication and authorization

The API uses role-based checks for privileged operations. The `requireRole` middleware ensures that certain endpoints are restricted to operators and administrators.

## Prisma and database integration

The database model is defined in `backend/prisma/schema.prisma` and uses MySQL as the datasource.

Local schema updates:

```bash
cd backend
npx prisma db push
npx prisma generate
```

## Environment variables

Use `backend/.env.example` as the template:

```env
PORT=3001
DATABASE_URL="mysql://disaster_user:disaster_password@localhost:3307/disaster_db"
REDIS_URL="redis://localhost:6379"
AI_SERVICE_URL=http://localhost:8000
JWT_SECRET=
CORS_ORIGIN=http://localhost:5173
```

## Development commands

```bash
cd backend
npm install
npm run dev
```

Production-style start:

```bash
npm start
```

## Testing

```bash
cd backend
npm test
```

## Notes

- The backend is intentionally thin around the domain data model and event channel.
- AI analysis is invoked by incident and not by every single client action.
- The event stream and database remain the source of truth for operational state.
