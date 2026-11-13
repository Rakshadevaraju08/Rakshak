# Local development guide

This guide covers the fastest local setup path for Rakshak using Docker for MySQL and Redis plus individual Node and Python services.

## Prerequisites

- Node.js 18+
- npm
- Python 3.11+
- Docker Desktop or Docker Engine

## Start infrastructure services

```bash
docker compose up -d
```

This starts:

- MySQL at `localhost:3307`
- Redis at `localhost:6379`

## Backend setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

The backend runs on `http://localhost:3001` and exposes `GET /api/health`.

## AI service setup

```bash
cd ai-service
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The AI service docs are at `http://localhost:8000/docs`.

## Frontend setup

```bash
cd .
npm install
npm run dev
```

The admin dashboard runs on `http://localhost:3000`.

## Mobile setup

```bash
cd mobile
npm install
npm run dev
```

## Configuration notes

- Create local `.env` files from the provided `.env.example` templates.
- Keep secrets out of the repository.
- Match `CORS_ORIGIN` to the frontend origin used in your environment.

## Useful checks

```bash
curl http://localhost:3001/api/health
curl http://localhost:8000/health
```

## Troubleshooting

- If Prisma fails, rerun `npx prisma generate` after installing dependencies.
- If the frontend cannot call the backend, verify CORS and the backend port.
- If the AI service is unavailable, ensure the Python environment is activated and `uvicorn` started successfully.
