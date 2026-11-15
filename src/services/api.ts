/**
 * Unified API bridge for the Rakshak Admin Frontend.
 *
 * Re-exports the incident models, request methods, and error classes
 * from incidentService to preserve backwards compatibility across
 * AnalysisContext, AiIntelligencePage, and other consumers.
 */

export type {
  FullResponsePlan,
  Incident,
  IncidentDispatchPlan,
  IncidentLocation,
  IncidentOutcome,
  IncidentPatchPayload,
  IncidentPrediction,
  IncidentPriority,
  IncidentReport,
  IncidentStatus,
  IncidentType,
  IncidentUpdate,
  JsonRecord,
  NormalizedIncidentListResult,
  PipelineTraceStep,
  VictimInformation,
} from './incidentService';

export {
  analyzeIncident,
  ApiRequestError,
  fetchIncidentById,
  fetchIncidents,
  fetchIncidentsWithStats,
  getCachedIncidents,
  isJsonRecord,
  normalizeIncident,
  normalizeIncidentList,
  normalizeIncidentListWithStats,
  notifyIncidentChanges,
  resolveIncident,
  subscribeIncidentChanges,
  updateCachedIncident,
  updateIncident,
  updateIncidentStatus,
  addIncidentReport,
} from './incidentService';
