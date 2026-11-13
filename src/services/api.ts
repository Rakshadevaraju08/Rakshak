export type Incident = {
  id: string;
  title: string;
  type?: string | null;
  status?: string | null;
  createdAt?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  victimCount?: number | null;
  elderlyCount?: number | null;
  childrenCount?: number | null;
  disabledCount?: number | null;
  description?: string | null;
};

export type JsonRecord = Record<string, unknown>;

export interface PipelineTraceStep extends JsonRecord {
  step_name?: string;
  agent_name?: string;
  status?: string;
  execution_time_ms?: number | null;
  fallback_used?: boolean;
  warnings?: unknown[];
  errors?: unknown[];
}

export interface FullResponsePlan extends JsonRecord {
  incident_id: string;
  data_quality?: JsonRecord | null;
  situation?: JsonRecord | null;
  risk?: JsonRecord | null;
  prediction?: JsonRecord | null;
  resource_agent_result?: JsonRecord | null;
  assignments: JsonRecord[];
  recommended_action: string;
  explanation: string[];
  warnings: unknown[];
  degraded: boolean;
  safety_check?: JsonRecord | null;
  autonomy_decision?: JsonRecord | null;
  overall_confidence: number;
  trace_id?: string | null;
  human_review_required: boolean;
  fallback_used: boolean;
  provenance: unknown[];
  trace?: (JsonRecord & {
    trace_id?: string;
    total_execution_time_ms?: number | null;
    steps?: PipelineTraceStep[];
  }) | null;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '');

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null | undefined {
  if (typeof value === 'string') return value;
  if (value === null) return null;
  return undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null) return null;
  return undefined;
}

function errorText(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (!isJsonRecord(payload)) return null;

  const message = optionalString(payload.message) ?? optionalString(payload.error) ?? optionalString(payload.detail);
  const details = payload.details;
  if (message && details !== undefined) return `${message}: ${JSON.stringify(details)}`;
  if (message) return message;
  if (details !== undefined) return JSON.stringify(details);
  return null;
}

async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    const reason = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Could not reach the backend at ${API_BASE_URL}${reason}`);
  }

  const bodyText = await response.text();
  let payload: unknown = null;
  if (bodyText.trim()) {
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = bodyText;
    }
  }

  if (!response.ok) {
    throw new ApiRequestError(
      errorText(payload) ?? `Backend request failed with HTTP ${response.status}`,
      response.status,
    );
  }

  if (bodyText.trim() && typeof payload === 'string') {
    throw new Error('The backend returned a non-JSON response.');
  }

  return payload;
}

export async function fetchIncidents(signal?: AbortSignal): Promise<Incident[]> {
  const payload = await requestJson('/incidents', { signal });
  if (!Array.isArray(payload)) {
    throw new Error('The backend returned an unexpected incident list.');
  }

  return payload.map((value, index) => {
    if (!isJsonRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
      throw new Error(`The backend returned an invalid incident at position ${index + 1}.`);
    }

    return {
      id: value.id,
      title: value.title,
      type: optionalString(value.type),
      status: optionalString(value.status),
      createdAt: optionalString(value.createdAt),
      locationLat: optionalNumber(value.locationLat),
      locationLng: optionalNumber(value.locationLng),
      victimCount: optionalNumber(value.victimCount),
      elderlyCount: optionalNumber(value.elderlyCount),
      childrenCount: optionalNumber(value.childrenCount),
      disabledCount: optionalNumber(value.disabledCount),
      description: optionalString(value.description),
    };
  });
}

function isFullResponsePlan(value: unknown): value is FullResponsePlan {
  return isJsonRecord(value)
    && typeof value.incident_id === 'string'
    && typeof value.recommended_action === 'string'
    && Array.isArray(value.assignments)
    && Array.isArray(value.explanation)
    && Array.isArray(value.warnings)
    && Array.isArray(value.provenance)
    && typeof value.overall_confidence === 'number'
    && typeof value.human_review_required === 'boolean'
    && typeof value.fallback_used === 'boolean'
    && typeof value.degraded === 'boolean';
}

export async function analyzeIncident(incidentId: string): Promise<FullResponsePlan> {
  const payload = await requestJson(`/incidents/${encodeURIComponent(incidentId)}/analyze`, {
    method: 'POST',
  });

  if (!isFullResponsePlan(payload) || payload.incident_id !== incidentId) {
    throw new Error('The backend returned an unexpected FullResponsePlan response.');
  }

  return payload;
}
