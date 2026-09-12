// Thin client for the DisasterLink backend. Every operator console call goes
// through here so authentication headers and error handling stay consistent.

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const TOKEN_STORAGE_KEY = 'disasterlink_token';

export function apiFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

async function readJson(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = payload;
    throw error;
  }
  return payload;
}

const postJson = (path, body) =>
  apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(readJson);

export const fetchIncidents = () => apiFetch('/incidents').then(readJson);

export const registerOperator = (payload) => postJson('/auth/register', payload);

// Runs the full six-agent AI pipeline and persists the resulting dispatch plan.
export const createDispatchPlan = (incidentId) => postJson('/dispatch/plan', { incidentId });

export const executeDispatchPlan = (planId) => postJson('/dispatch/execute', { planId });

export const rejectDispatchPlan = (planId, reason) => postJson('/dispatch/reject', { planId, reason });

export const streamEventsUrl = () => `${API_URL}/events`;
