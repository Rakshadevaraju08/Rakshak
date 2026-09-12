"""
Centralized error and warning taxonomy for the AI disaster response pipeline.

All agents and services use these types to produce structured, machine-readable
warnings that propagate to the API response without leaking internal details.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Any, Callable, List, Optional, Tuple, TypeVar
import logging

logger = logging.getLogger("disaster.errors")

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Warning Codes
# ---------------------------------------------------------------------------

class WarningCode(str, Enum):
    """Machine-readable codes attached to every pipeline warning."""
    OSRM_UNAVAILABLE = "OSRM_UNAVAILABLE"
    MODEL_FILE_MISSING = "MODEL_FILE_MISSING"
    MODEL_PREDICTION_FAILED = "MODEL_PREDICTION_FAILED"
    MISSING_ENVIRONMENT_DATA = "MISSING_ENVIRONMENT_DATA"
    MISSING_RESOURCES = "MISSING_RESOURCES"
    NO_AVAILABLE_RESOURCE = "NO_AVAILABLE_RESOURCE"
    NO_SUITABLE_RESOURCE = "NO_SUITABLE_RESOURCE"
    INVALID_COORDINATES = "INVALID_COORDINATES"
    MALFORMED_INPUT = "MALFORMED_INPUT"
    STALE_DATA = "STALE_DATA"
    DATA_CONFLICT = "DATA_CONFLICT"
    EMPTY_HOSPITAL_LIST = "EMPTY_HOSPITAL_LIST"
    INCOMPLETE_INCIDENT = "INCOMPLETE_INCIDENT"
    OPTIMIZATION_FAILURE = "OPTIMIZATION_FAILURE"
    PREDICTION_FAILURE = "PREDICTION_FAILURE"
    ROUTE_FAILURE = "ROUTE_FAILURE"
    SITUATION_FAILURE = "SITUATION_FAILURE"
    RISK_FAILURE = "RISK_FAILURE"
    RESOURCE_FAILURE = "RESOURCE_FAILURE"


# ---------------------------------------------------------------------------
# Structured Warning
# ---------------------------------------------------------------------------

@dataclass
class PipelineWarning:
    """
    A single structured warning emitted by an agent or service.

    Attributes:
        code:    Machine-readable WarningCode enum value.
        source:  Name of the agent / service that produced the warning.
        message: Human-readable summary safe for API clients.
        detail:  Optional internal detail for server-side logs only.
                 NEVER include this in API responses.
    """
    code: WarningCode
    source: str
    message: str
    detail: Optional[str] = None

    def log(self, level: int = logging.WARNING) -> None:
        """Log this warning through the central logger."""
        log_msg = f"[{self.source}] {self.code.value}: {self.message}"
        if self.detail:
            log_msg += f" | detail: {self.detail}"
        logger.log(level, log_msg)


# ---------------------------------------------------------------------------
# Agent Error
# ---------------------------------------------------------------------------

class AgentError(Exception):
    """
    Raised for hard/unrecoverable failures within an agent.

    Carries a WarningCode and source so the coordinator can produce
    a structured warning even for critical failures.
    """

    def __init__(self, code: WarningCode, source: str, message: str, detail: Optional[str] = None):
        self.code = code
        self.source = source
        self.warning_message = message
        self.detail = detail
        super().__init__(message)

    def to_warning(self) -> PipelineWarning:
        return PipelineWarning(
            code=self.code,
            source=self.source,
            message=self.warning_message,
            detail=self.detail,
        )


# ---------------------------------------------------------------------------
# Safe Execution Helper
# ---------------------------------------------------------------------------

def safe_execute(
    func: Callable[..., T],
    *args: Any,
    agent_name: str,
    failure_code: WarningCode,
    **kwargs: Any,
) -> Tuple[Optional[T], List[PipelineWarning]]:
    """
    Execute *func* and catch any exception, converting it to a PipelineWarning.

    Returns:
        (result, warnings) — result is None when the call failed.

    Usage::

        prediction, pred_warnings = safe_execute(
            self.predictive_agent.analyze,
            request, risk,
            agent_name="PredictiveAgent",
            failure_code=WarningCode.PREDICTION_FAILURE,
        )
    """
    warnings: List[PipelineWarning] = []
    try:
        result = func(*args, **kwargs)
        return result, warnings
    except AgentError as exc:
        warning = exc.to_warning()
        warning.log()
        warnings.append(warning)
        return None, warnings
    except Exception as exc:
        warning = PipelineWarning(
            code=failure_code,
            source=agent_name,
            message=f"{agent_name} failed: {type(exc).__name__}",
            detail=str(exc),
        )
        warning.log()
        warnings.append(warning)
        return None, warnings
