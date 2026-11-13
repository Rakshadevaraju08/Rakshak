# AI service

The AI service is the reasoning layer for Rakshak. It consumes incident context from the backend, validates data quality, scores risk, predicts worsening conditions, and generates a human-readable response plan that can be reviewed before dispatch.

## Responsibilities

The service is organized around a multi-agent pipeline:

- `situation_agent.py` validates the incident and identifies missing or risky context
- `data_quality_agent.py` checks completeness and reliability of incoming data
- `risk_agent.py` scores urgency and severity
- `predictive_agent.py` forecasts escalation or worsening conditions
- `resource_agent.py` matches response units to the incident
- `route_agent.py` estimates travel or routing viability
- `safety_checker.py` and `autonomy_decision_maker.py` validate whether the plan is safe to recommend
- `master_coordinator.py` orchestrates the full pipeline and assembles the final plan

## Application structure

```text
ai-service/
├── app/
│   ├── agents/
│   ├── config/
│   ├── errors.py
│   ├── logging_config.py
│   ├── main.py
│   ├── ml/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── utils/
├── config/
├── data/
├── demo/
├── docs/
├── scripts/
├── tests/
├── requirements.txt
├── pytest.ini
├── README.md
└── .env.example
```

## Entrypoint and API

The FastAPI application starts from `ai-service/app/main.py`.

Core endpoints:

- `GET /health` returns service health
- `POST /api/ai/analyze` runs the full analysis pipeline
- `POST /api/ai/reanalyze` compares the latest state to an earlier plan
- `POST /api/ai/predict-flood-risk` runs the standalone flood-risk model

The service exposes its interactive docs at `http://localhost:8000/docs`.

## Workflow

1. The backend sends a disaster analysis context to the AI service.
2. The pipeline validates data quality and missing fields.
3. Risk and predictive agents assess urgency and escalation.
4. Resource and route agents identify available teams and likely routing constraints.
5. Safety and autonomy checks validate the plan before handoff.
6. The `MasterCoordinator` builds a final response plan with trace data and warnings.

## Local setup

From a fresh clone:

```bash
cd ai-service
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

## Dependencies

The service relies on:

- FastAPI
- Uvicorn
- Pydantic / Pydantic Settings
- scikit-learn
- pandas
- numpy
- OR-Tools
- joblib
- requests
- PyYAML
- httpx

## Testing

Run the Python test suite:

```bash
cd ai-service
pytest
```

The project also includes focused tests for risk, predictive, fallback, and re-planning behavior in `ai-service/tests/`.

## Notes

- The service is intentionally human-in-the-loop: it produces recommendations, not autonomous dispatch decisions.
- AI outputs include structured reasoning, warnings, and trace metadata to support explainability.
- The model behavior is partly demonstrative and should be replaced with real incident data before production deployment.
