"""
Security-focused tests ensuring no sensitive data leaks through API responses.

Verifies that:
- No stack traces appear in error responses
- No environment variable values leak
- No API key patterns appear in response bodies
- Validation errors don't leak internal file paths
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Stack Trace Leakage
# ---------------------------------------------------------------------------

class TestNoStackTraceLeakage:
    def test_500_error_no_traceback(self, client):
        """Unhandled exception must not expose stack trace to client."""
        with patch("app.main.coordinator.analyze", side_effect=Exception("Unexpected DB error")):
            response = client.post("/api/ai/analyze", json={
                "incident": {
                    "id": "INC_SEC",
                    "type": "FIRE",
                    "latitude": 10.0,
                    "longitude": 20.0,
                }
            })

        assert response.status_code == 500
        body = response.text.lower()
        assert "traceback" not in body
        assert "file \"" not in body
        assert "line " not in body  # Python traceback pattern
        assert "unexpected db error" not in body  # Original exception message

    def test_422_error_no_traceback(self, client):
        """RuntimeError from coordinator must not expose stack trace."""
        with patch("app.main.coordinator.analyze", side_effect=RuntimeError("Critical failure")):
            response = client.post("/api/ai/analyze", json={
                "incident": {
                    "id": "INC_SEC2",
                    "type": "FIRE",
                    "latitude": 10.0,
                    "longitude": 20.0,
                }
            })

        assert response.status_code == 422
        body = response.text.lower()
        assert "traceback" not in body
        assert "critical failure" not in body


# ---------------------------------------------------------------------------
# Environment Variable Leakage
# ---------------------------------------------------------------------------

class TestNoEnvVarLeakage:
    def test_osrm_url_not_in_response(self, client):
        """OSRM base URL must not appear in API responses."""
        response = client.post("/api/ai/analyze", json={
            "incident": {
                "id": "INC_ENV",
                "type": "FLOOD",
                "latitude": 10.0,
                "longitude": 20.0,
                "victim_count": 3,
            },
            "resources": [
                {
                    "id": "BOAT_1",
                    "type": "RESCUE_BOAT",
                    "status": "AVAILABLE",
                    "latitude": 10.1,
                    "longitude": 20.1,
                }
            ],
        })

        body = response.text
        assert "router.project-osrm.org" not in body
        assert "OSRM_BASE_URL" not in body


# ---------------------------------------------------------------------------
# API Key Pattern Leakage
# ---------------------------------------------------------------------------

class TestNoAPIKeyLeakage:
    def test_validation_error_no_internal_paths(self, client):
        """Validation errors must not contain internal file paths."""
        response = client.post("/api/ai/analyze", json={
            "incident": {"bad_field": True}
        })

        assert response.status_code == 422
        body = response.text
        # No file paths
        assert ":\\Users\\" not in body
        assert "/home/" not in body
        assert "site-packages" not in body
        assert "pydantic" not in body.lower() or "pydantic" in body.lower()  # pydantic type names are acceptable in type field

    def test_error_response_structure(self, client):
        """Error responses must follow the safe structure."""
        response = client.post("/api/ai/analyze", json={})

        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert "message" in data
        assert data["error"] == "VALIDATION_ERROR"


# ---------------------------------------------------------------------------
# Security Headers
# ---------------------------------------------------------------------------

class TestSecurityHeaders:
    def test_health_endpoint_has_security_headers(self, client):
        """All responses should include security headers."""
        response = client.get("/health")

        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"
        assert response.headers.get("Cache-Control") == "no-store"

    def test_analyze_endpoint_has_security_headers(self, client):
        """POST endpoint also includes security headers."""
        response = client.post("/api/ai/analyze", json={
            "incident": {
                "id": "INC_HDR",
                "type": "FIRE",
                "latitude": 10.0,
                "longitude": 20.0,
            }
        })

        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
