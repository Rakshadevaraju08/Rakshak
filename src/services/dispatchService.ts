/**
 * Dispatch Service Module for Rakshak
 *
 * Consolidates planning, resource allocation, and dispatch models,
 * safe normalization, API network calls, and shared React hooks.
 * Connects directly to backend endpoints in `backend/src/routes/api.js`.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ApiRequestError,
  fetchHospitals,
  fetchIncidentById,
  fetchIncidents,
  fetchResources,
  isJsonRecord,
  type Hospital,
  type JsonRecord,
  type Resource,
} from './incidentService';

// ---------------------------------------------------------------------------
// TYPES & DOMAIN MODELS
// ---------------------------------------------------------------------------

export type DispatchPlanStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'EXECUTED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type AssignmentStatus =
  | 'SUGGESTED'
  | 'CONFIRMED'
  | 'DISPATCHED'
  | 'STANDBY'
  | 'UNKNOWN';

export interface RouteEta {
  distanceKm: number | null;
  estimatedDurationMins: number | null;
  routeStatus: string | null;
  pathSummary: string | null;
  waypoints: [number, number][];
  explanation: string | null;
}

export interface ResourceAssignment {
  resourceId: string;
  resourceName: string | null;
  type: string | null;
  availability: string | null;
  assignmentStatus: AssignmentStatus;
  isConfirmed: boolean;
  action: string | null;
  route: RouteEta | null;
  estimatedArrivalTimeMins: number | null;
}

export interface HospitalDestination {
  id: string;
  name: string | null;
  locationLat: number | null;
  locationLng: number | null;
  availableBeds: number | null;
  totalBeds: number | null;
  route: RouteEta | null;
}

export interface DispatchPlan {
  id: string;
  incidentId: string;
  status: DispatchPlanStatus;
  createdAt: string | null;
  updatedAt: string | null;
  recommendedAction: string | null;
  notes: string | null;
  suggestedResources: ResourceAssignment[];
  targetHospital: HospitalDestination | null;
  targetHospitalId: string | null;
  usableRoadIds: string[];
  explanation: string[];
  warnings: string[];
  overallConfidence: number | null;
  humanReviewRequired: boolean | null;
  degraded: boolean | null;
  fallbackUsed: boolean | null;
  rawDetails: JsonRecord | null;
}

export interface CreateDispatchPlanPayload {
  incidentId: string;
}

export interface DispatchExecutionPayload {
  planId: string;
}

export interface DispatchExecutionResult {
  success: boolean;
  plan: DispatchPlan;
  message?: string;
}

// ---------------------------------------------------------------------------
// CONFIGURATION & AUTH
// ---------------------------------------------------------------------------

const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? String(import.meta.env.VITE_API_URL)
    : 'http://localhost:3001/api'
).replace(/\/+$/, '');

const DEFAULT_TIMEOUT_MS = 15000;

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

// ---------------------------------------------------------------------------
// NORMALIZATION HELPERS
// ---------------------------------------------------------------------------

function parseTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isIsoOrFormatted =
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed) ||
      /^[A-Z][a-z]{2}\s+\d{1,2}/i.test(trimmed) ||
      /^\d{10,16}$/.test(trimmed);
    if (!isIsoOrFormatted) return null;
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

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export function normalizeDispatchPlanStatus(value: unknown): DispatchPlanStatus {
  if (typeof value !== 'string') return 'UNKNOWN';
  const upper = value.trim().toUpperCase();
  if (upper === 'PENDING') return 'PENDING';
  if (upper === 'APPROVED') return 'APPROVED';
  if (upper === 'EXECUTED') return 'EXECUTED';
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED';
  return 'UNKNOWN';
}

export function normalizeAssignmentStatus(
  rawStatus: unknown,
  planStatus?: DispatchPlanStatus
): AssignmentStatus {
  if (typeof rawStatus === 'string') {
    const upper = rawStatus.trim().toUpperCase();
    if (upper === 'SUGGESTED' || upper === 'PROPOSED') return 'SUGGESTED';
    if (upper === 'CONFIRMED' || upper === 'ASSIGNED') return 'CONFIRMED';
    if (upper === 'DISPATCHED') return 'DISPATCHED';
    if (upper === 'STANDBY') return 'STANDBY';
  }

  // Derive from parent plan status if unstated
  if (planStatus === 'EXECUTED') return 'CONFIRMED';
  if (planStatus === 'PENDING') return 'SUGGESTED';
  return 'UNKNOWN';
}

export function normalizeRouteEta(raw: unknown): RouteEta | null {
  if (!isJsonRecord(raw)) return null;

  const distanceKm = parseNumber(raw.distance_km ?? raw.distanceKm ?? raw.distance);
  const estimatedDurationMins = parseNumber(
    raw.estimated_time_mins ??
    raw.estimatedTimeMins ??
    raw.estimated_duration_mins ??
    raw.estimatedDurationMins ??
    raw.duration
  );
  const routeStatus = parseString(raw.route_status ?? raw.routeStatus);
  const pathSummary = parseString(raw.path_summary ?? raw.pathSummary ?? raw.summary);
  const explanation = parseString(raw.explanation);

  const rawWaypoints = Array.isArray(raw.waypoints) ? raw.waypoints : [];
  const waypoints: [number, number][] = [];
  for (const wp of rawWaypoints) {
    if (Array.isArray(wp) && wp.length >= 2 && Number.isFinite(wp[0]) && Number.isFinite(wp[1])) {
      waypoints.push([Number(wp[0]), Number(wp[1])]);
    } else if (isJsonRecord(wp) && Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) {
      waypoints.push([Number(wp.lat), Number(wp.lng)]);
    }
  }

  // If every field is null/empty, treat as not provided (never fabricate dummy values)
  if (
    distanceKm === null &&
    estimatedDurationMins === null &&
    routeStatus === null &&
    pathSummary === null &&
    explanation === null &&
    waypoints.length === 0
  ) {
    return null;
  }

  return {
    distanceKm,
    estimatedDurationMins,
    routeStatus,
    pathSummary,
    waypoints,
    explanation,
  };
}

export function normalizeResourceAssignment(
  raw: unknown,
  planStatus: DispatchPlanStatus = 'PENDING',
  knownResources?: Map<string, Resource>
): ResourceAssignment | null {
  if (typeof raw === 'string') {
    // Shorthand resource ID string
    const resourceId = raw.trim();
    if (!resourceId) {
      console.warn('[DispatchService] Skipped empty resource ID string.');
      return null;
    }
    const known = knownResources?.get(resourceId);
    const isConfirmed = planStatus === 'EXECUTED';
    return {
      resourceId,
      resourceName: known?.name ?? null,
      type: known?.type ?? null,
      availability: known?.status ?? null,
      assignmentStatus: isConfirmed ? 'CONFIRMED' : 'SUGGESTED',
      isConfirmed,
      action: isConfirmed ? 'DISPATCHED' : 'DISPATCH_TO_INCIDENT',
      route: null,
      estimatedArrivalTimeMins: null,
    };
  }

  if (!isJsonRecord(raw)) {
    console.warn('[DispatchService] Skipped non-record resource assignment.', raw);
    return null;
  }

  const rawId = raw.resource_id ?? raw.resourceId ?? raw.id;
  const resourceId = parseString(rawId);
  if (!resourceId) {
    console.warn('[DispatchService] Skipped resource assignment record without a usable ID.', raw);
    return null;
  }

  const known = knownResources?.get(resourceId);
  const resourceName = parseString(raw.resource_name ?? raw.resourceName ?? raw.name) ?? known?.name ?? null;
  const type = parseString(raw.type) ?? known?.type ?? null;
  const availability = parseString(raw.availability ?? raw.status) ?? known?.status ?? null;
  const action = parseString(raw.action);

  const isConfirmed = planStatus === 'EXECUTED' || action === 'DISPATCHED';
  const assignmentStatus = normalizeAssignmentStatus(raw.assignment_status ?? raw.assignmentStatus, planStatus);

  const route = normalizeRouteEta(raw.route);
  const estimatedArrivalTimeMins = parseNumber(
    raw.estimated_arrival_time_mins ??
    raw.estimatedArrivalTimeMins ??
    raw.eta_mins ??
    route?.estimatedDurationMins
  );

  return {
    resourceId,
    resourceName,
    type,
    availability,
    assignmentStatus,
    isConfirmed,
    action,
    route,
    estimatedArrivalTimeMins,
  };
}

export function normalizeHospitalDestination(
  raw: unknown,
  knownHospitals?: Map<string, Hospital>
): HospitalDestination | null {
  if (typeof raw === 'string') {
    const id = raw.trim();
    if (!id) return null;
    const known = knownHospitals?.get(id);
    return {
      id,
      name: known?.name ?? null,
      locationLat: known?.locationLat ?? null,
      locationLng: known?.locationLng ?? null,
      availableBeds: known?.capacity?.available ?? null,
      totalBeds: known?.capacity?.totalBeds ?? null,
      route: null,
    };
  }

  if (!isJsonRecord(raw)) return null;

  const rawId = raw.id ?? raw.hospitalId ?? raw.hospital_id;
  const id = parseString(rawId);
  if (!id) return null;

  const known = knownHospitals?.get(id);
  const name = parseString(raw.name ?? raw.hospital_name) ?? known?.name ?? null;
  const locationLat = parseNumber(raw.locationLat ?? raw.latitude) ?? known?.locationLat ?? null;
  const locationLng = parseNumber(raw.locationLng ?? raw.longitude) ?? known?.locationLng ?? null;
  const availableBeds = parseNumber(raw.availableBeds ?? raw.available_beds ?? raw.available) ?? known?.capacity?.available ?? null;
  const totalBeds = parseNumber(raw.totalBeds ?? raw.total_beds ?? raw.total) ?? known?.capacity?.totalBeds ?? null;
  const route = normalizeRouteEta(raw.route);

  return {
    id,
    name,
    locationLat,
    locationLng,
    availableBeds,
    totalBeds,
    route,
  };
}

export function normalizeDispatchPlan(
  raw: unknown,
  knownResources?: Map<string, Resource>,
  knownHospitals?: Map<string, Hospital>
): DispatchPlan | null {
  if (!isJsonRecord(raw)) return null;

  // Unenvelope if nested inside { plan: ... } or { data: ... } or { dispatchPlan: ... }
  const record: JsonRecord = isJsonRecord(raw.plan)
    ? (raw.plan as JsonRecord)
    : isJsonRecord(raw.dispatchPlan)
    ? (raw.dispatchPlan as JsonRecord)
    : isJsonRecord(raw.data)
    ? (raw.data as JsonRecord)
    : raw;

  const id = parseString(record.id);
  if (!id) {
    console.warn('[DispatchService] Skipped dispatch plan record without a usable ID.', record);
    return null;
  }

  const incidentId = parseString(record.incidentId ?? record.incident_id) ?? '';
  const status = normalizeDispatchPlanStatus(record.status);
  const createdAt = parseTimestamp(record.createdAt ?? record.created_at);
  const updatedAt = parseTimestamp(record.updatedAt ?? record.updated_at) ?? createdAt;

  // Parse inner details JSON
  let details: JsonRecord | null = null;
  if (typeof record.details === 'string') {
    try {
      const parsed = JSON.parse(record.details);
      if (isJsonRecord(parsed)) details = parsed;
    } catch {
      details = null;
    }
  } else if (isJsonRecord(record.details)) {
    details = record.details;
  }

  const recommendedAction = parseString(details?.recommended_action ?? details?.recommendedAction);
  const notes = parseString(details?.notes);

  // Extract resource assignments from AI assignments or fallback recommendedResources
  const assignments: ResourceAssignment[] = [];
  const assignmentResourceIds = new Set<string>();

  // 1. Look for AI assignments: details.assignments or details.resource_agent_result.assignments
  const rawAssignments = Array.isArray(details?.assignments)
    ? details.assignments
    : Array.isArray((details?.resource_agent_result as JsonRecord | undefined)?.assignments)
    ? ((details?.resource_agent_result as JsonRecord).assignments as unknown[])
    : [];

  for (const item of rawAssignments) {
    const normalized = normalizeResourceAssignment(item, status, knownResources);
    if (normalized && !assignmentResourceIds.has(normalized.resourceId)) {
      assignmentResourceIds.add(normalized.resourceId);
      assignments.push(normalized);
    }
  }

  // 2. Look for fallback IDs: details.recommendedResources or details.recommended_resources
  const rawResourceIds = Array.isArray(details?.recommendedResources)
    ? details.recommendedResources
    : Array.isArray(details?.recommended_resources)
    ? details.recommended_resources
    : [];

  for (const item of rawResourceIds) {
    const normalized = normalizeResourceAssignment(item, status, knownResources);
    if (normalized && !assignmentResourceIds.has(normalized.resourceId)) {
      assignmentResourceIds.add(normalized.resourceId);
      assignments.push(normalized);
    }
  }

  // Extract target hospital
  const rawHospital =
    details?.target_hospital ??
    details?.targetHospital ??
    details?.recommendedHospitalId ??
    details?.recommended_hospital_id ??
    details?.target_hospital_id;
  const targetHospital = normalizeHospitalDestination(rawHospital, knownHospitals);
  const targetHospitalId = targetHospital?.id ?? parseString(rawHospital) ?? null;

  // Extract usable roads
  const usableRoadIds = parseStringArray(details?.usableRoadIds ?? details?.usable_road_ids);

  // Extract explanations and warnings
  const explanation = parseStringArray(details?.explanation);
  const warnings: string[] = [];
  if (Array.isArray(details?.warnings)) {
    for (const w of details.warnings) {
      if (typeof w === 'string') {
        const trimmed = w.trim();
        if (trimmed) warnings.push(trimmed);
      } else if (isJsonRecord(w) && typeof w.message === 'string' && w.message.trim()) {
        warnings.push(w.message.trim());
      }
    }
  }

  const overallConfidence = parseNumber(details?.overall_confidence ?? details?.overallConfidence);
  const humanReviewRequired = typeof details?.human_review_required === 'boolean'
    ? details.human_review_required
    : typeof details?.humanReviewRequired === 'boolean'
    ? details.humanReviewRequired
    : null;
  const degraded = typeof details?.degraded === 'boolean' ? details.degraded : null;
  const fallbackUsed = typeof details?.fallback_used === 'boolean'
    ? details.fallback_used
    : typeof details?.fallbackUsed === 'boolean'
    ? details.fallbackUsed
    : null;

  return {
    id,
    incidentId,
    status,
    createdAt,
    updatedAt,
    recommendedAction,
    notes,
    suggestedResources: assignments,
    targetHospital,
    targetHospitalId,
    usableRoadIds,
    explanation,
    warnings,
    overallConfidence,
    humanReviewRequired,
    degraded,
    fallbackUsed,
    rawDetails: details,
  };
}

export function normalizeDispatchPlanList(
  payload: unknown,
  knownResources?: Map<string, Resource>,
  knownHospitals?: Map<string, Hospital>
): DispatchPlan[] {
  let list: unknown[] = [];

  if (Array.isArray(payload)) {
    list = payload;
  } else if (isJsonRecord(payload)) {
    if (Array.isArray(payload.plans)) list = payload.plans;
    else if (Array.isArray(payload.dispatchPlans)) list = payload.dispatchPlans;
    else if (Array.isArray(payload.data)) list = payload.data;
    else if (isJsonRecord(payload.plan)) {
      const single = normalizeDispatchPlan(payload.plan, knownResources, knownHospitals);
      return single ? [single] : [];
    }
  }

  const result: DispatchPlan[] = [];
  for (const item of list) {
    const plan = normalizeDispatchPlan(item, knownResources, knownHospitals);
    if (plan) result.push(plan);
  }

  return result;
}

// ---------------------------------------------------------------------------
// HTTP REQUEST DISPATCHER
// ---------------------------------------------------------------------------

async function requestApi<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const token = getStoredAuthToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const callerSignal = options.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort);
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      if (callerSignal?.aborted) {
        throw new ApiRequestError('Request was aborted by the client.', 0);
      }
      throw new ApiRequestError(
        `Request to ${path} timed out after ${timeoutMs}ms.`,
        408
      );
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new ApiRequestError(
      `Network failure: Unable to reach the dispatch service at ${API_BASE_URL}. (${errorMsg})`,
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
      message = `${message}. The requested dispatch resource was not found.`;
    } else if (response.status >= 500) {
      message = `Server error (${response.status}): The backend dispatch service encountered an internal error.`;
    }

    throw new ApiRequestError(message, response.status, payload);
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// CONTEXT DATA FETCHER (HOSPITALS & RESOURCES)
// ---------------------------------------------------------------------------

export async function fetchDispatchContextData(
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<{
  hospitals: Hospital[];
  resources: Resource[];
  knownHospitals: Map<string, Hospital>;
  knownResources: Map<string, Resource>;
}> {
  const [hospitals, resources] = await Promise.all([
    fetchHospitals(options),
    fetchResources(options),
  ]);

  const knownHospitals = new Map<string, Hospital>(hospitals.map(h => [h.id, h]));
  const knownResources = new Map<string, Resource>(resources.map(r => [r.id, r]));

  return { hospitals, resources, knownHospitals, knownResources };
}

// ---------------------------------------------------------------------------
// CORE DISPATCH SERVICE APIS
// ---------------------------------------------------------------------------

/**
 * Fetch all dispatch plans.
 * If incidentId is provided, extracts plans directly from that incident.
 * If no incidentId is provided, queries /dispatch/plans or aggregates plans
 * across recent incidents if the standalone endpoint returns 404.
 */
export async function fetchDispatchPlans(options: {
  incidentId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  knownResources?: Map<string, Resource>;
  knownHospitals?: Map<string, Hospital>;
} = {}): Promise<DispatchPlan[]> {
  const { incidentId, signal, timeoutMs, knownResources, knownHospitals } = options;

  // 1. If incidentId is provided, query incident details directly
  if (incidentId && incidentId.trim()) {
    const incident = await fetchIncidentById(incidentId.trim(), { signal, timeoutMs });
    if (Array.isArray(incident.dispatchPlans)) {
      return normalizeDispatchPlanList(incident.dispatchPlans, knownResources, knownHospitals);
    }
    return [];
  }

  // 2. Attempt top-level /dispatch/plans endpoint
  try {
    const payload = await requestApi<unknown>('/dispatch/plans', { method: 'GET', signal, timeoutMs });
    return normalizeDispatchPlanList(payload, knownResources, knownHospitals);
  } catch (err) {
    // Graceful fallback when backend routes do not expose top-level GET /dispatch/plans
    if (err instanceof ApiRequestError && err.status === 404) {
      try {
        const incidents = await fetchIncidents({ signal, timeoutMs });
        const recentIncidents = incidents.slice(0, 25);
        const detailedResults = await Promise.allSettled(
          recentIncidents.map(inc => fetchIncidentById(inc.id, { signal, timeoutMs }))
        );

        const allPlans: DispatchPlan[] = [];
        for (const res of detailedResults) {
          if (res.status === 'fulfilled' && Array.isArray(res.value.dispatchPlans)) {
            allPlans.push(...normalizeDispatchPlanList(res.value.dispatchPlans, knownResources, knownHospitals));
          }
        }

        allPlans.sort((a, b) => {
          const tA = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tB = b.createdAt ? Date.parse(b.createdAt) : 0;
          return tB - tA;
        });

        return allPlans;
      } catch {
        return [];
      }
    }
    throw err;
  }
}

/**
 * Fetch a single dispatch plan by its ID.
 */
export async function fetchDispatchPlanById(
  id: string,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    knownResources?: Map<string, Resource>;
    knownHospitals?: Map<string, Hospital>;
  } = {}
): Promise<DispatchPlan> {
  const cleanId = id?.trim();
  if (!cleanId) {
    throw new ApiRequestError('A valid plan ID is required.', 400);
  }

  try {
    const payload = await requestApi<unknown>(`/dispatch/plans/${encodeURIComponent(cleanId)}`, {
      method: 'GET',
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
    const plan = normalizeDispatchPlan(payload, options.knownResources, options.knownHospitals);
    if (plan) return plan;
    throw new ApiRequestError(`Dispatch plan with ID "${cleanId}" could not be parsed.`, 502);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      const allPlans = await fetchDispatchPlans({
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        knownResources: options.knownResources,
        knownHospitals: options.knownHospitals,
      });
      const found = allPlans.find(p => p.id === cleanId);
      if (found) return found;
      throw new ApiRequestError(`Dispatch plan with ID "${cleanId}" was not found.`, 404);
    }
    throw err;
  }
}

/**
 * Request creation of a new dispatch plan for an incident.
 */
export async function createDispatchPlan(
  payload: CreateDispatchPlanPayload,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<DispatchPlan> {
  const incidentId = payload?.incidentId?.trim();
  if (!incidentId) {
    throw new ApiRequestError('incidentId is required to create a dispatch plan.', 400);
  }

  const rawResult = await requestApi<unknown>('/dispatch/plan', {
    method: 'POST',
    body: { incidentId },
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });

  const normalized = normalizeDispatchPlan(rawResult);
  if (!normalized) {
    throw new ApiRequestError('The created dispatch plan did not contain a valid record.', 502, rawResult);
  }

  return normalized;
}

/**
 * Execute a confirmed dispatch plan, transitioning status to EXECUTED
 * and dispatching assigned resources in the field.
 */
export async function executeDispatchPlan(
  payload: DispatchExecutionPayload,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    knownResources?: Map<string, Resource>;
    knownHospitals?: Map<string, Hospital>;
  } = {}
): Promise<DispatchExecutionResult> {
  const planId = payload?.planId?.trim();
  if (!planId) {
    throw new ApiRequestError('planId is required to execute a dispatch plan.', 400);
  }

  const rawResult = await requestApi<unknown>('/dispatch/execute', {
    method: 'POST',
    body: { planId },
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });

  const normalized = normalizeDispatchPlan(rawResult, options.knownResources, options.knownHospitals);
  if (!normalized) {
    throw new ApiRequestError('The dispatch execution response did not contain a valid plan.', 502, rawResult);
  }

  return {
    success: true,
    plan: normalized,
    message: `Dispatch plan ${normalized.id} executed successfully.`,
  };
}

// ---------------------------------------------------------------------------
// SHARED REACT HOOKS
// ---------------------------------------------------------------------------

/**
 * React hook to fetch and manage a list of dispatch plans.
 * Supports filtering by incidentId, auto-abort on unmount, and manual refetch.
 */
export function useDispatchPlans(options: {
  incidentId?: string;
  timeoutMs?: number;
  knownResources?: Map<string, Resource>;
  knownHospitals?: Map<string, Hospital>;
} = {}) {
  const [data, setData] = useState<DispatchPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const incidentId = options.incidentId;
  const timeoutMs = options.timeoutMs;
  const knownResources = options.knownResources;
  const knownHospitals = options.knownHospitals;

  const refetch = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const plans = await fetchDispatchPlans({
        incidentId,
        signal: controller.signal,
        timeoutMs,
        knownResources,
        knownHospitals,
      });
      setData(plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dispatch plans.');
    } finally {
      setLoading(false);
    }
  }, [incidentId, timeoutMs, knownResources, knownHospitals]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchDispatchPlans({
      incidentId,
      signal: controller.signal,
      timeoutMs,
      knownResources,
      knownHospitals,
    })
      .then(plans => {
        if (mounted) {
          setData(plans);
          setError(null);
        }
      })
      .catch(err => {
        if (mounted && err?.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to load dispatch plans.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [incidentId, timeoutMs, knownResources, knownHospitals]);

  return { data, loading, error, refetch };
}

/**
 * React hook to fetch and manage a single dispatch plan by its ID.
 */
export function useDispatchPlan(
  id: string | null | undefined,
  options: {
    timeoutMs?: number;
    knownResources?: Map<string, Resource>;
    knownHospitals?: Map<string, Hospital>;
  } = {}
) {
  const [data, setData] = useState<DispatchPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const timeoutMs = options.timeoutMs;
  const knownResources = options.knownResources;
  const knownHospitals = options.knownHospitals;

  const refetch = useCallback(async () => {
    if (!id || !id.trim()) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const plan = await fetchDispatchPlanById(id, {
        signal: controller.signal,
        timeoutMs,
        knownResources,
        knownHospitals,
      });
      setData(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dispatch plan.');
    } finally {
      setLoading(false);
    }
  }, [id, timeoutMs, knownResources, knownHospitals]);

  useEffect(() => {
    if (!id || !id.trim()) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchDispatchPlanById(id, {
      signal: controller.signal,
      timeoutMs,
      knownResources,
      knownHospitals,
    })
      .then(plan => {
        if (mounted) {
          setData(plan);
          setError(null);
        }
      })
      .catch(err => {
        if (mounted && err?.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to load dispatch plan.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [id, timeoutMs, knownResources, knownHospitals]);

  return { data, loading, error, refetch };
}

