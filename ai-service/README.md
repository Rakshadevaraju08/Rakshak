# AI Disaster Response Service

The AI Service is the central intelligence hub of the Disaster Response ecosystem. It receives normalized incident data from the Node Backend, enriches it, predicts risks, and orchestrates an actionable **Full Response Plan** using an ecosystem of specialized AI Agents.

## 1. Human-in-the-Loop Philosophy

The AI Service operates strictly under a **Human-in-the-Loop** model to ensure safety and accountability:

1. **AI Recommends**: The AI Service aggregates complex, multi-modal data and proposes a comprehensive response plan.
2. **Human Approves**: Emergency dispatchers and operators review the plan, explanations, and risk assessments through the Command Center UI.
3. **Backend Executes**: Once a human authorizes the plan, the central Node Backend executes the dispatch instructions.

The AI cannot self-dispatch emergency resources without human authorization.

## 2. Explainability

Trust is critical in emergency response. Every AI decision is fully explainable.
- The `RiskResult` contains a `reasons` list detailing exactly why a priority score was assigned.
- The `ResourceAssignment` contains a `reasons` list detailing why a specific resource was chosen.
- The final `FullResponsePlan` generates a human-readable `explanation` aggregating all agent conclusions.
Operators are never presented with a "black box" recommendation; they always see the exact logic that led to the plan.

## 3. Technology Stack

We deliberately selected a modern, robust, and lightweight Python stack tailored for specialized AI integration, rather than relying exclusively on LLMs.

- **Python**: The industry standard for Data Science, ML, and AI integration. Provides the richest ecosystem for routing, optimization, and machine learning.
- **FastAPI**: A high-performance async web framework. We chose FastAPI for its native Pydantic integration, auto-generated OpenAPI docs, and asynchronous capabilities, which are crucial for concurrent event handling.
- **Pydantic**: Provides robust, type-safe data validation. Ensures that incoming JSON payloads from the Node backend perfectly match our strongly-typed domain models before any agent processing occurs.
- **scikit-learn**: Used for our predictive ML baseline models. It's lightweight, predictable, and doesn't require massive GPU clusters like deep learning models.
- **Pandas / NumPy**: The foundational libraries for data manipulation and numerical feature processing during model inference.
- **Google OR-Tools**: A powerful optimization solver. Used by the Resource Agent to solve complex, multi-variable assignment problems (e.g., matching the closest capable ambulances to incidents while minimizing overall travel distance).
- **OSRM (Open Source Routing Machine)**: Used by the Route Agent to provide highly accurate, road-network-aware ETAs and driving directions, rather than relying on inaccurate straight-line distances.
- **Joblib**: Used for efficient serialization and deserialization of scikit-learn models and their associated metadata.
- **pytest**: The standard for Python testing. We maintain a comprehensive test suite (110+ tests) to guarantee the reliability of critical path operations.

## 4. Documentation Map

- [AI Architecture](docs/AI_ARCHITECTURE.md) - Pipeline flow and failure handling.
- [AI Agents & ML](docs/AI_AGENTS.md) - Detailed breakdown of each specialized agent and Machine Learning models.
- [AI API](docs/AI_API.md) - Endpoints and JSON payload examples.
