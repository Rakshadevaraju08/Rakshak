from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import os
import logging

from app.schemas.domain import (
    DisasterAnalysisRequest, 
    FullResponsePlan, 
    ReplanRequest, 
    ResponsePlanRevision
)
from app.agents.master_coordinator import MasterCoordinator
from app.errors import AgentError
from app.logging_config import setup_logging

# Initialize logging at module load
setup_logging()

logger = logging.getLogger("disaster.api")

app = FastAPI(
    title="AI Disaster Response Agent", 
    version="1.0.0",
    docs_url="/docs"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Security Headers Middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Cache-Control"] = "no-store"
    return response


# ---------------------------------------------------------------------------
# Global Exception Handlers — Never Expose Internal Details
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return field-level errors without internal stack traces or file paths."""
    safe_errors = []
    for err in exc.errors():
        safe_errors.append({
            "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
            "message": err.get("msg", "Invalid value"),
            "type": err.get("type", "value_error"),
        })
    logger.warning(f"Request validation failed: {len(safe_errors)} error(s)")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Request validation failed. Check the 'details' field for specifics.",
            "details": safe_errors,
        },
    )


@app.exception_handler(AgentError)
async def agent_error_handler(request: Request, exc: AgentError):
    """Handle structured agent errors without leaking internal detail."""
    logger.error(f"AgentError [{exc.source}] {exc.code.value}: {exc.warning_message}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": exc.code.value,
            "message": exc.warning_message,
            "source": exc.source,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all: log the real error, return a safe generic message."""
    logger.exception(f"Unhandled exception: {type(exc).__name__}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_ERROR",
            "message": "An unexpected error occurred during analysis. Please try again or contact support.",
        },
    )


# ---------------------------------------------------------------------------
# Initialize Coordinator
# ---------------------------------------------------------------------------

coordinator = MasterCoordinator(use_ml_risk=True)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

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
        logger.error(f"Critical analysis failure: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Analysis failed due to invalid or missing critical data. Check incident fields and try again."
        )
    except Exception as e:
        # Unexpected failures — log full detail, return safe message
        logger.exception(f"Unexpected error during analysis: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during analysis."
        )


@app.post("/api/ai/reanalyze", response_model=ResponsePlanRevision)
def reanalyze_disaster(request: ReplanRequest):
    """
    Re-analyzes an ongoing disaster with updated state, comparing it to the previous plan.
    Returns a ResponsePlanRevision with a precise diff of what changed.
    """
    try:
        revision = coordinator.reanalyze(
            updated_state=request.updated_state,
            previous_plan=request.previous_plan
        )
        return revision
    except RuntimeError as e:
        logger.error(f"Critical reanalysis failure: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reanalysis failed due to invalid or missing critical data. Check incident fields and try again."
        )
    except Exception as e:
        logger.exception(f"Unexpected error during reanalysis: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during reanalysis."
        )
