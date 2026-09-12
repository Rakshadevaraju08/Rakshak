"""
Centralized logging configuration for the AI disaster response service.

Provides structured logging with a sanitization filter that redacts
sensitive patterns (API keys, passwords, tokens, connection strings)
before they reach any log handler.
"""

import logging
import re
import sys


# ---------------------------------------------------------------------------
# Sensitive data patterns to redact
# ---------------------------------------------------------------------------

_SENSITIVE_PATTERNS = [
    # Generic key=value for common secret names
    re.compile(
        r'(?i)(api[_-]?key|secret|password|passwd|token|authorization|credentials|'
        r'db[_-]?password|database[_-]?url|connection[_-]?string|private[_-]?key)'
        r'\s*[=:]\s*\S+',
    ),
    # Bearer tokens in headers
    re.compile(r'(?i)bearer\s+[a-zA-Z0-9\-_\.]+'),
    # Long hex/base64 strings that look like keys (40+ chars)
    re.compile(r'(?<![a-zA-Z0-9])[a-fA-F0-9]{40,}(?![a-zA-Z0-9])'),
]

_REDACTED = "[REDACTED]"


def _sanitize(message: str) -> str:
    """Replace sensitive patterns in *message* with [REDACTED]."""
    for pattern in _SENSITIVE_PATTERNS:
        message = pattern.sub(_REDACTED, message)
    return message


# ---------------------------------------------------------------------------
# Sanitization Filter
# ---------------------------------------------------------------------------

class SanitizationFilter(logging.Filter):
    """Logging filter that scrubs sensitive data from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _sanitize(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: _sanitize(str(v)) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(_sanitize(str(a)) if isinstance(a, str) else a for a in record.args)
        return True


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def setup_logging(level: int = logging.INFO) -> None:
    """
    Configure logging for the disaster response service.

    Call once at application startup (e.g. FastAPI lifespan event).
    """
    root_logger = logging.getLogger()

    # Avoid duplicate handlers on repeated calls (e.g. tests)
    if root_logger.handlers:
        return

    root_logger.setLevel(level)

    # Console handler with structured format
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    # Attach sanitization filter
    sanitization_filter = SanitizationFilter()
    handler.addFilter(sanitization_filter)

    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

import json

class AuditLogger:
    """Writes structured JSON traces of pipeline execution for SIEM/Audit logging."""
    @staticmethod
    def log_plan(plan: 'FullResponsePlan') -> None:
        audit_data = {
            "type": "AUDIT_TRAIL",
            "incident_id": plan.incident_id,
            "recommended_action": plan.recommended_action.value,
            "degraded": plan.degraded,
            "human_approval_required": plan.autonomy_decision.human_review_required if plan.autonomy_decision else True,
            "warnings_count": len(plan.warnings)
        }
        
        context = getattr(plan, '_pipeline_context', None)
        if context:
            if context.situation:
                audit_data["situation_confidence"] = context.situation.confidence_score
            if context.risk:
                audit_data["risk_confidence"] = context.risk.confidence
            if context.prediction:
                audit_data["prediction_confidence"] = context.prediction.confidence
            if context.request and context.request.incident:
                audit_data["data_source"] = getattr(context.request.incident, 'source', 'SYSTEM')
                
        # Log as structured JSON
        logging.getLogger("disaster.audit").info(json.dumps(audit_data))
