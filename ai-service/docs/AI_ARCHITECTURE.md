# AI Architecture

## 1. Pipeline Architecture

The AI Service processes incidents through a strictly orchestrated pipeline:

```text
Node Backend
     ↓ (HTTP / Events)
FastAPI (Input Validation via Pydantic)
     ↓
Master Coordinator
     ↓
  [ Agents ]
   ├── 1. Situation Agent (Validates and normalizes payload)
   ├── 2. Risk Agent (Determines priority / incident severity)
   ├── 3. Predictive Agent (Forecasts future escalation)
   ├── 4. Resource Agent (Optimizes and assigns rescue units)
   └── 5. Route Agent (Determines road-network ETA and paths)
     ↓
Master Coordinator (Aggregates results, resolves conflicts)
     ↓
Full Response Plan
```

The `MasterCoordinator` sequentially triggers the agents. However, some agents are strict dependencies, while others are optional.

## 2. Adaptive Re-planning

Disasters are dynamic. When the environment or the incident severity changes, the AI must adapt.

1. **Updated State Reception**: The backend sends a new snapshot of the situation (e.g., increased victim count, rising water levels).
2. **Re-Analysis**: The `MasterCoordinator` runs the entire pipeline again against the new snapshot.
3. **Plan Diffing**: The `plan_diff.py` utility strictly compares the old plan to the newly generated plan.
4. **Actionable Revisions**: If the diff identifies significant changes (e.g., priority escalated, new resources assigned), it produces a `ResponsePlanRevision` highlighting the exact deltas, allowing human operators to quickly understand what changed rather than reading a brand new plan from scratch.

## 3. Failure Handling & Degradation

The pipeline is designed to be highly fault-tolerant. Missing data or external service failures will **not** crash the pipeline; instead, the system gracefully degrades.

- **Missing Non-Critical Data**: If non-critical data (like weather or hospital lists) is omitted, the `SituationAgent` logs a structured `PipelineWarning` and continues processing with a lower confidence score.
- **External Service Failure (OSRM)**: If the OSRM routing server times out or goes offline, the `RouteAgent` catches the failure, logs an `OSRM_UNAVAILABLE` warning, and seamlessly falls back to calculating straight-line (Euclidean) distance estimates at 60km/h.
- **ML Model Failure**: If the `PredictiveAgent` or `RiskAgent` fails to load a `joblib` file, or encounters an unexpected feature mismatch, they log a `MODEL_PREDICTION_FAILED` warning and fall back to transparent, rule-based heuristics.
- **Optimization Failure**: If Google OR-Tools fails to find a valid solution, the `ResourceAgent` safely returns an empty assignment list with unfulfilled requirements highlighted.

All failures are aggregated by the `MasterCoordinator` into a `warnings` array within the final `FullResponsePlan`, ensuring the human operator is fully aware that the plan was generated under degraded conditions.
