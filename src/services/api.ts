/**
 * Unified API bridge for the Rakshak Admin Frontend.
 *
 * Re-exports the incident models, request methods, and error classes
 * from incidentService and dispatchService to preserve backwards
 * compatibility across AnalysisContext, AiIntelligencePage, and other consumers.
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
  updateCachedIncident,
  updateIncident,
  updateIncidentStatus,
  addIncidentReport,
} from './incidentService';

// Dispatch Service Domain Models & Request Handlers
export type {
  AssignmentStatus,
  CreateDispatchPlanPayload,
  DispatchExecutionPayload,
  DispatchExecutionResult,
  DispatchPlan,
  DispatchPlanStatus,
  HospitalDestination,
  ResourceAssignment,
  RouteEta,
} from './dispatchService';

export {
  createDispatchPlan,
  executeDispatchPlan,
  fetchDispatchContextData,
  fetchDispatchPlanById,
  fetchDispatchPlans,
  normalizeAssignmentStatus,
  normalizeDispatchPlan,
  normalizeDispatchPlanList,
  normalizeDispatchPlanStatus,
  normalizeHospitalDestination,
  normalizeResourceAssignment,
  normalizeRouteEta,
  useDispatchPlan,
  useDispatchPlans,
} from './dispatchService';

export type {
  DispatchFilterCriteria,
  DispatchSortOrder,
  PlanResourceBreakdown,
} from './dispatchPresentation';

export {
  canExecuteDispatchPlan,
  filterDispatchPlans,
  formatAssignmentStatus,
  formatDateTime,
  formatDispatchPlanStatus,
  formatDispatchSummary,
  formatRouteDistance,
  formatRouteDuration,
  getExecutionStatusBadge,
  getIncompletePlanItems,
  getPlanResourceBreakdown,
  sortDispatchPlans,
} from './dispatchPresentation';
