/**
 * Unified API bridge for the Rakshak Admin Frontend.
 *
 * Re-exports the incident models, request methods, and error classes
 * from incidentService to preserve backwards compatibility across
 * AnalysisContext, AiIntelligencePage, and other consumers.
 */

export type {
  Hospital,
  HospitalCapacitySnapshot,
  Resource,
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
  OperationalEvent,
  OperationalEventConnection,
  OperationalEventType,
  PipelineTraceStep,
  VictimInformation,
} from './incidentService';

export {
  fetchHospitals,
  fetchResources,
  normalizeHospitalList,
  normalizeResourceList,
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
  subscribeOperationalEvents,
  updateCachedIncident,
  updateIncident,
  updateIncidentStatus,
  addIncidentReport,
} from './incidentService';
