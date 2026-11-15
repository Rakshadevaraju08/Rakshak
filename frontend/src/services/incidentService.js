/**
 * Incident Service Module (frontend workspace adaptation)
 * Mirrors the canonical root src/services/incidentService implementation.
 */

export const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? String(import.meta.env.VITE_API_URL)
    : 'http://localhost:3001/api'
).replace(/\/+$/, '');

const DEFAULT_TIMEOUT_MS = 15000;

export class ApiRequestError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }
}

export function isJsonRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStoredAuthToken() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return (
      localStorage.getItem('rakshak_token') ||
      localStorage.getItem('disasterlink_token') ||
      localStorage.getItem('token')
    );
  } catch {
    return null;
  }
}

export function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isIsoOrFormatted =
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed) ||
      /^[A-Z][a-z]{2}\s+\d{1,2}/i.test(trimmed) ||
      /^\d{10,16}$/.test(trimmed);
    if (!isIsoOrFormatted) {
      return null;
    }
  }

  const date = value instanceof Date
    ? value
    : new Date(typeof value === 'string' && /^\d{10,16}$/.test(value.trim()) ? Number(value.trim()) : String(value));

  const time = date.getTime();
  if (Number.isNaN(time)) return null;

  const year = date.getUTCFullYear();
  if (year < 1970 || year > 2100) return null;

  return date.toISOString();
}

export function normalizeIncident(raw) {
  if (!isJsonRecord(raw)) {
    console.warn('[incidentService] Cannot normalize non-object incident payload:', raw);
    return null;
  }

  const rawId = raw.id;
  if (rawId === null || rawId === undefined || String(rawId).trim() === '') {
    console.warn('[incidentService] Skipping incident record missing a usable ID:', raw);
    return null;
  }

  const id = String(rawId).trim();
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled Emergency';
  const description = typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : null;

  let status = 'UNKNOWN';
  if (typeof raw.status === 'string') {
    const s = raw.status.trim().toUpperCase();
    if (s === 'NEW' || s === 'ACTIVE' || s === 'RESOLVED') status = s;
  }

  let priority = 'UNKNOWN';
  if (typeof raw.priority === 'string') {
    const p = raw.priority.trim().toUpperCase();
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(p)) priority = p;
  } else if (Array.isArray(raw.predictions) && raw.predictions.length > 0) {
    const risk = Number(raw.predictions[0]?.predictedRisk);
    if (Number.isFinite(risk)) {
      if (risk >= 80) priority = 'CRITICAL';
      else if (risk >= 60) priority = 'HIGH';
      else if (risk >= 35) priority = 'MEDIUM';
      else priority = 'LOW';
    }
  }

  let type = 'UNKNOWN';
  if (typeof raw.type === 'string' && raw.type.trim()) {
    const t = raw.type.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (['ACCIDENT', 'ROAD_ACCIDENT', 'TRAFFIC_ACCIDENT'].includes(t)) type = 'LOCALIZED_ACCIDENT';
    else if (t === 'LAND_SLIDE') type = 'LANDSLIDE';
    else type = t;
  }

  const createdAt = parseTimestamp(raw.createdAt);
  const updatedAt = parseTimestamp(raw.updatedAt);
  const timestamp = createdAt;

  const lat = typeof raw.locationLat === 'number' && raw.locationLat >= -90 && raw.locationLat <= 90 ? raw.locationLat : null;
  const lng = typeof raw.locationLng === 'number' && raw.locationLng >= -180 && raw.locationLng <= 180 ? raw.locationLng : null;
  const location = lat !== null && lng !== null ? { lat, lng } : null;

  const victimCount = Number.isSafeInteger(raw.victimCount) && raw.victimCount >= 0 ? raw.victimCount : null;
  const elderlyCount = Number.isSafeInteger(raw.elderlyCount) && raw.elderlyCount >= 0 ? raw.elderlyCount : null;
  const childrenCount = Number.isSafeInteger(raw.childrenCount) && raw.childrenCount >= 0 ? raw.childrenCount : null;
  const disabledCount = Number.isSafeInteger(raw.disabledCount) && raw.disabledCount >= 0 ? raw.disabledCount : null;

  const reports = Array.isArray(raw.reports)
    ? raw.reports
        .filter(isJsonRecord)
        .map((r, idx) => ({
          id: typeof r.id === 'string' ? r.id : `r-${idx + 1}`,
          content: typeof r.content === 'string' ? r.content : '',
          createdAt: parseTimestamp(r.createdAt) || new Date().toISOString(),
          incidentId: typeof r.incidentId === 'string' ? r.incidentId : id,
        }))
    : [];

  const predictions = Array.isArray(raw.predictions)
    ? raw.predictions
        .filter(isJsonRecord)
        .map((p, idx) => ({
          id: typeof p.id === 'string' ? p.id : `p-${idx + 1}`,
          predictedRisk: Number(p.predictedRisk) || 0,
          predictedWorsening: Boolean(p.predictedWorsening),
          timestamp: parseTimestamp(p.timestamp) || new Date().toISOString(),
          incidentId: typeof p.incidentId === 'string' ? p.incidentId : id,
        }))
    : [];

  const dispatchPlans = Array.isArray(raw.dispatchPlans)
    ? raw.dispatchPlans
        .filter(isJsonRecord)
        .map((dp, idx) => ({
          id: typeof dp.id === 'string' ? dp.id : `dp-${idx + 1}`,
          status: typeof dp.status === 'string' ? dp.status : 'PENDING',
          details: dp.details,
          createdAt: parseTimestamp(dp.createdAt) || new Date().toISOString(),
          updatedAt: parseTimestamp(dp.updatedAt) || new Date().toISOString(),
          incidentId: typeof dp.incidentId === 'string' ? dp.incidentId : id,
        }))
    : [];

  const updates = [];
  if (createdAt) {
    updates.push({
      id: 'init',
      type: 'STATUS_CHANGE',
      title: 'Incident Logged',
      content: 'Emergency incident record was registered in the operations queue.',
      timestamp: createdAt,
    });
  }
  for (const r of reports) {
    updates.push({
      id: `report-${r.id}`,
      type: 'REPORT',
      title: 'Situation Report',
      content: r.content,
      timestamp: r.createdAt,
    });
  }
  for (const dp of dispatchPlans) {
    updates.push({
      id: `dispatch-${dp.id}`,
      type: 'DISPATCH',
      title: `Dispatch Plan (${dp.status})`,
      content: `Response plan generated with status ${dp.status}.`,
      timestamp: dp.createdAt,
    });
  }
  updates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    id,
    title,
    type,
    status,
    priority,
    timestamp,
    createdAt,
    updatedAt,
    description,
    locationLat: lat,
    locationLng: lng,
    location,
    victimCount,
    elderlyCount,
    childrenCount,
    disabledCount,
    victimInformation: {
      total: victimCount,
      elderly: elderlyCount,
      children: childrenCount,
      disabled: disabledCount,
    },
    waterLevel: typeof raw.waterLevel === 'number' ? raw.waterLevel : null,
    rainfall: typeof raw.rainfall === 'number' ? raw.rainfall : null,
    roadAccess: typeof raw.roadAccess === 'string' ? raw.roadAccess : null,
    reporterId: typeof raw.reporterId === 'string' ? raw.reporterId : null,
    reports,
    predictions,
    dispatchPlans,
    updates,
  };
}

export function normalizeIncidentList(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (isJsonRecord(raw)) {
    if (Array.isArray(raw.incidents)) list = raw.incidents;
    else if (Array.isArray(raw.data)) list = raw.data;
    else if (Array.isArray(raw.items)) list = raw.items;
    else {
      console.warn('[incidentService] Received non-array incident response:', raw);
      return [];
    }
  } else {
    console.warn('[incidentService] Received non-array incident response:', typeof raw);
    return [];
  }

  const result = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const normalized = normalizeIncident(item);
    if (normalized) result.push(normalized);
  }
  return result;
}

async function requestApi(endpoint, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers: customHeaders, ...fetchInit } = options;
  const token = getStoredAuthToken();

  const headers = new Headers(customHeaders || {});
  headers.set('Accept', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const callerSignal = fetchInit.signal;
  let isCallerAborted = false;
  let isTimedOut = false;

  const onCallerAbort = () => {
    isCallerAborted = true;
    controller.abort();
  };

  if (callerSignal) {
    if (callerSignal.aborted) throw new ApiRequestError('Request was aborted.', 0);
    callerSignal.addEventListener('abort', onCallerAbort);
  }

  const timer = setTimeout(() => {
    isTimedOut = true;
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);

    if (isTimedOut) {
      throw new ApiRequestError(
        `Request timed out. The backend server did not respond within ${timeoutMs / 1000} seconds.`,
        408
      );
    }
    if (isCallerAborted) throw new ApiRequestError('Request was cancelled.', 0);

    throw new ApiRequestError(
      `Network failure: Unable to reach the server at ${API_BASE_URL}. (${err.message || err})`,
      0
    );
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
  }

  const responseText = await response.text();
  let payload = null;
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}`;
    if (isJsonRecord(payload)) {
      message = payload.message || payload.error || payload.detail || message;
    }
    if (response.status === 401) message = `${message}. Authentication required.`;
    else if (response.status === 403) message = `${message}. Permission denied.`;
    else if (response.status === 404) message = `${message}. Resource not found.`;
    else if (response.status >= 500) message = `Server error (${response.status}): Internal server error.`;

    throw new ApiRequestError(message, response.status, payload);
  }

  return payload;
}

export async function fetchIncidents(signalOrOptions) {
  const options =
    signalOrOptions instanceof AbortSignal ? { signal: signalOrOptions } : signalOrOptions || {};
  const rawData = await requestApi('/incidents', { method: 'GET', ...options });
  return normalizeIncidentList(rawData);
}

export async function fetchIncidentById(id, options = {}) {
  if (!id) throw new ApiRequestError('Incident ID is required.', 400);
  const rawData = await requestApi(`/incidents/${encodeURIComponent(id)}`, { method: 'GET', ...options });
  const normalized = normalizeIncident(rawData);
  if (!normalized) throw new ApiRequestError('Invalid incident record returned.', 502);
  return normalized;
}

export async function updateIncidentStatus(id, status, options = {}) {
  return updateIncident(id, { status }, options);
}

export async function updateIncident(id, payload, options = {}) {
  if (!id) throw new ApiRequestError('Incident ID is required.', 400);
  const rawData = await requestApi(`/incidents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...options,
  });
  const normalized = normalizeIncident(rawData);
  if (!normalized) throw new ApiRequestError('Failed to parse updated incident.', 502);
  return normalized;
}

export async function addIncidentReport(id, content, options = {}) {
  if (!id) throw new ApiRequestError('Incident ID is required.', 400);
  if (!content || !content.trim()) throw new ApiRequestError('Report content cannot be empty.', 400);
  const rawData = await requestApi(`/incidents/${encodeURIComponent(id)}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.trim() }),
    ...options,
  });
  return {
    id: rawData.id || `r-${Date.now()}`,
    content: content.trim(),
    createdAt: parseTimestamp(rawData.createdAt) || new Date().toISOString(),
    incidentId: id,
  };
}

export async function resolveIncident(id, payload, options = {}) {
  if (!id) throw new ApiRequestError('Incident ID is required.', 400);
  if (!payload.resolution || !payload.resolution.trim()) {
    throw new ApiRequestError('Resolution description is required.', 400);
  }
  const rawData = await requestApi(`/incidents/${encodeURIComponent(id)}/outcomes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolution: payload.resolution.trim(),
      feedback: payload.feedback?.trim() || undefined,
    }),
    ...options,
  });
  return {
    outcome: {
      id: rawData.id || `outcome-${Date.now()}`,
      resolution: payload.resolution.trim(),
      feedback: payload.feedback?.trim() || null,
      createdAt: parseTimestamp(rawData.createdAt) || new Date().toISOString(),
      incidentId: id,
    },
  };
}

export async function analyzeIncident(incidentId, options = {}) {
  if (!incidentId) throw new ApiRequestError('Incident ID is required.', 400);
  return requestApi(`/incidents/${encodeURIComponent(incidentId)}/analyze`, {
    method: 'POST',
    ...options,
  });
}

