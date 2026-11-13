# Rakshak

Rakshak is an AI-assisted disaster-response coordination platform for emergency operations teams, responders, and citizens. It combines a web operations dashboard, a citizen SOS flow, Redis-backed event updates, and a Python AI analysis layer that evaluates risk, recommends resources, and helps plan response actions.

## Problem it addresses

Disaster response is often fragmented across multiple channels: citizens report incidents in ad hoc ways, operators lack a unified incident picture, and dispatchers struggle to assess risk and route resources quickly. Rakshak provides a single operational view that turns incoming reports into triage, AI guidance, and coordinated response planning.

## Primary users and workflow

- Citizens submit SOS reports from the mobile experience.
- Operators use the admin console to monitor incidents and review AI recommendations.
- The backend persists incidents and resources in MySQL and pushes live events through Redis.
- The AI service evaluates incident health, risk, predictive escalation, and routing options.
- Human operators review the final plan before approving dispatch or re-planning decisions.

## Key features

Implemented and verified in the current repository:

- Citizen SOS intake with geolocation and offline queueing
- Incident management endpoints for creation, updates, reports, and resolution
- AI-powered disaster analysis using a FastAPI pipeline
- Risk scoring and escalation prediction
- Resource matching and dispatch recommendations
- Route planning support via modeled routing workflows
- Hospital and road status tracking
- Redis event streaming for live operational updates
- Admin dashboard for incident and AI review

Partially implemented or planned features:

- Full production-grade mobile BLE mesh relay for disconnected networks
- Real OSRM routing integration for every live road network update
- Production ML model training on operational historical data
- Automated execution workflows beyond human approval gates

## Technology stack

- Frontend: React + Vite + TypeScript + React Router
- Backend: Node.js + Express + Prisma + MySQL
- AI service: Python + FastAPI + Pydantic + scikit-learn + pandas + numpy + OR-Tools
- Real-time layer: Redis
- Database: MySQL 8.4 via Docker Compose
- Mobile: Vite-based mobile-first web client with geolocation and offline queueing

## System architecture

```mermaid
flowchart LR
    Citizen[Citizen mobile app] -->|SOS + GPS| Backend[Node.js backend]
    Operator[Admin frontend] -->|incident review + dispatch actions| Backend
    Backend -->|Prisma ORM| DB[(MySQL)]
    Backend -->|publish/subscribe| Redis[(Redis)]
    Backend -->|incident context| AI[Python AI service]
    AI --> Agent[AI agent pipeline]
    Agent -->|risk + prediction + routing + assignments| Backend
    Backend -->|live updates| Operator
    Backend -->|dispatch records| DB
```

The backend sits between the operational UI and the AI analysis layer. The AI service is intentionally separate so model logic, safety checks, and explainability remain isolated from operational API logic.

## Repository structure

```text
RAKSHAK/
├── .env.example
├── README.md
├── docker-compose.yml
├── package.json
├── src/                     # admin frontend application
├── vite.config.ts
├── tsconfig.json
├── index.html
├── dist/                   # local build output (not committed)
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── prisma/
│   ├── src/
│   └── server.js
├── ai-service/
│   ├── app/
│   ├── config/
│   ├── data/
│   ├── demo/
│   ├── docs/
│   ├── scripts/
│   ├── tests/
│   ├── README.md
│   ├── requirements.txt
│   └── pytest.ini
├── mobile/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── docs/
│   ├── API.md
│   ├── architecture/
│   ├── setup/
│   └── development/
├── postman/
├── .gitignore
└── .postman/
```

Note: the current repository keeps the primary admin dashboard at the repository root in `src/`, which matches the existing app architecture. The `frontend/` directory is not the active admin frontend and should be treated as a legacy placeholder unless the project is intentionally migrated.

## Prerequisites

Before you start, install:

- Git
- Node.js 18+ and npm
- Python 3.11+
- Docker Desktop or Docker Engine
- MySQL client tools optional, but Docker compose is enough for local development
- Redis client optional for inspection

## Installation and setup

1. Clone the repository:

```bash
git clone https://github.com/your-org/Rakshak.git
cd Rakshak
```

2. Start the infrastructure services:

```bash
docker compose up -d
```

This starts MySQL on `localhost:3307` and Redis on `localhost:6379`.

3. Set up the backend environment:

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
```

4. Set up the AI service environment:

```bash
cd ../ai-service
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
```

5. Set up the web app:

```bash
cd ..
npm install
```

6. Set up the mobile app:

```bash
cd mobile
npm install
```

## Environment configuration

Use the example files as templates and create local `.env` files without committing secrets.

- Root app: no project-level app env is required for the default dashboard, but keep the root `package.json` and Vite config aligned with the active app.
- Backend: `backend/.env.example`
- AI service: `ai-service/.env.example` if present for your environment
- Mobile: `mobile/.env.example` if needed for local endpoints

Backend environment variables include:

```env
PORT=3001
DATABASE_URL="mysql://disaster_user:disaster_password@localhost:3307/disaster_db"
REDIS_URL="redis://localhost:6379"
AI_SERVICE_URL=http://localhost:8000
JWT_SECRET=
CORS_ORIGIN=http://localhost:5173
```

Do not commit real JWT secrets, Twilio credentials, or production database URLs.

## Running the application

Start each service in a separate terminal.

Database and Redis:

```bash
docker compose up -d
```

Backend:

```bash
cd backend
npm run dev
```

Backend API: `http://localhost:3001/api`
Health check: `GET http://localhost:3001/api/health`

AI service:

```bash
cd ai-service
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

AI docs: `http://localhost:8000/docs`

Admin frontend:

```bash
cd .
npm run dev
```

Frontend URL: `http://localhost:3000`

Mobile app:

```bash
cd mobile
npm run dev
```

Mobile dev server: `http://localhost:5173` unless Vite is configured otherwise.

## API documentation

Project API documentation is distributed across the codebase and service docs:

- Backend API: `http://localhost:3001/api`
- FastAPI docs: `http://localhost:8000/docs`
- API overview: `docs/API.md`
- AI API details: `ai-service/docs/AI_API.md`

For local testing, use `curl` or Postman collections in `postman/`.

## Testing

Backend:

```bash
cd backend
npm test
```

AI service:

```bash
cd ai-service
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pytest
```

Admin frontend:

```bash
cd .
npm run build
```

Mobile app:

```bash
cd mobile
npm run build
```

The repository does not currently define a dedicated front-end or mobile test runner; build validation is the practical default check in this codebase.

## Contribution guidelines

1. Create a feature branch from `main` or the active working branch.
2. Keep each change focused and document it clearly.
3. Update relevant docs when changing architecture, routes, or environment variables.
4. Run the relevant local validation commands before opening a pull request.
5. Open a pull request with a clear description, screenshots when UI changes are involved, and any environment caveats.
6. Track issues in the project board or GitHub Issues using clear reproducible steps.

## Troubleshooting

Common issues experienced in local setup:

- MySQL is not initialized: run `docker compose up -d` and wait for the database container to finish booting.
- Prisma client mismatch: run `npx prisma generate` after dependency installation.
- AI service returns 503 or timeout: verify `AI_SERVICE_URL` and that the FastAPI server is running on port 8000.
- Frontend cannot reach the backend: ensure `CORS_ORIGIN` matches the frontend origin and the backend is listening on port 3001.
- Wrong port mapping: the compose file exposes MySQL at `3307` to avoid conflicts with local MySQL installations.
- Virtual environment not activated: Windows users should run `.\.venv\Scripts\Activate.ps1` before `pytest` or `uvicorn`.

## Documentation map

Important project references:

- [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)
- [docs/architecture/ai-agent-architecture.md](docs/architecture/ai-agent-architecture.md)
- [docs/architecture/database-schema.md](docs/architecture/database-schema.md)
- [docs/setup/local-development.md](docs/setup/local-development.md)
- [docs/development/contribution-guide.md](docs/development/contribution-guide.md)
- [docs/development/api-integration.md](docs/development/api-integration.md)
- [backend/README.md](backend/README.md)
- [ai-service/README.md](ai-service/README.md)
- [mobile/README.md](mobile/README.md)

## License

This project is currently a collaborative internal repository without a repository-level license file in the root tree. Confirm the intended license before production or public distribution.
