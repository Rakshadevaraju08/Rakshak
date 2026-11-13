function createServiceError(message, status, code, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function isFullResponsePlan(value, incidentId) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.incident_id === incidentId &&
    typeof value.recommended_action === 'string' &&
    Array.isArray(value.assignments) &&
    Array.isArray(value.explanation) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.provenance) &&
    typeof value.overall_confidence === 'number' &&
    typeof value.human_review_required === 'boolean' &&
    typeof value.fallback_used === 'boolean' &&
    typeof value.degraded === 'boolean';
}

function messageFromErrorBody(body, status) {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const message = body.message || body.error || body.detail;
    if (typeof message === 'string') return message;
    if (message !== undefined) return JSON.stringify(message);
  }
  if (typeof body === 'string' && body.trim()) return body;
  return `AI service returned HTTP ${status}`;
}

async function requestAIAnalysis(context) {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw createServiceError(
      'AI_SERVICE_URL is not configured; analysis cannot be sent to the AI service.',
      503,
      'AI_SERVICE_UNAVAILABLE'
    );
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();
    let responseBody = null;
    if (responseText.trim()) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        if (response.ok) {
          throw createServiceError(
            'AI service returned a successful response that was not valid JSON.',
            502,
            'AI_SERVICE_INVALID_RESPONSE'
          );
        }
        responseBody = responseText;
      }
    }

    if (!response.ok) {
      const error = createServiceError(
        messageFromErrorBody(responseBody, response.status),
        response.status >= 500 ? 502 : response.status,
        response.status === 400 || response.status === 422
          ? 'AI_SERVICE_VALIDATION_ERROR'
          : 'AI_SERVICE_UPSTREAM_ERROR',
        responseBody
      );
      error.upstreamStatus = response.status;
      throw error;
    }

    if (!isFullResponsePlan(responseBody, context.incident.id)) {
      throw createServiceError(
        'AI service response did not match the expected FullResponsePlan contract.',
        502,
        'AI_SERVICE_INVALID_RESPONSE'
      );
    }

    return responseBody;
  } catch (error) {
    console.warn(`AI analysis failed: ${error.message}`);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw createServiceError('AI analysis timed out.', 504, 'AI_SERVICE_TIMEOUT');
    }

    if (error.code === 'AI_SERVICE_INVALID_RESPONSE' || error.status) {
      throw error;
    }

    throw createServiceError(
      `AI service is unavailable: ${error.message}`,
      503,
      'AI_SERVICE_UNAVAILABLE'
    );
  }
}

module.exports = { requestAIAnalysis };
