# AI Disaster Response Coordination Agent

An AI-powered disaster response coordination system designed to assist operators in understanding incidents, prioritizing victims, allocating resources, and coordinating a response.

## Problem
During major disasters, incoming reports overwhelm operators, leading to delayed responses, misallocation of resources, and routing failures due to dynamic environment changes (e.g., blocked roads, full hospitals). Additionally, infrastructure failures often leave citizens without communication means.

## Solution
This system uses a six-agent AI architecture to automatically parse incident reports, assess risks, assign resources, and plan optimal routes. The system continuously adapts to changing conditions and relies on human-in-the-loop approval. It also includes an offline-first mesh network for citizen SOS reporting in areas without internet access.

## Architecture
The system consists of:
- **Frontend:** React/Vite web application for operators.
- **Mobile App:** For citizens to send SOS (supports offline mesh).
- **Backend:** Node.js/Express service orchestrating events.
- **AI Service:** Python/FastAPI service hosting the 6-agent architecture.
- **Data Layer:** MySQL (Prisma) for operational data and Redis for real-time events.

## Tech Stack
- Frontend: React, Vite, TailwindCSS (Planned)
- Backend: Node.js, Express, Prisma, MySQL, Redis
- AI Service: Python, FastAPI, scikit-learn, OR-Tools
- Mobile: React Native/Expo (Planned)

## Repository Structure
```
├── frontend/      # React operator dashboard
├── mobile/        # Mobile application (Offline SOS)
├── backend/       # Node.js API server
├── ai-service/    # Python AI agents
├── data/          # Placeholders for datasets
└── docs/          # Project documentation
```

## How to Start Services

### Infrastructure (MySQL, Redis)
```bash
docker-compose up -d
```
*(If you prefer local installations, ensure MySQL and Redis are running locally.)*

### Backend
```bash
cd backend
npm install
# Configure .env
npm run dev
```
Health Check: `GET http://localhost:3000/api/health`

### AI Service
```bash
cd ai-service
# Activate virtual environment
# Windows: .\venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Health Check: `GET http://localhost:8000/health`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Database Setup
1. Configure `DATABASE_URL` in `backend/.env`.
2. Run Prisma migrations (when schema is final):
```bash
cd backend
npx prisma db push
# or npx prisma migrate dev
```

## Environment Variables
Refer to `.env.example` in each respective folder (`backend`, `frontend`, `ai-service`, `mobile`). **Never commit real credentials.**

## Team Responsibilities
- **Member 1:** Backend + Database + Integration
- **Member 2:** AI Agents + Prediction + Optimization
- **Member 3:** Frontend + Mobile + Offline Mesh
*(See `docs/TEAM_TASKS.md` for full details)*

## Implementation Status
- **Implemented:**
  - Initial repository structure
  - Backend skeleton (Express, Prisma schema, Health route)
  - AI Service skeleton (FastAPI, agent placeholders, Health route)
  - Frontend skeleton (Vite/React, placeholder components)
  - Core Documentation (`SYSTEM_DESIGN.md`, `API.md`, `DATABASE.md`, etc.)
- **In Progress:**
  - Team onboarding and environment setup
- **Planned:**
  - Database migrations
  - Full API development
  - 6-Agent AI logic
  - React Native Mobile App
  - Offline BLE Mesh
