/**
 * Incident Service Module for Rakshak
 *
 * Consolidates incident network calls, data models, and safe normalization.
 * Connects directly to backend endpoints in `backend/src/routes/api.js`.
 */

export type IncidentStatus = 'NEW' | 'ACTIVE' | 'RESOLVED' | 'UNKNOWN';

export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type IncidentType =
  | 'FLOOD'
  | 'FIRE'
  | 'LANDSLIDE'
  | 'EARTHQUAKE'
  | 'MEDICAL'
  | 'LOCALIZED_ACCIDENT'
  | 'OTHER'
  | 'UNKNOWN';

export interface IncidentLocation {
  lat: number;
  lng: number;
}

export interface VictimInformation {
  total: number | null;
  elderly: number | null;
  children: number | null;
  disabled: number | null;
}

export interface IncidentReport {
  id: string;
  content: string;
  createdAt: string;
  incidentId: string;
}

export interface IncidentPrediction {
  id: string;
  predictedRisk: number;
  predictedWorsening: boolean;
  timestamp: string;
  incidentId: string | null;
  weatherObservationId?: string | null;
  waterLevelId?: string | null;
}

export interface IncidentDispatchPlan {
  id: string;
  status: string;
  details: unknown;
  createdAt: string;
  updatedAt: string;
  incidentId: string;
}

export interface IncidentOutcome {
  id: string;
  resolution: string;
  feedback?: string | null;
  createdAt: string;
  incidentId: string;
}

export interface IncidentUpdate {
  id: string;
  type: 'REPORT' | 'STATUS_CHANGE' | 'DISPATCH' | 'NOTE';
  title?: string;
  content: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface Incident {
  // Primary identifier and basic information
  id: string;
  title: string;
  type: IncidentType | string;
  status: IncidentStatus | string;
  priority: IncidentPriority | string;
  timestamp: string | null;
  createdAt: string | null;
  updatedAt: string | null;

  // Description
  description: string | null;

  // Location coordinates and structured object
  locationLat: number | null;
  locationLng: number | null;
  location: IncidentLocation | null;

  // Victim metrics
  victimCount: number | null;
  elderlyCount: number | null;
  childrenCount: number | null;
  disabledCount: number | null;
  victimInformation: VictimInformation;

  // Environmental and infrastructure indicators
  waterLevel?: number | null;
  rainfall?: number | null;
  roadAccess?: string | null;
  reporterId?: string | null;

  // Sub-records
  reports: IncidentReport[];
  predictions: IncidentPrediction[];
  dispatchPlans: IncidentDispatchPlan[];
  updates: IncidentUpdate[];
}

export interface HospitalCapacitySnapshot {
  totalBeds: number | null;
  available: number | null;
  updatedAt: string | null;
}

export interface Hospital {
  id: string;
  name: string;
  locationLat: number | null;
  locationLng: number | null;
  capacity: HospitalCapacitySnapshot | null;
}

export interface Resource {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  locationLat: number | null;
  locationLng: number | null;
  ambulancePlateNumbers: string[];
  rescuePersonnel: number[];
}

export type OperationalEventType =
  | 'SOS_RECEIVED'
  | 'INCIDENT_UPDATED'
  | 'INCIDENT_REPORT_RECEIVED'
  | 'INCIDENT_RESOLVED'
  | 'RESOURCE_AVAILABLE'
  | 'RESOURCE_UNAVAILABLE'
  | 'HOSPITAL_CAPACITY_CHANGED'
  | 'HOSPITAL_FULL'
  | 'ROAD_BLOCKED'
  | 'ROAD_UPDATED'
  | 'DISPATCH_PLANNED'
  | 'DISPATCH_APPROVED'
  | 'PREDICTION_UPDATED'
  | 'WEATHER_CHANGED'
  | 'WATER_LEVEL_CHANGED'
  | 'MESH_MESSAGE_RECEIVED';

export interface OperationalEvent {
  type: OperationalEventType;
  payload: unknown;
  occurredAt: string | null;
}

export type OperationalEventConnection = 'connecting' | 'connected' | 'reconnecting';

export interface IncidentPatchPayload {
  title?: string;
  description?: string;
  status?: string;
  locationLat?: number;
  locationLng?: number;
}

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

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? String(import.meta.env.VITE_API_URL)
    : 'http://localhost:3001/api'
).replace(/\/+$/, '');

const DEFAULT_TIMEOUT_MS = 15000;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStoredAuthToken(): string | null {
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

function parseTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Enforce ISO-8601 or standard date/time structure to prevent V8 loose fallback parsing arbitrary text
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

function normalizeStatus(value: unknown): IncidentStatus {
  if (typeof value !== 'string') return 'UNKNOWN';
  const upper = value.trim().toUpperCase();
  if (upper === 'NEW') return 'NEW';
  if (upper === 'ACTIVE') return 'ACTIVE';
  if (upper === 'RESOLVED') return 'RESOLVED';
  return 'UNKNOWN';
}

function normalizePriority(value: unknown, record?: JsonRecord): IncidentPriority {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (upper === 'CRITICAL') return 'CRITICAL';
    if (upper === 'HIGH') return 'HIGH';
    if (upper === 'MEDIUM') return 'MEDIUM';
    if (upper === 'LOW') return 'LOW';
  }

  // Derive priority from predictedRisk if available in sub-records
  if (record && Array.isArray(record.predictions) && record.predictions.length > 0) {
    const latestPrediction = record.predictions[0];
    if (isJsonRecord(latestPrediction) && typeof latestPrediction.predictedRisk === 'number') {
      const risk = latestPrediction.predictedRisk;
      if (risk >= 80) return 'CRITICAL';
      if (risk >= 60) return 'HIGH';
      if (risk >= 35) return 'MEDIUM';
      if (risk >= 0) return 'LOW';
    }
  }

  return 'UNKNOWN';
}

function normalizeType(value: unknown): IncidentType | string {
  if (typeof value !== 'string' || !value.trim()) return 'UNKNOWN';
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (upper === 'FLOOD') return 'FLOOD';
  if (upper === 'FIRE') return 'FIRE';
  if (upper === 'LANDSLIDE' || upper === 'LAND_SLIDE') return 'LANDSLIDE';
  if (upper === 'EARTHQUAKE') return 'EARTHQUAKE';
  if (upper === 'MEDICAL' || upper === 'MEDICAL_EMERGENCY') return 'MEDICAL';
  if (
    upper === 'LOCALIZED_ACCIDENT' ||
    upper === 'ACCIDENT' ||
    upper === 'ROAD_ACCIDENT' ||
    upper === 'TRAFFIC_ACCIDENT'
  ) {
    return 'LOCALIZED_ACCIDENT';
  }
  if (upper === 'OTHER') return 'OTHER';
  return upper;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  const num = parseNumber(value);
  if (num === null || num < min || num > max) return null;
  return num;
}

function parsePositiveInt(value: unknown): number | null {
  const num = parseNumber(value);
  if (num === null || !Number.isSafeInteger(num) || num < 0) return null;
  return num;
}

function normalizeReports(value: unknown, incidentId: string): IncidentReport[] {
  if (!Array.isArray(value)) return [];
  const reports: IncidentReport[] = [];
  for (const item of value) {
    if (!isJsonRecord(item)) continue;
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!content) continue;
    const reportId = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `r-${reports.length + 1}`;
    const timestamp = parseTimestamp(item.createdAt) || new Date().toISOString();
    reports.push({
      id: reportId,
      content,
      createdAt: timestamp,
      incidentId: typeof item.incidentId === 'string' ? item.incidentId : incidentId,
    });
  }
  return reports;
}

function normalizePredictions(value: unknown, incidentId: string): IncidentPrediction[] {
  if (!Array.isArray(value)) return [];
  const predictions: IncidentPrediction[] = [];
  for (const item of value) {
    if (!isJsonRecord(item)) continue;
    const predictedRisk = parseNumber(item.predictedRisk);
    if (predictedRisk === null) continue;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `p-${predictions.length + 1}`;
    const timestamp = parseTimestamp(item.timestamp) || new Date().toISOString();
    predictions.push({
      id,
      predictedRisk,
      predictedWorsening: Boolean(item.predictedWorsening),
      timestamp,
      incidentId: typeof item.incidentId === 'string' ? item.incidentId : incidentId,
      weatherObservationId: typeof item.weatherObservationId === 'string' ? item.weatherObservationId : null,
      waterLevelId: typeof item.waterLevelId === 'string' ? item.waterLevelId : null,
    });
  }
  return predictions;
}

function normalizeDispatchPlans(value: unknown, incidentId: string): IncidentDispatchPlan[] {
  if (!Array.isArray(value)) return [];
  const plans: IncidentDispatchPlan[] = [];
  for (const item of value) {
    if (!isJsonRecord(item)) continue;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `dp-${plans.length + 1}`;
    const status = typeof item.status === 'string' ? item.status : 'PENDING';
    const createdAt = parseTimestamp(item.createdAt) || new Date().toISOString();
    const updatedAt = parseTimestamp(item.updatedAt) || createdAt;
    plans.push({
      id,
      status,
      details: item.details,
      createdAt,
      updatedAt,
      incidentId: typeof item.incidentId === 'string' ? item.incidentId : incidentId,
    });
  }
  return plans;
}

function buildUpdates(
  reports: IncidentReport[],
  plans: IncidentDispatchPlan[],
  createdAt: string | null,
  updatedAt: string | null
): IncidentUpdate[] {
  const updates: IncidentUpdate[] = [];

  if (createdAt) {
    updates.push({
      id: 'init',
      type: 'STATUS_CHANGE',
      title: 'Incident Logged',
      content: 'Emergency incident record was registered in the operations queue.',
      timestamp: createdAt,
    });
  }

  for (const report of reports) {
    updates.push({
      id: `report-${report.id}`,
      type: 'REPORT',
      title: 'Situation Report',
      content: report.content,
      timestamp: report.createdAt,
    });
  }

  for (const plan of plans) {
    updates.push({
      id: `dispatch-${plan.id}`,
      type: 'DISPATCH',
      title: `Dispatch Plan (${plan.status})`,
      content: `Response plan generated with status ${plan.status}.`,
      timestamp: plan.createdAt,
    });
  }

  if (updatedAt && createdAt && updatedAt !== createdAt && updates.length === 1) {
    updates.push({
      id: 'latest-update',
      type: 'STATUS_CHANGE',
      title: 'Status Updated',
      content: 'Incident status or metadata was updated by an operator.',
      timestamp: updatedAt,
    });
  }

  // Sort descending by timestamp
  updates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return updates;
}

/**
 * Normalizes a raw single incident object safely into the typed Incident model.
 * Returns null if the record is missing an id or is not a valid object.
 */
export function normalizeIncident(raw: unknown): Incident | null {
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

  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim()
    : 'Untitled Emergency';

  const description = typeof raw.description === 'string' && raw.description.trim()
    ? raw.description.trim()
    : null;

  const type = normalizeType(raw.type);
  const status = normalizeStatus(raw.status);
  const priority = normalizePriority(raw.priority, raw);

  const createdAt = parseTimestamp(raw.createdAt);
  const updatedAt = parseTimestamp(raw.updatedAt);
  const timestamp = createdAt;

  const locationLat = parseCoordinate(raw.locationLat, -90, 90);
  const locationLng = parseCoordinate(raw.locationLng, -180, 180);
  const location: IncidentLocation | null =
    locationLat !== null && locationLng !== null
      ? { lat: locationLat, lng: locationLng }
      : null;

  const victimCount = parsePositiveInt(raw.victimCount);
  const elderlyCount = parsePositiveInt(raw.elderlyCount);
  const childrenCount = parsePositiveInt(raw.childrenCount);
  const disabledCount = parsePositiveInt(raw.disabledCount);

  const victimInformation: VictimInformation = {
    total: victimCount,
    elderly: elderlyCount,
    children: childrenCount,
    disabled: disabledCount,
  };

  const waterLevel = parseNumber(raw.waterLevel);
  const rainfall = parseNumber(raw.rainfall);
  const roadAccess = typeof raw.roadAccess === 'string' ? raw.roadAccess : null;
  const reporterId = typeof raw.reporterId === 'string' ? raw.reporterId : null;

  const reports = normalizeReports(raw.reports, id);
  const predictions = normalizePredictions(raw.predictions, id);
  const dispatchPlans = normalizeDispatchPlans(raw.dispatchPlans, id);
  const updates = buildUpdates(reports, dispatchPlans, createdAt, updatedAt);

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
    locationLat,
    locationLng,
    location,
    victimCount,
    elderlyCount,
    childrenCount,
    disabledCount,
    victimInformation,
    waterLevel,
    rainfall,
    roadAccess,
    reporterId,
    reports,
    predictions,
    dispatchPlans,
    updates,
  };
}

export interface NormalizedIncidentListResult {
  incidents: Incident[];
  droppedCount: number;
}

/**
 * Normalizes an API response that is expected to be a list of incidents,
 * returning both the normalized incidents and the count of dropped invalid records.
 */
export function normalizeIncidentListWithStats(raw: unknown): NormalizedIncidentListResult {
  let listToProcess: unknown[] = [];

  if (Array.isArray(raw)) {
    listToProcess = raw;
  } else if (isJsonRecord(raw)) {
    if (Array.isArray(raw.incidents)) {
      listToProcess = raw.incidents;
    } else if (Array.isArray(raw.data)) {
      listToProcess = raw.data;
    } else if (Array.isArray(raw.items)) {
      listToProcess = raw.items;
    } else {
      console.warn('[incidentService] Received non-array incident response:', raw);
      return { incidents: [], droppedCount: 0 };
    }
  } else {
    console.warn('[incidentService] Received non-array incident response of type:', typeof raw);
    return { incidents: [], droppedCount: 0 };
  }

  const incidents: Incident[] = [];
  let droppedCount = 0;

  for (let i = 0; i < listToProcess.length; i++) {
    const item = listToProcess[i];
    const normalized = normalizeIncident(item);
    if (normalized) {
      incidents.push(normalized);
    } else {
      droppedCount++;
    }
  }

  return { incidents, droppedCount };
}

/**
 * Normalizes an API response that is expected to be a list of incidents.
 * Handles non-array responses gracefully by returning [] and logging a warning.
 * Records with missing IDs are skipped and logged with console.warn.
 */
export function normalizeIncidentList(raw: unknown): Incident[] {
  return normalizeIncidentListWithStats(raw).incidents;
}

/**
 * Standardized HTTP fetch wrapper providing timeout support and consistent error formatting.
 */
async function requestApi<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
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
    if (callerSignal.aborted) {
      throw new ApiRequestError('Request was aborted.', 0);
    }
    callerSignal.addEventListener('abort', onCallerAbort);
  }

  const timer = setTimeout(() => {
    isTimedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);

    if (isTimedOut) {
      throw new ApiRequestError(
        `Request timed out. The backend server did not respond within ${timeoutMs / 1000} seconds.`,
        408
      );
    }
    if (isCallerAborted) {
      throw new ApiRequestError('Request was cancelled.', 0);
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new ApiRequestError(
      `Network failure: Unable to reach the server at ${API_BASE_URL}. (${errorMsg})`,
      0
    );
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
  }

  const responseText = await response.text();
  let payload: unknown = null;
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
      const serverMessage = payload.message || payload.error || payload.detail;
      if (typeof serverMessage === 'string' && serverMessage.trim()) {
        message = serverMessage;
      }
    } else if (typeof payload === 'string' && payload.trim()) {
      message = payload.slice(0, 200);
    }

    if (response.status === 401) {
      message = `${message}. Authentication required: Please verify your operator session.`;
    } else if (response.status === 403) {
      message = `${message}. Permission denied: An OPERATOR or ADMIN role is required.`;
    } else if (response.status === 404) {
      message = `${message}. The requested API resource was not found.`;
    } else if (response.status >= 500) {
      message = `Server error (${response.status}): The backend service encountered an internal error.`;
    }

    throw new ApiRequestError(message, response.status, payload);
  }

  return payload as T;
}

function getOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getOptionalCoordinate(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function getNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export function normalizeHospitalList(payload: unknown): Hospital[] {
  if (!Array.isArray(payload)) {
    throw new ApiRequestError('The hospital endpoint returned an unexpected response.', 502, payload);
  }

  return payload.flatMap((item): Hospital[] => {
    if (!isJsonRecord(item)) {
      console.warn('Skipping a hospital record with an invalid shape.');
      return [];
    }

    const id = getOptionalString(item.id);
    const name = getOptionalString(item.name);
    if (!id || !name) {
      console.warn('Skipping a hospital record without an ID or name.');
      return [];
    }

    const capacityRecord = Array.isArray(item.capacities) && isJsonRecord(item.capacities[0])
      ? item.capacities[0]
      : null;
    const capacity = capacityRecord
      ? {
          totalBeds: getNonNegativeInteger(capacityRecord.totalBeds),
          available: getNonNegativeInteger(capacityRecord.available),
          updatedAt: parseTimestamp(capacityRecord.updatedAt),
        }
      : null;

    return [{
      id,
      name,
      locationLat: getOptionalCoordinate(item.locationLat, -90, 90),
      locationLng: getOptionalCoordinate(item.locationLng, -180, 180),
      capacity,
    }];
  });
}

export function normalizeResourceList(payload: unknown): Resource[] {
  if (!Array.isArray(payload)) {
    throw new ApiRequestError('The resource endpoint returned an unexpected response.', 502, payload);
  }

  return payload.flatMap((item): Resource[] => {
    if (!isJsonRecord(item)) {
      console.warn('Skipping a resource record with an invalid shape.');
      return [];
    }

    const id = getOptionalString(item.id);
    const name = getOptionalString(item.name);
    if (!id || !name) {
      console.warn('Skipping a resource record without an ID or name.');
      return [];
    }

    const ambulances = Array.isArray(item.ambulances) ? item.ambulances : [];
    const rescueTeams = Array.isArray(item.rescueTeams) ? item.rescueTeams : [];
    return [{
      id,
      name,
      type: getOptionalString(item.type),
      status: getOptionalString(item.status)?.toUpperCase() ?? null,
      createdAt: parseTimestamp(item.createdAt),
      updatedAt: parseTimestamp(item.updatedAt),
      locationLat: getOptionalCoordinate(item.locationLat, -90, 90),
      locationLng: getOptionalCoordinate(item.locationLng, -180, 180),
      ambulancePlateNumbers: ambulances.flatMap((ambulance) => {
        if (!isJsonRecord(ambulance)) return [];
        const plateNumber = getOptionalString(ambulance.plateNumber);
        return plateNumber ? [plateNumber] : [];
      }),
      rescuePersonnel: rescueTeams.flatMap((team) => {
        if (!isJsonRecord(team)) return [];
        const personnel = getNonNegativeInteger(team.personnel);
        return personnel === null ? [] : [personnel];
      }),
    }];
  });
}

export async function fetchHospitals(options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<Hospital[]> {
  const payload = await requestApi<unknown>('/hospitals', { method: 'GET', ...options });
  return normalizeHospitalList(payload);
}

export async function fetchResources(options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<Resource[]> {
  const payload = await requestApi<unknown>('/resources', { method: 'GET', ...options });
  return normalizeResourceList(payload);
}

const OPERATIONAL_EVENT_TYPES: OperationalEventType[] = [
  'SOS_RECEIVED',
  'INCIDENT_UPDATED',
  'INCIDENT_REPORT_RECEIVED',
  'INCIDENT_RESOLVED',
  'RESOURCE_AVAILABLE',
  'RESOURCE_UNAVAILABLE',
  'HOSPITAL_CAPACITY_CHANGED',
  'HOSPITAL_FULL',
  'ROAD_BLOCKED',
  'ROAD_UPDATED',
  'DISPATCH_PLANNED',
  'DISPATCH_APPROVED',
  'PREDICTION_UPDATED',
  'WEATHER_CHANGED',
  'WATER_LEVEL_CHANGED',
  'MESH_MESSAGE_RECEIVED',
];

export function subscribeOperationalEvents(
  onEvent: (event: OperationalEvent) => void,
  onConnectionChange: (connection: OperationalEventConnection) => void,
): () => void {
  const source = new EventSource(`${API_BASE_URL}/events`);
  onConnectionChange('connecting');

  const listeners = OPERATIONAL_EVENT_TYPES.map(type => {
    const listener = (event: Event) => {
      let data: unknown;
      try {
        data = JSON.parse((event as MessageEvent<string>).data) as unknown;
      } catch (error) {
        console.warn(`[incidentService] Could not parse ${type} event payload:`, error);
        return;
      }
      if (!isJsonRecord(data) || data.type !== type) {
        console.warn(`[incidentService] Ignoring malformed ${type} event payload.`);
        return;
      }
      onEvent({
        type,
        payload: data.payload,
        occurredAt: parseTimestamp(data.occurredAt),
      });
    };
    source.addEventListener(type, listener);
    return () => source.removeEventListener(type, listener);
  });

  source.onopen = () => onConnectionChange('connected');
  source.onerror = () => onConnectionChange('reconnecting');

  return () => {
    listeners.forEach(removeListener => removeListener());
    source.close();
  };
}

/**
 * Fetch all incidents from the backend queue.
 */
export async function fetchIncidents(
  signalOrOptions?: AbortSignal | { signal?: AbortSignal; timeoutMs?: number }
): Promise<Incident[]> {
  const result = await fetchIncidentsWithStats(signalOrOptions);
  return result.incidents;
}

type IncidentChangeListener = (incidents: Incident[]) => void;
const incidentChangeListeners = new Set<IncidentChangeListener>();
let cachedIncidents: Incident[] = [];

export function subscribeIncidentChanges(listener: IncidentChangeListener): () => void {
  incidentChangeListeners.add(listener);
  return () => {
    incidentChangeListeners.delete(listener);
  };
}

export function notifyIncidentChanges(updatedList: Incident[]): void {
  cachedIncidents = updatedList;
  incidentChangeListeners.forEach(fn => fn(cachedIncidents));
}

export function updateCachedIncident(updated: Incident): void {
  const index = cachedIncidents.findIndex(i => i.id === updated.id);
  if (index !== -1) {
    cachedIncidents = [
      ...cachedIncidents.slice(0, index),
      updated,
      ...cachedIncidents.slice(index + 1),
    ];
  } else {
    cachedIncidents = [updated, ...cachedIncidents];
  }
  incidentChangeListeners.forEach(fn => fn(cachedIncidents));
}

export function getCachedIncidents(): Incident[] {
  return cachedIncidents;
}

/**
 * Fetch all incidents along with validation stats (e.g. count of dropped invalid records).
 */
export async function fetchIncidentsWithStats(
  signalOrOptions?: AbortSignal | { signal?: AbortSignal; timeoutMs?: number }
): Promise<NormalizedIncidentListResult> {
  const options =
    signalOrOptions instanceof AbortSignal
      ? { signal: signalOrOptions }
      : signalOrOptions || {};

  const rawData = await requestApi<unknown>('/incidents', {
    method: 'GET',
    ...options,
  });

  const stats = normalizeIncidentListWithStats(rawData);
  notifyIncidentChanges(stats.incidents);
  return stats;
}

/**
 * Fetch a single incident by its ID, including reports, predictions, and dispatch plans.
 */
export async function fetchIncidentById(
  id: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<Incident> {
  if (!id || typeof id !== 'string') {
    throw new ApiRequestError('Incident ID is required to fetch details.', 400);
  }

  const rawData = await requestApi<unknown>(`/incidents/${encodeURIComponent(id)}`, {
    method: 'GET',
    ...options,
  });

  const normalized = normalizeIncident(rawData);
  if (!normalized) {
    throw new ApiRequestError('The server returned an invalid or incomplete incident record.', 502);
  }

  return normalized;
}

/**
 * Update an incident's status via PATCH /api/incidents/:id.
 */
export async function updateIncidentStatus(
  id: string,
  status: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<Incident> {
  return updateIncident(id, { status }, options);
}

/**
 * Update an incident via PATCH /api/incidents/:id.
 * Backend whitelists: title, description, status, locationLat, locationLng.
 */
export async function updateIncident(
  id: string,
  payload: IncidentPatchPayload,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<Incident> {
  if (!id || typeof id !== 'string') {
    throw new ApiRequestError('Incident ID is required.', 400);
  }

  const rawData = await requestApi<unknown>(`/incidents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...options,
  });

  const normalized = normalizeIncident(rawData);
  if (!normalized) {
    throw new ApiRequestError('Failed to parse updated incident from server response.', 502);
  }

  updateCachedIncident(normalized);
  return normalized;
}

/**
 * Post a follow-up report to an incident via POST /api/incidents/:id/reports.
 */
export async function addIncidentReport(
  id: string,
  content: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<IncidentReport> {
  if (!id || typeof id !== 'string') {
    throw new ApiRequestError('Incident ID is required to add a report.', 400);
  }
  if (!content || !content.trim()) {
    throw new ApiRequestError('Report content cannot be empty.', 400);
  }

  const rawData = await requestApi<JsonRecord>(`/incidents/${encodeURIComponent(id)}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.trim() }),
    ...options,
  });

  const reportId = typeof rawData.id === 'string' ? rawData.id : `r-${Date.now()}`;
  const createdAt = parseTimestamp(rawData.createdAt) || new Date().toISOString();

  return {
    id: reportId,
    content: content.trim(),
    createdAt,
    incidentId: id,
  };
}

/**
 * Resolve an incident via POST /api/incidents/:id/outcomes.
 */
export async function resolveIncident(
  id: string,
  payload: { resolution: string; feedback?: string },
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<{ incident?: Incident; outcome: IncidentOutcome }> {
  if (!id || typeof id !== 'string') {
    throw new ApiRequestError('Incident ID is required to resolve.', 400);
  }
  if (!payload.resolution || !payload.resolution.trim()) {
    throw new ApiRequestError('Resolution description is required.', 400);
  }

  const rawData = await requestApi<JsonRecord>(`/incidents/${encodeURIComponent(id)}/outcomes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolution: payload.resolution.trim(),
      feedback: payload.feedback?.trim() || undefined,
    }),
    ...options,
  });

  const outcome: IncidentOutcome = {
    id: typeof rawData.id === 'string' ? rawData.id : `outcome-${Date.now()}`,
    resolution: payload.resolution.trim(),
    feedback: payload.feedback?.trim() || null,
    createdAt: parseTimestamp(rawData.createdAt) || new Date().toISOString(),
    incidentId: id,
  };

  return { outcome };
}

function isFullResponsePlan(value: unknown): value is FullResponsePlan {
  return (
    isJsonRecord(value) &&
    typeof value.incident_id === 'string' &&
    typeof value.recommended_action === 'string' &&
    Array.isArray(value.assignments) &&
    Array.isArray(value.explanation) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.provenance) &&
    typeof value.overall_confidence === 'number' &&
    typeof value.human_review_required === 'boolean' &&
    typeof value.fallback_used === 'boolean' &&
    typeof value.degraded === 'boolean'
  );
}

/**
 * Trigger AI analysis for a specific incident via POST /api/incidents/:id/analyze.
 */
export async function analyzeIncident(
  incidentId: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<FullResponsePlan> {
  if (!incidentId || typeof incidentId !== 'string') {
    throw new ApiRequestError('Incident ID is required to request AI analysis.', 400);
  }

  const payload = await requestApi<unknown>(
    `/incidents/${encodeURIComponent(incidentId)}/analyze`,
    {
      method: 'POST',
      ...options,
    }
  );

  if (!isFullResponsePlan(payload) || payload.incident_id !== incidentId) {
    throw new ApiRequestError(
      'The AI service returned an unexpected or non-conforming response schema.',
      502,
      payload
    );
  }

  return payload;
}
