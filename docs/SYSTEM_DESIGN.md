# SYSTEM DESIGN

## 1. Problem Definition
The system coordinates disaster response by gathering incident reports, evaluating risks, allocating resources (ambulances, rescue teams), routing them optimally, and predicting where situations will worsen, all while maintaining offline capabilities for citizens in affected areas.

## 2. System Architecture
```
Citizen / Operator
        ↓
Frontend / Mobile
        ↓
Node.js + Express
        ↓
 ┌───────────────┐
 │ MySQL         │
 │ Redis         │
 └───────────────┘
        ↓
   AI Service
        ↓
 ┌───────────────────────┐
 │ Situation Agent       │
 │ Risk Agent            │
 │ Resource Agent        │
 │ Route Agent           │
 │ Predictive Agent      │
 │ Master Coordinator    │
 └───────────────────────┘
        ↓
Response Plan
        ↓
Human Approval
        ↓
Dispatch / Re-planning
```

## 3. Data Flow
1. Incident is reported via Frontend/Mobile.
2. Backend stores to MySQL and publishes to Redis.
3. AI Service consumes the event and triggers agents.
4. AI generates a Response Plan.
5. Plan is presented on Frontend for Operator approval.

## 4. Six-Agent Architecture
1. **Situation Agent** — Parses text/images to understand what is happening.
2. **Risk Agent** — Assesses urgency and assigns priority.
3. **Resource Agent** — Selects appropriate resources (ambulances, teams).
4. **Route Agent** — Calculates optimal routes considering blocked roads.
5. **Predictive Agent** — Forecasts worsening conditions based on weather/water levels.
6. **Master Coordinator** — Synthesizes outputs into an actionable Response Plan.

## 5. Offline Communication Architecture
```
Citizen Phone
      ↓
SQLite
      ↓
BLE
      ↓
Relay Phone
      ↓
Gateway Phone
      ↓
Backend
      ↓
AI Pipeline
```

## 6. Database Layer
MySQL for relational data (Incidents, Resources, Hospitals, Roads).
Prisma as ORM.

## 7. Real-Time/Event Layer
Redis for pub/sub, real-time updates, and asynchronous job queuing between Backend and AI Service.

## 8. Human-in-the-Loop
AI creates dispatch plans but a human operator must review and approve them before execution to ensure safety.

## 9. Adaptive Re-planning
If a dispatched route becomes blocked or a hospital becomes full, the system automatically triggers a re-planning event to adjust the response.

## 10. Self-Learning
Outcomes are logged to evaluate the AI's decisions, forming a dataset for future improvements.
