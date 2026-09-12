# TEAM TASKS AND RESPONSIBILITIES

## Member 1 — Backend + Database + Integration
**Responsibilities:**
- Set up Node.js, Express, Prisma, and MySQL.
- Implement REST API endpoints for frontend and mobile.
- Set up Redis for real-time pub/sub.
- Manage dispatch logic, hospital capacities, and resources.
- Integrate the Backend with the Python AI Service.
- Implement WebSockets for real-time dashboard updates.

**Dependencies:**
- Provides API to Frontend/Mobile.
- Triggers AI Service via Redis/REST.

## Member 2 — AI / Agents
**Responsibilities:**
- Develop the 6-agent architecture using Python and FastAPI.
- **Situation Agent:** Incident parsing.
- **Risk Agent:** Urgency scoring.
- **Resource Agent:** Asset matching.
- **Route Agent:** Routing algorithms (e.g., OSRM).
- **Predictive Agent:** Machine learning for risk forecasting (scikit-learn).
- **Master Coordinator:** Plan synthesis (OR-Tools).

**Dependencies:**
- Receives data from Backend API/Redis.
- Returns generated Response Plans to Backend.

## Member 3 — Frontend + Mobile + Offline Mesh
**Responsibilities:**
- Build React/Vite Frontend (Operator Dashboard, Maps).
- Build Mobile App (Citizen SOS, offline capabilities).
- Implement local storage (SQLite) on mobile.
- Research and implement multi-hop BLE store-and-forward mesh networking.
- *Note on Mobile/BLE:* Before choosing Expo Go vs native, verify if the BLE library requires a custom dev client or native configuration. Update this document with the findings.

**Dependencies:**
- Consumes Backend API.
- Offline mobile devices relay messages to an online Gateway device.
