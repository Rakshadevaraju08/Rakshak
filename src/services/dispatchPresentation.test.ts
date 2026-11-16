import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canApproveDispatchPlan,
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
  groupDispatchPlanVersions,
  sortDispatchPlans,
} from './dispatchPresentation';
import type { DispatchPlan, ResourceAssignment } from './dispatchService';
import type { Hospital, Incident, Resource } from './incidentService';

const availableResourcesForApproval: Resource = {
  id: 'res-amb-1',
  name: 'Alpha Ambulance',
  type: 'AMBULANCE',
  status: 'AVAILABLE',
  createdAt: null,
  updatedAt: null,
  locationLat: null,
  locationLng: null,
  ambulancePlateNumbers: [],
  rescuePersonnel: [],
};
const availableHospitalsForApproval = new Map<string, Hospital>([[
  'hosp-1',
  {
    id: 'hosp-1',
    name: 'City Care Hospital',
    locationLat: 12.95,
    locationLng: 77.58,
    capacity: { totalBeds: 100, available: 15, updatedAt: null },
  },
]]);

describe('Dispatch Presentation & Helper Utilities', () => {
  const dummyPlan1: DispatchPlan = {
    id: 'plan-101',
    incidentId: 'inc-1',
    status: 'PENDING',
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:00:00.000Z',
    recommendedAction: 'IMMEDIATE_DISPATCH',
    notes: 'Flood response team needed',
    suggestedResources: [
      {
        resourceId: 'res-amb-1',
        resourceName: 'Alpha Ambulance',
        type: 'AMBULANCE',
        availability: 'AVAILABLE',
        assignmentStatus: 'SUGGESTED',
        isConfirmed: false,
        action: 'DISPATCH_TO_INCIDENT',
        route: {
          distanceKm: 4.2,
          estimatedDurationMins: 9.5,
          routeStatus: 'OPEN',
          pathSummary: 'Main corridor',
          waypoints: [[12.9, 77.5]],
          explanation: null,
        },
        estimatedArrivalTimeMins: 10,
      },
    ],
    targetHospital: {
      id: 'hosp-1',
      name: 'City Care Hospital',
      locationLat: 12.95,
      locationLng: 77.58,
      availableBeds: 15,
      totalBeds: 100,
      route: null,
    },
    targetHospitalId: 'hosp-1',
    usableRoadIds: ['road-1'],
    explanation: ['Critical flood sector'],
    warnings: [],
    overallConfidence: 0.9,
    humanReviewRequired: true,
    degraded: false,
    fallbackUsed: false,
    rawDetails: null,
  };

  const dummyPlan2: DispatchPlan = {
    id: 'plan-202',
    incidentId: 'inc-2',
    status: 'EXECUTED',
    createdAt: '2026-11-16T12:00:00.000Z',
    updatedAt: '2026-11-16T12:05:00.000Z',
    recommendedAction: 'MONITOR',
    notes: 'Standing by at crossing',
    suggestedResources: [
      {
        resourceId: 'res-resc-1',
        resourceName: 'Bravo Rescue Unit',
        type: 'RESCUE_TEAM',
        availability: 'DISPATCHED',
        assignmentStatus: 'CONFIRMED',
        isConfirmed: true,
        action: 'DISPATCHED',
        route: null,
        estimatedArrivalTimeMins: null,
      },
    ],
    targetHospital: null,
    targetHospitalId: null,
    usableRoadIds: [],
    explanation: [],
    warnings: [],
    overallConfidence: 0.8,
    humanReviewRequired: false,
    degraded: false,
    fallbackUsed: false,
    rawDetails: null,
  };

  const dummyIncidents = new Map<string, Incident>([
    [
      'inc-1',
      {
        id: 'inc-1',
        title: 'Severe Urban Inundation',
        description: 'Rising flood waters near canal',
        type: 'FLOOD',
        status: 'ACTIVE',
        priority: 'CRITICAL',
        timestamp: '2026-11-16T09:30:00.000Z',
        createdAt: '2026-11-16T09:30:00.000Z',
        updatedAt: '2026-11-16T09:30:00.000Z',
        locationLat: 12.97,
        locationLng: 77.59,
        location: {
          lat: 12.97,
          lng: 77.59,
        },
        victimCount: 0,
        elderlyCount: 0,
        childrenCount: 0,
        disabledCount: 0,
        victimInformation: {
          total: 0,
          elderly: 0,
          children: 0,
          disabled: 0,
        },
        reports: [],
        predictions: [],
        dispatchPlans: [],
        updates: [],
      },
    ],
  ]);

  describe('filterDispatchPlans', () => {
    it('returns all plans when criteria is empty', () => {
      const result = filterDispatchPlans([dummyPlan1, dummyPlan2], {});
      assert.equal(result.length, 2);
    });

    it('filters strictly by status', () => {
      const pending = filterDispatchPlans([dummyPlan1, dummyPlan2], { status: 'PENDING' });
      assert.equal(pending.length, 1);
      assert.equal(pending[0].id, 'plan-101');

      const executed = filterDispatchPlans([dummyPlan1, dummyPlan2], { status: 'EXECUTED' });
      assert.equal(executed.length, 1);
      assert.equal(executed[0].id, 'plan-202');
    });

    it('filters strictly by incidentId', () => {
      const inc1Plans = filterDispatchPlans([dummyPlan1, dummyPlan2], { incidentId: 'inc-1' });
      assert.equal(inc1Plans.length, 1);
      assert.equal(inc1Plans[0].id, 'plan-101');
    });

    it('searches text across plan notes, hospital name, and resource name', () => {
      const byHospital = filterDispatchPlans([dummyPlan1, dummyPlan2], { query: 'City Care' });
      assert.equal(byHospital.length, 1);
      assert.equal(byHospital[0].id, 'plan-101');

      const byResource = filterDispatchPlans([dummyPlan1, dummyPlan2], { query: 'Bravo' });
      assert.equal(byResource.length, 1);
      assert.equal(byResource[0].id, 'plan-202');

      const byIncidentTitle = filterDispatchPlans([dummyPlan1, dummyPlan2], {
        query: 'Inundation',
        incidentsMap: dummyIncidents,
      });
      assert.equal(byIncidentTitle.length, 1);
      assert.equal(byIncidentTitle[0].id, 'plan-101');
    });
  });

  describe('sortDispatchPlans', () => {
    it('sorts newest first correctly', () => {
      const sorted = sortDispatchPlans([dummyPlan1, dummyPlan2], 'newest');
      assert.equal(sorted[0].id, 'plan-202'); // 12:00 > 10:00
      assert.equal(sorted[1].id, 'plan-101');
    });

    it('sorts oldest first correctly', () => {
      const sorted = sortDispatchPlans([dummyPlan1, dummyPlan2], 'oldest');
      assert.equal(sorted[0].id, 'plan-101'); // 10:00 < 12:00
      assert.equal(sorted[1].id, 'plan-202');
    });

    it('handles plans with null or invalid timestamps gracefully', () => {
      const planNoDate: DispatchPlan = { ...dummyPlan1, id: 'no-date', createdAt: null };
      const sorted = sortDispatchPlans([planNoDate, dummyPlan2, dummyPlan1], 'newest');
      assert.equal(sorted[0].id, 'plan-202');
      assert.equal(sorted[1].id, 'plan-101');
      assert.equal(sorted[2].id, 'no-date'); // Missing dates sort last
    });
  });

  describe('getIncompletePlanItems', () => {
    it('does not require a receiving hospital for plans without a dispatch action', () => {
      const missing = getIncompletePlanItems(dummyPlan2);
      assert.deepEqual(missing, []);
    });

    it('identifies missing resources when resource list is empty', () => {
      const emptyResourcesPlan: DispatchPlan = {
        ...dummyPlan1,
        suggestedResources: [],
      };
      const missing = getIncompletePlanItems(emptyResourcesPlan);
      assert.ok(missing.includes('No emergency resources assigned'));
    });

    it('returns empty array for a fully populated plan', () => {
      const missing = getIncompletePlanItems(dummyPlan1, dummyIncidents.get('inc-1'));
      assert.deepEqual(missing, []);
    });
  });

  describe('getPlanResourceBreakdown', () => {
    it('computes counts and types correctly', () => {
      const resources: ResourceAssignment[] = [
        {
          resourceId: 'r1',
          resourceName: 'Amb 1',
          type: 'AMBULANCE',
          availability: 'AVAILABLE',
          assignmentStatus: 'SUGGESTED',
          isConfirmed: false,
          action: null,
          route: null,
          estimatedArrivalTimeMins: null,
        },
        {
          resourceId: 'r2',
          resourceName: 'Amb 2',
          type: 'AMBULANCE',
          availability: 'AVAILABLE',
          assignmentStatus: 'SUGGESTED',
          isConfirmed: false,
          action: null,
          route: null,
          estimatedArrivalTimeMins: null,
        },
        {
          resourceId: 'r3',
          resourceName: 'Team 1',
          type: 'RESCUE_TEAM',
          availability: 'DISPATCHED',
          assignmentStatus: 'CONFIRMED',
          isConfirmed: true,
          action: null,
          route: null,
          estimatedArrivalTimeMins: null,
        },
      ];

      const breakdown = getPlanResourceBreakdown(resources);
      assert.equal(breakdown.total, 3);
      assert.equal(breakdown.byType['AMBULANCE'], 2);
      assert.equal(breakdown.byType['RESCUE_TEAM'], 1);
      assert.equal(breakdown.suggestedCount, 2);
      assert.equal(breakdown.confirmedCount, 1);
    });
  });

  describe('formatRouteDistance & formatRouteDuration', () => {
    it('formats valid route distance', () => {
      assert.equal(formatRouteDistance(5.62), '5.6 km');
      assert.equal(formatRouteDistance(0), '0.0 km');
    });

    it('returns placeholder when distance is null or invalid', () => {
      assert.equal(formatRouteDistance(null), 'Route information not available');
      assert.equal(formatRouteDistance(undefined), 'Route information not available');
      assert.equal(formatRouteDistance(-2), 'Route information not available');
    });

    it('formats valid route duration', () => {
      assert.equal(formatRouteDuration(14.8), '15 mins');
      assert.equal(formatRouteDuration(1), '1 min');
    });

    it('returns placeholder when duration is null or invalid', () => {
      assert.equal(formatRouteDuration(null), 'ETA not available');
      assert.equal(formatRouteDuration(undefined), 'ETA not available');
      assert.equal(formatRouteDuration(-5), 'ETA not available');
    });
  });

  describe('formatDispatchPlanStatus & formatAssignmentStatus', () => {
    it('formats known plan statuses', () => {
      assert.equal(formatDispatchPlanStatus('PENDING').label, 'Pending Review');
      assert.equal(formatDispatchPlanStatus('EXECUTED').label, 'Execution recorded');
      assert.match(formatDispatchPlanStatus('EXECUTED').description, /external unit communication is not confirmed/i);
      assert.equal(formatDispatchPlanStatus('CANCELLED').label, 'Cancelled');
      assert.equal(formatDispatchPlanStatus('UNKNOWN').label, 'Unknown Status');
    });

    it('formats known assignment statuses', () => {
      assert.equal(formatAssignmentStatus('SUGGESTED').label, 'Suggested');
      assert.equal(formatAssignmentStatus('CONFIRMED').label, 'Confirmed');
      assert.equal(formatAssignmentStatus('UNKNOWN').label, 'Unknown');
    });
  });

  describe('formatDateTime', () => {
    it('formats valid ISO timestamps', () => {
      const res = formatDateTime('2026-11-16T12:30:00.000Z');
      assert.ok(res.length > 5);
      assert.notEqual(res, 'Not provided');
    });

    it('returns Not provided for missing or bad dates', () => {
      assert.equal(formatDateTime(null), 'Not provided');
      assert.equal(formatDateTime(undefined), 'Not provided');
      assert.equal(formatDateTime('bad-date'), 'Not provided');
    });
  });

  describe('canExecuteDispatchPlan', () => {
    const availableResources = new Map<string, Resource>([[
      'res-amb-1',
      {
        id: 'res-amb-1',
        name: 'Alpha Ambulance',
        type: 'AMBULANCE',
        status: 'AVAILABLE',
        createdAt: null,
        updatedAt: null,
        locationLat: null,
        locationLng: null,
        ambulancePlateNumbers: [],
        rescuePersonnel: [],
      },
    ]]);
    const availableHospitals = new Map([[
      'hosp-1',
      {
        id: 'hosp-1',
        name: 'City Care Hospital',
        locationLat: 12.95,
        locationLng: 77.58,
        capacity: { totalBeds: 100, available: 15, updatedAt: null },
      },
    ]]);

    it('requires explicit approval before dispatch execution', () => {
      const result = canExecuteDispatchPlan(dummyPlan1, availableResources, availableHospitals);
      assert.equal(result.canExecute, false);
      assert.match(result.reason ?? '', /approve this plan/i);
    });

    it('allows execution for an approved plan with verified available resources', () => {
      const approved = { ...dummyPlan1, status: 'APPROVED' as const };
      const result = canExecuteDispatchPlan(approved, availableResources, availableHospitals);
      assert.equal(result.canExecute, true);
      assert.equal(result.reason, null);
    });

    it('blocks execution when plan is already EXECUTED', () => {
      const result = canExecuteDispatchPlan(dummyPlan2);
      assert.equal(result.canExecute, false);
      assert.ok(result.reason?.includes('already been executed'));
    });

    it('blocks execution when plan is CANCELLED or UNKNOWN', () => {
      const cancelledPlan: DispatchPlan = { ...dummyPlan1, status: 'CANCELLED' };
      const res1 = canExecuteDispatchPlan(cancelledPlan);
      assert.equal(res1.canExecute, false);
      assert.ok(res1.reason?.includes('cancelled'));

      const unknownPlan: DispatchPlan = { ...dummyPlan1, status: 'UNKNOWN' };
      const res2 = canExecuteDispatchPlan(unknownPlan);
      assert.equal(res2.canExecute, false);
      assert.ok(res2.reason?.includes('unknown'));
    });

    it('blocks execution when plan has no incident or no resources', () => {
      const noIncPlan: DispatchPlan = { ...dummyPlan1, incidentId: '' };
      assert.equal(canExecuteDispatchPlan(noIncPlan).canExecute, false);

      const noResPlan: DispatchPlan = { ...dummyPlan1, suggestedResources: [] };
      assert.equal(canExecuteDispatchPlan(noResPlan).canExecute, false);
    });

    it('blocks execution when an allocated resource is unavailable or in maintenance', () => {
      const maintenanceResources = new Map(availableResources);
      maintenanceResources.set('res-amb-1', {
        ...availableResources.get('res-amb-1')!,
        status: 'MAINTENANCE',
      });
      const res = canExecuteDispatchPlan(
        { ...dummyPlan1, status: 'APPROVED' },
        maintenanceResources,
        availableHospitals
      );
      assert.equal(res.canExecute, false);
      assert.ok(res.reason?.includes('not currently available'));
    });
  });

  describe('plan approval and version grouping', () => {
    it('blocks approval without a safety result and permits a review-required safe-to-review plan', () => {
      const incident = dummyIncidents.get('inc-1')!;
      assert.equal(canApproveDispatchPlan(dummyPlan1, incident).canApprove, false);

      const reviewablePlan: DispatchPlan = {
        ...dummyPlan1,
        rawDetails: { safety_check: { status: 'REVIEW_REQUIRED', blocking_issues: [] } },
      };
      assert.equal(canApproveDispatchPlan(
        reviewablePlan,
        incident,
        new Map([['res-amb-1', availableResourcesForApproval]]),
        availableHospitalsForApproval
      ).canApprove, true);
    });

    it('groups plan versions by incident and marks the newest saved version', () => {
      const earlier = { ...dummyPlan1, id: 'plan-earlier' };
      const latest = {
        ...dummyPlan1,
        id: 'plan-latest',
        createdAt: '2026-11-17T10:00:00.000Z',
      };
      const other = { ...dummyPlan2, id: 'plan-other' };
      const groups = groupDispatchPlanVersions([earlier, latest, other], [earlier, latest, other]);
      assert.equal(groups.length, 2);
      const incidentGroup = groups.find(group => group.incidentId === 'inc-1');
      assert.equal(incidentGroup?.latestPlanId, 'plan-latest');
      assert.equal(incidentGroup?.versionCount, 2);
    });
  });

  describe('getExecutionStatusBadge', () => {
    it('returns Executing status when in-flight', () => {
      const badge = getExecutionStatusBadge('PENDING', true, false);
      assert.equal(badge.label, 'Executing Dispatch...');
      assert.equal(badge.className, 'status-executing');
    });

    it('returns Execution Failed status when error is flagged', () => {
      const badge = getExecutionStatusBadge('PENDING', false, true);
      assert.equal(badge.label, 'Execution Failed');
      assert.equal(badge.className, 'status-failed');
    });

    it('falls back to standard status metadata when idle', () => {
      const badge = getExecutionStatusBadge('EXECUTED', false, false);
      assert.equal(badge.label, 'Execution recorded');
      assert.equal(badge.className, 'status-executed');
    });
  });

  describe('formatDispatchSummary', () => {
    it('formats incident and resources summary accurately', () => {
      const summary = formatDispatchSummary(dummyPlan1, dummyIncidents.get('inc-1'));
      assert.equal(summary.incidentTitle, 'Severe Urban Inundation');
      assert.equal(summary.unitCount, 1);
      assert.equal(summary.unitNames[0], 'Alpha Ambulance');
      assert.equal(summary.hospitalName, 'City Care Hospital');
    });
  });
});
