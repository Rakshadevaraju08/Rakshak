import { apiFetch } from './api';

/**
 * Fetches the list of all incidents.
 * GET /api/incidents
 */
export async function fetchIncidents() {
  const response = await apiFetch('/incidents');
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Failed to fetch incidents');
  }
  return response.json();
}

/**
 * Fetches a single incident with all nested details (reports, predictions, dispatchPlans).
 * GET /api/incidents/:id
 */
export async function fetchIncidentById(id) {
  if (!id) throw new Error('Incident ID is required');
  const response = await apiFetch(`/incidents/${id}`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch incident ${id}`);
  }
  return response.json();
}
