# AI Agents & Machine Learning

## 1. Master Coordinator
- **Purpose**: Orchestrates the entire pipeline, handles dependency failures gracefully, and aggregates individual agent findings into a cohesive plan.
- **Input**: `DisasterAnalysisRequest` from the API.
- **Processing**: Calls agents sequentially. Captures and deduplicates warnings. Calculates the final `RecommendedAction` based on risk and predictive escalation.
- **Technology**: Pure Python.
- **Output**: `FullResponsePlan` containing all sub-agent results.
- **Limitations**: Synchronous sequential execution; currently does not run non-dependent agents in parallel async tasks.

## 2. Situation Agent
- **Purpose**: The first line of defense. Validates inputs, normalizes formats, and constructs a baseline understanding of the situation.
- **Input**: Raw `DisasterAnalysisRequest`.
- **Processing**: Cross-checks victim counts, checks for missing environmental context, assesses vulnerable population impact.
- **Technology**: Pure Python / Pydantic.
- **Output**: `SituationResult` with a baseline confidence score and missing info list.
- **Limitations**: Rule-based logic; does not use NLP to parse unstructured text (yet).

## 3. Risk Agent
- **Purpose**: Determines the immediate severity and priority of an incident.
- **Input**: Incident data.
- **Processing**: Runs the incident features through a Machine Learning model. If unavailable, falls back to a deterministic scoring matrix (victims, water level, etc.).
- **Technology**: `scikit-learn` Random Forest (primary), Python heuristics (fallback).
- **Output**: `RiskResult` (Priority 1-5, RiskLevel, Score).
- **Limitations**: The underlying ML model is currently trained on synthetic data.

## 4. Predictive Agent
- **Purpose**: Forecasts near-future escalations (e.g., will this flood worsen in the next 30 minutes?).
- **Input**: Incident and Environment data.
- **Processing**: Extracts rainfall, trend, and elevation features, and runs them through a flood risk predictive model.
- **Technology**: `scikit-learn` Random Forest.
- **Output**: `PredictiveResult` highlighting whether the risk is escalating.
- **Limitations**: Environmental features are limited to coarse approximations (e.g., straight-line rainfall). Lacks high-resolution hydrodynamic simulation capabilities.

## 5. Resource Agent
- **Purpose**: Matches available emergency units to the incident.
- **Input**: The incident, risk priority, and a list of available resources.
- **Processing**: Formulates an assignment problem optimizing for distance and capability using a linear solver.
- **Technology**: Google OR-Tools.
- **Output**: List of `ResourceAssignment`s and unfulfilled requirements.
- **Limitations**: Currently optimizes purely on Euclidean distance prior to OSRM routing; does not account for complex shift-scheduling.

## 6. Route Agent
- **Purpose**: Determines the fastest road network path for assigned resources.
- **Input**: Origin coordinates (resource) and Destination coordinates (incident).
- **Processing**: Calls an external routing engine via HTTP.
- **Technology**: Open Source Routing Machine (OSRM) HTTP API.
- **Output**: `RouteResult` with ETAs and Waypoints.
- **Limitations**: Does not currently support dynamic re-routing around dynamically blocked polygon areas without pre-compiled graph updates.

---

## Machine Learning Implementation

The AI Service employs reusable Machine Learning workflows via `app/ml`.

- **Training**: Managed via `scripts/train_predictive_model.py` and `scripts/train_risk_model.py`.
- **Features**: Handled centrally in `app/ml/features.py` ensuring exact parity between training scripts and FastApi inference.
- **Models**: We use `scikit-learn` `RandomForestClassifier`s due to their interpretability, feature-importance capabilities, and low latency.
- **Evaluation**: Standard classification metrics (Accuracy, F1, Recall) are computed during training.
- **Limitations (DEMO STATUS)**: Due to a lack of true historical dispatch data, the current `.joblib` models are explicitly marked as `is_demo_model: true` in their `app/models/*_meta.json` counterparts. They are trained on synthetically generated rule-based labels and serve as architectural prototypes. Production deployment requires swapping these files out for models trained on real data.
