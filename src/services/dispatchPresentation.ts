/**
 * Dispatch Presentation Helpers & Pure Utility Functions
 *
 * Provides filtering, sorting, resource aggregation, status labeling,
 * and completeness evaluation for the Planning & Dispatch workspace.
 * Pure functions suitable for deterministic unit testing.
 */

import type {
  AssignmentStatus,
  DispatchPlan,
  DispatchPlanStatus,
  ResourceAssignment,
} from './dispatchService';
import type { Incident, Resource } from './incidentService';

export interface DispatchFilterCriteria {
  query?: string;
  status?: string;
  incidentId?: string;
  incidentsMap?: Map<string, Incident>;
}

export type DispatchSortOrder = 'newest' | 'oldest';

export interface PlanResourceBreakdown {
  total: number;
  byType: Record<string, number>;
  suggestedCount: number;
  confirmedCount: number;
}

/**
 * Filter a list of dispatch plans by search query, status, and incident ID.
 */
export function filterDispatchPlans(
  plans: DispatchPlan[],
  criteria: DispatchFilterCriteria
): DispatchPlan[] {
  const query = criteria.query?.trim().toLowerCase() ?? '';
  const statusFilter = criteria.status?.trim().toUpperCase() ?? 'ALL';
  const incidentFilter = criteria.incidentId?.trim() ?? 'ALL';
  const incidentsMap = criteria.incidentsMap;

  return plans.filter(plan => {
    // 1. Status Filter
    if (statusFilter !== 'ALL' && plan.status !== statusFilter) {
      return false;
    }

    // 2. Incident Filter
    if (incidentFilter !== 'ALL' && plan.incidentId !== incidentFilter) {
      return false;
    }

    // 3. Search Query Filter
    if (query) {
      const incident = incidentsMap?.get(plan.incidentId);
      const incidentTitle = incident?.title?.toLowerCase() ?? '';
      const incidentType = incident?.type?.toLowerCase() ?? '';
      const incidentId = plan.incidentId.toLowerCase();
      const planId = plan.id.toLowerCase();
      const notes = plan.notes?.toLowerCase() ?? '';
      const action = plan.recommendedAction?.toLowerCase() ?? '';
      const hospitalName = plan.targetHospital?.name?.toLowerCase() ?? '';

      const matchesCore =
        planId.includes(query) ||
        incidentId.includes(query) ||
        incidentTitle.includes(query) ||
        incidentType.includes(query) ||
        notes.includes(query) ||
        action.includes(query) ||
        hospitalName.includes(query);

      if (matchesCore) return true;

      // Check resource names or IDs
      const matchesResource = plan.suggestedResources.some(res =>
        res.resourceId.toLowerCase().includes(query) ||
        (res.resourceName && res.resourceName.toLowerCase().includes(query)) ||
        (res.type && res.type.toLowerCase().includes(query))
      );

      return matchesResource;
    }

    return true;
  });
}

/**
 * Sort dispatch plans by creation date (newest or oldest first).
 * Plans with missing or invalid timestamps are safely placed at the end.
 */
export function sortDispatchPlans(
  plans: DispatchPlan[],
  order: DispatchSortOrder = 'newest'
): DispatchPlan[] {
  return [...plans].sort((a, b) => {
    const timeA = a.createdAt ? Date.parse(a.createdAt) : NaN;
    const timeB = b.createdAt ? Date.parse(b.createdAt) : NaN;

    const validA = Number.isFinite(timeA);
    const validB = Number.isFinite(timeB);

    if (!validA && !validB) return 0;
    if (!validA) return 1;
    if (!validB) return -1;

    return order === 'newest' ? timeB - timeA : timeA - timeB;
  });
}

/**
 * Evaluates whether a plan is incomplete and returns the list of missing items.
 */
export function getIncompletePlanItems(
  plan: DispatchPlan,
  incident?: Incident | null
): string[] {
  const missing: string[] = [];

  // 1. Missing Incident Linkage
  if (!plan.incidentId || !plan.incidentId.trim() || incident === null) {
    missing.push('Missing associated incident linkage');
  }

  // 2. Missing Assigned Resources
  if (!plan.suggestedResources || plan.suggestedResources.length === 0) {
    missing.push('No emergency resources assigned');
  }

  // 3. Missing Destination Hospital
  if (!plan.targetHospital && (!plan.targetHospitalId || !plan.targetHospitalId.trim())) {
    missing.push('No receiving hospital designated');
  }

  return missing;
}

/**
 * Computes resource breakdown and status counts for a plan.
 */
export function getPlanResourceBreakdown(
  resources: ResourceAssignment[]
): PlanResourceBreakdown {
  const breakdown: PlanResourceBreakdown = {
    total: resources.length,
    byType: {},
    suggestedCount: 0,
    confirmedCount: 0,
  };

  for (const res of resources) {
    const rawType = res.type ? res.type.trim() : 'UNSPECIFIED';
    breakdown.byType[rawType] = (breakdown.byType[rawType] || 0) + 1;

    if (res.isConfirmed || res.assignmentStatus === 'CONFIRMED' || res.assignmentStatus === 'DISPATCHED') {
      breakdown.confirmedCount += 1;
    } else {
      breakdown.suggestedCount += 1;
    }
  }

  return breakdown;
}

/**
 * Format route distance. Returns "Route information not available" if missing or invalid.
 */
export function formatRouteDistance(distanceKm: number | null | undefined): string {
  if (typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return 'Route information not available';
}

/**
 * Format route duration. Returns "ETA not available" if missing or invalid.
 */
export function formatRouteDuration(durationMins: number | null | undefined): string {
  if (typeof durationMins === 'number' && Number.isFinite(durationMins) && durationMins >= 0) {
    return `${Math.round(durationMins)} min${Math.round(durationMins) === 1 ? '' : 's'}`;
  }
  return 'ETA not available';
}

/**
 * Human-readable label and CSS class for DispatchPlanStatus.
 */
export function formatDispatchPlanStatus(status: DispatchPlanStatus): {
  label: string;
  className: string;
  description: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Pending Review',
        className: 'status-pending',
        description: 'Allocations are proposed recommendations awaiting operator confirmation.',
      };
    case 'APPROVED':
      return {
        label: 'Approved',
        className: 'status-approved',
        description: 'Plan has been approved by operator but physical dispatch has not yet initiated.',
      };
    case 'EXECUTED':
      return {
        label: 'Executed',
        className: 'status-executed',
        description: 'Dispatch action executed; resources are actively dispatched in the field.',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'status-cancelled',
        description: 'Dispatch plan was cancelled or superseded.',
      };
    case 'UNKNOWN':
    default:
      return {
        label: 'Unknown Status',
        className: 'status-unknown',
        description: 'Plan status was not specified or is not recognized.',
      };
  }
}

/**
 * Human-readable label and CSS class for AssignmentStatus.
 */
export function formatAssignmentStatus(status: AssignmentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'SUGGESTED':
      return { label: 'Suggested', className: 'assignment-suggested' };
    case 'CONFIRMED':
      return { label: 'Confirmed', className: 'assignment-confirmed' };
    case 'DISPATCHED':
      return { label: 'Dispatched', className: 'assignment-dispatched' };
    case 'STANDBY':
      return { label: 'Standby', className: 'assignment-standby' };
    case 'UNKNOWN':
    default:
      return { label: 'Unknown', className: 'assignment-unknown' };
  }
}

/**
 * Format timestamp safely for human presentation.
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Not provided';
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return 'Not provided';

  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Validates whether a dispatch plan satisfies all execution preconditions:
 * 1. Plan cannot already be EXECUTED or CANCELLED.
 * 2. Plan must be in PENDING or APPROVED status.
 * 3. Plan must have an associated incident.
 * 4. Plan must have at least one assigned resource.
 * 5. All assigned resources must be currently available (not in maintenance or already dispatched).
 */
export function canExecuteDispatchPlan(
  plan: DispatchPlan | null | undefined,
  knownResources?: Map<string, Resource>
): { canExecute: boolean; reason: string | null } {
  if (!plan) {
    return { canExecute: false, reason: 'No dispatch plan selected.' };
  }

  // 1. Check existing status
  if (plan.status === 'EXECUTED') {
    return { canExecute: false, reason: 'This dispatch plan has already been executed.' };
  }
  if (plan.status === 'CANCELLED') {
    return { canExecute: false, reason: 'This dispatch plan has been cancelled and cannot be executed.' };
  }
  if (plan.status === 'UNKNOWN') {
    return { canExecute: false, reason: 'Dispatch plan status is unknown. Cannot execute unverified plan.' };
  }
  if (plan.status !== 'PENDING' && plan.status !== 'APPROVED') {
    return { canExecute: false, reason: `Plan status "${plan.status}" is not eligible for execution.` };
  }

  // 2. Incident linkage check
  if (!plan.incidentId || !plan.incidentId.trim()) {
    return { canExecute: false, reason: 'Cannot execute plan without an associated incident.' };
  }

  // 3. Resource presence check
  if (!plan.suggestedResources || plan.suggestedResources.length === 0) {
    return { canExecute: false, reason: 'Cannot execute plan with 0 allocated emergency resources.' };
  }

  // 4. Resource availability check
  for (const resource of plan.suggestedResources) {
    const known = knownResources?.get(resource.resourceId);
    const availability = (known?.status ?? resource.availability ?? '').toUpperCase();

    if (availability === 'DISPATCHED') {
      const name = known?.name ?? resource.resourceName ?? resource.resourceId;
      return {
        canExecute: false,
        reason: `Resource "${name}" is already dispatched to another operation.`,
      };
    }

    if (availability === 'MAINTENANCE') {
      const name = known?.name ?? resource.resourceName ?? resource.resourceId;
      return {
        canExecute: false,
        reason: `Resource "${name}" is currently in maintenance and unavailable.`,
      };
    }
  }

  return { canExecute: true, reason: null };
}

/**
 * Returns dynamic execution badge metadata accounting for in-flight requests or execution errors.
 */
export function getExecutionStatusBadge(
  status: DispatchPlanStatus,
  isExecuting?: boolean,
  hasExecutionError?: boolean
): { label: string; className: string } {
  if (isExecuting) {
    return { label: 'Executing Dispatch...', className: 'status-executing' };
  }
  if (hasExecutionError) {
    return { label: 'Execution Failed', className: 'status-failed' };
  }
  return formatDispatchPlanStatus(status);
}

/**
 * Formats a clean human-readable execution summary for confirmation dialogs.
 */
export function formatDispatchSummary(
  plan: DispatchPlan,
  incident?: Incident | null
): {
  incidentTitle: string;
  unitCount: number;
  unitNames: string[];
  hospitalName: string;
} {
  const incidentTitle = incident?.title || `Incident #${plan.incidentId.slice(0, 8)}`;
  const unitCount = plan.suggestedResources.length;
  const unitNames = plan.suggestedResources.map(
    r => r.resourceName || r.resourceId
  );
  const hospitalName =
    plan.targetHospital?.name ||
    (plan.targetHospitalId ? `Hospital #${plan.targetHospitalId.slice(0, 8)}` : 'No hospital assigned');

  return {
    incidentTitle,
    unitCount,
    unitNames,
    hospitalName,
  };
}

