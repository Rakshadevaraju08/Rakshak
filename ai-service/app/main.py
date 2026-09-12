from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

from app.schemas.domain import DisasterAnalysisRequest, FullResponsePlan
from app.agents.master_coordinator import MasterCoordinator

app = FastAPI(
    title="AI Disaster Response Agent", 
    version="1.0.0",
    docs_url="/docs"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Coordinator once (can be injected via dependency injection if scaling)
coordinator = MasterCoordinator(use_ml_risk=True)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "disaster-response-ai"
    }

@app.post("/api/ai/analyze", response_model=FullResponsePlan)
def analyze_disaster(request: DisasterAnalysisRequest):
    """
    Analyzes an incoming disaster situation and produces a full response plan.
    Connects Situation, Risk, Predictive, Resource, and Route agents.
    """
    try:
        plan = coordinator.analyze(request)
        return plan
    except RuntimeError as e:
        # Expected strict dependency failures
        logging.error(f"Critical analysis failure: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Analysis failed due to invalid or missing critical data: {e}"
        )
    except Exception as e:
        # Unexpected failures
        logging.exception(f"Unexpected error during analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during analysis."
        )
