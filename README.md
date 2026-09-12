# DisasterLink

AI-assisted disaster-response coordination with an operator dashboard, citizen SOS reporting, an offline mesh workflow, an Express API, and a FastAPI agent service.

## Architecture

- `frontend/` — React/Vite operator and citizen UI.
- `backend/` — Express API with Prisma, MySQL, Redis, and dispatch orchestration.
- `ai-service/` — FastAPI six-agent service.
- `mobile/` — citizen mobile prototype.

## Start locally

```bash
docker-compose up -d
cd backend && npm install && npm run dev
```

The API runs on `http://localhost:3001`; its health endpoint is `GET /api/health`.

In another terminal:

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then start the UI:

```bash
cd frontend
npm install
npm run dev
```

Copy each relevant `.env.example` to `.env` and supply real credentials locally. Never commit secrets.
