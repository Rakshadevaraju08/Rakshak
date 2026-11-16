import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAssignmentStatus,
  normalizeDispatchPlan,
  normalizeDispatchPlanList,
  normalizeDispatchPlanStatus,
  normalizeHospitalDestination,
  normalizeResourceAssignment,
  normalizeRouteEta,
  type DispatchPlan,
  type HospitalDestination,
  type ResourceAssignment,
  type RouteEta,
} from './dispatchService';
import type { Hospital, Resource } from './incidentService';

describe('Dispatch Service Normalization & Data Layer', () => {
  describe('normalizeDispatchPlanStatus', () => {
    it('normalizes valid plan status values correctly', () => {
      assert.equal(normalizeDispatchPlanStatus('PENDING'), 'PENDING');
      assert.equal(normalizeDispatchPlanStatus('pending'), 'PENDING');
      assert.equal(normalizeDispatchPlanStatus('APPROVED'), 'APPROVED');
      assert.equal(normalizeDispatchPlanStatus('EXECUTED'), 'EXECUTED');
      assert.equal(normalizeDispatchPlanStatus('executed'), 'EXECUTED');
      assert.equal(normalizeDispatchPlanStatus('CANCELLED'), 'CANCELLED');
      assert.equal(normalizeDispatchPlanStatus('CANCELED'), 'CANCELLED');
    });

    it('maps unknown, null, or malformed statuses to safe UNKNOWN', () => {
      assert.equal(normalizeDispatchPlanStatus('IN_PROGRESS'), 'UNKNOWN');
      assert.equal(normalizeDispatchPlanStatus('RANDOM_STATUS'), 'UNKNOWN');
      assert.equal(normalizeDispatchPlanStatus(null), 'UNKNOWN');
      assert.equal(normalizeDispatchPlanStatus(undefined), 'UNKNOWN');
      assert.equal(normalizeDispatchPlanStatus(123), 'UNKNOWN');
      assert.equal(normalizeDispatchPlanStatus({}), 'UNKNOWN');
    });
  });

  describe('normalizeAssignmentStatus', () => {
    it('normalizes explicit assignment statuses correctly', () => {
      assert.equal(normalizeAssignmentStatus('SUGGESTED'), 'SUGGESTED');
      assert.equal(normalizeAssignmentStatus('PROPOSED'), 'SUGGESTED');
      assert.equal(normalizeAssignmentStatus('CONFIRMED'), 'CONFIRMED');
      assert.equal(normalizeAssignmentStatus('ASSIGNED'), 'CONFIRMED');
      assert.equal(normalizeAssignmentStatus('DISPATCHED'), 'DISPATCHED');
      assert.equal(normalizeAssignmentStatus('STANDBY'), 'STANDBY');
    });

    it('derives assignment status from parent plan status when unstated', () => {
      assert.equal(normalizeAssignmentStatus(null, 'PENDING'), 'SUGGESTED');
      assert.equal(normalizeAssignmentStatus(undefined, 'PENDING'), 'SUGGESTED');
      assert.equal(normalizeAssignmentStatus(null, 'EXECUTED'), 'CONFIRMED');
      assert.equal(normalizeAssignmentStatus(undefined, 'EXECUTED'), 'CONFIRMED');
      assert.equal(normalizeAssignmentStatus(null, 'UNKNOWN'), 'UNKNOWN');
    });
  });

  describe('normalizeRouteEta', () => {
    it('extracts complete snake_case route data accurately', () => {
      const raw = {
        distance_km: 8.4,
        estimated_time_mins: 14.5,
        route_status: 'OPEN',
        path_summary: 'Highway 10 to South Crossing',
        explanation: 'Primary arterial open with no flood obstructions',
        waypoints: [
          [12.9716, 77.5946],
          [12.9816, 77.6046],
        ],
      };

      const result: RouteEta | null = normalizeRouteEta(raw);
      assert.ok(result);
      assert.equal(result.distanceKm, 8.4);
      assert.equal(result.estimatedDurationMins, 14.5);
      assert.equal(result.routeStatus, 'OPEN');
      assert.equal(result.pathSummary, 'Highway 10 to South Crossing');
      assert.equal(result.explanation, 'Primary arterial open with no flood obstructions');
      assert.deepEqual(result.waypoints, [
        [12.9716, 77.5946],
        [12.9816, 77.6046],
      ]);
    });

    it('supports camelCase and string numeric formats', () => {
      const raw = {
        distanceKm: '12.2',
        estimatedTimeMins: '25',
        routeStatus: 'PARTIAL',
        summary: 'Secondary road',
      };

      const result = normalizeRouteEta(raw);
      assert.ok(result);
      assert.equal(result.distanceKm, 12.2);
      assert.equal(result.estimatedDurationMins, 25);
      assert.equal(result.routeStatus, 'PARTIAL');
      assert.equal(result.pathSummary, 'Secondary road');
    });

    it('returns null and NEVER fabricates values when route data is absent or empty', () => {
      assert.equal(normalizeRouteEta(null), null);
      assert.equal(normalizeRouteEta(undefined), null);
      assert.equal(normalizeRouteEta('invalid string'), null);
      assert.equal(normalizeRouteEta(12345), null);
      assert.equal(normalizeRouteEta({}), null);
      assert.equal(normalizeRouteEta({ distance_km: null, estimated_time_mins: null }), null);
    });
  });

  describe('normalizeResourceAssignment', () => {
    const knownResources = new Map<string, Resource>([
      [
        'amb-1',
        {
          id: 'amb-1',
          name: 'Ambulance Unit 01',
          type: 'AMBULANCE',
          status: 'AVAILABLE',
          locationLat: 12.97,
          locationLng: 77.59,
          ambulancePlateNumbers: ['KA-01-E-1001'],
          rescuePersonnel: [],
          createdAt: '2026-11-16T10:00:00.000Z',
          updatedAt: '2026-11-16T10:00:00.000Z',
        },
      ],
    ]);

    it('skips resource assignments without a usable ID and warns to console', () => {
      const warnedMessages: unknown[][] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnedMessages.push(args);
      };

      try {
        const noId = normalizeResourceAssignment({});
        assert.equal(noId, null);

        const emptyId = normalizeResourceAssignment({ resource_id: '   ' });
        assert.equal(emptyId, null);

        assert.ok(warnedMessages.length >= 2);
      } finally {
        console.warn = originalWarn;
      }
    });

    it('enriches shorthand resource ID strings using known resources map', () => {
      const res = normalizeResourceAssignment('amb-1', 'PENDING', knownResources);
      assert.ok(res);
      assert.equal(res.resourceId, 'amb-1');
      assert.equal(res.resourceName, 'Ambulance Unit 01');
      assert.equal(res.type, 'AMBULANCE');
      assert.equal(res.availability, 'AVAILABLE');
      assert.equal(res.assignmentStatus, 'SUGGESTED');
      assert.equal(res.isConfirmed, false);
      assert.equal(res.route, null);
      assert.equal(res.estimatedArrivalTimeMins, null);
    });

    it('marks executed plan assignments as CONFIRMED', () => {
      const res = normalizeResourceAssignment('amb-1', 'EXECUTED', knownResources);
      assert.ok(res);
      assert.equal(res.isConfirmed, true);
      assert.equal(res.assignmentStatus, 'CONFIRMED');
    });

    it('parses full AI resource assignment with nested route and ETA', () => {
      const raw = {
        resource_id: 'res-99',
        name: 'Rapid Rescue Team 3',
        type: 'RESCUE_TEAM',
        action: 'DISPATCH_TO_INCIDENT',
        estimated_arrival_time_mins: 18,
        route: {
          distance_km: 6.5,
          estimated_time_mins: 18,
          route_status: 'OPEN',
        },
      };

      const res = normalizeResourceAssignment(raw, 'PENDING');
      assert.ok(res);
      assert.equal(res.resourceId, 'res-99');
      assert.equal(res.resourceName, 'Rapid Rescue Team 3');
      assert.equal(res.type, 'RESCUE_TEAM');
      assert.equal(res.action, 'DISPATCH_TO_INCIDENT');
      assert.equal(res.assignmentStatus, 'SUGGESTED');
      assert.equal(res.isConfirmed, false);
      assert.equal(res.estimatedArrivalTimeMins, 18);
      assert.ok(res.route);
      assert.equal(res.route.distanceKm, 6.5);
      assert.equal(res.route.estimatedDurationMins, 18);
    });
  });

  describe('normalizeHospitalDestination', () => {
    const knownHospitals = new Map<string, Hospital>([
      [
        'hosp-1',
        {
          id: 'hosp-1',
          name: 'City General Hospital',
          locationLat: 12.95,
          locationLng: 77.58,
          capacity: {
            totalBeds: 150,
            available: 24,
            updatedAt: '2026-11-16T10:00:00.000Z',
          },
        },
      ],
    ]);

    it('enriches shorthand hospital ID strings using known hospitals map', () => {
      const dest: HospitalDestination | null = normalizeHospitalDestination('hosp-1', knownHospitals);
      assert.ok(dest);
      assert.equal(dest.id, 'hosp-1');
      assert.equal(dest.name, 'City General Hospital');
      assert.equal(dest.locationLat, 12.95);
      assert.equal(dest.locationLng, 77.58);
      assert.equal(dest.availableBeds, 24);
      assert.equal(dest.totalBeds, 150);
      assert.equal(dest.route, null);
    });

    it('parses full hospital object with capacity and coordinates', () => {
      const raw = {
        hospital_id: 'hosp-2',
        hospital_name: 'St. Jude Emergency Center',
        latitude: 12.92,
        longitude: 77.61,
        available_beds: 12,
        total_beds: 80,
      };

      const dest = normalizeHospitalDestination(raw);
      assert.ok(dest);
      assert.equal(dest.id, 'hosp-2');
      assert.equal(dest.name, 'St. Jude Emergency Center');
      assert.equal(dest.locationLat, 12.92);
      assert.equal(dest.locationLng, 77.61);
      assert.equal(dest.availableBeds, 12);
      assert.equal(dest.totalBeds, 80);
    });

    it('returns null when hospital ID is missing or empty', () => {
      assert.equal(normalizeHospitalDestination(null), null);
      assert.equal(normalizeHospitalDestination({}), null);
      assert.equal(normalizeHospitalDestination({ hospital_name: 'No ID Hospital' }), null);
    });
  });

  describe('normalizeDispatchPlan', () => {
    it('skips dispatch plan records without a usable ID and warns to console', () => {
      const warned: unknown[][] = [];
      const origWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warned.push(args);
      };

      try {
        const noId = normalizeDispatchPlan({ status: 'PENDING', details: {} });
        assert.equal(noId, null);
        assert.ok(warned.length >= 1);
      } finally {
        console.warn = origWarn;
      }
    });

    it('handles enveloped payloads ({ plan: ... } and { data: ... })', () => {
      const enveloped = {
        plan: {
          id: 'plan-env-1',
          incident_id: 'inc-100',
          status: 'PENDING',
          created_at: '2026-11-16T12:00:00.000Z',
          details: {
            recommended_action: 'DISPATCH',
            assignments: [{ resource_id: 'res-1' }],
          },
        },
      };

      const plan: DispatchPlan | null = normalizeDispatchPlan(enveloped);
      assert.ok(plan);
      assert.equal(plan.id, 'plan-env-1');
      assert.equal(plan.incidentId, 'inc-100');
      assert.equal(plan.status, 'PENDING');
      assert.equal(plan.recommendedAction, 'DISPATCH');
      assert.equal(plan.suggestedResources.length, 1);
      assert.equal(plan.suggestedResources[0].resourceId, 'res-1');
    });

    it('tolerates stringified details JSON and unparseable details', () => {
      const withStringDetails = {
        id: 'plan-str-1',
        incidentId: 'inc-200',
        status: 'PENDING',
        createdAt: '2026-11-16T12:00:00.000Z',
        details: JSON.stringify({
          recommended_action: 'MONITOR',
          notes: 'Observing water level rise',
        }),
      };

      const plan = normalizeDispatchPlan(withStringDetails);
      assert.ok(plan);
      assert.equal(plan.id, 'plan-str-1');
      assert.equal(plan.recommendedAction, 'MONITOR');
      assert.equal(plan.notes, 'Observing water level rise');

      const withCorruptDetails = {
        id: 'plan-str-2',
        details: 'NOT_VALID_JSON{',
      };
      const plan2 = normalizeDispatchPlan(withCorruptDetails);
      assert.ok(plan2);
      assert.equal(plan2.rawDetails, null);
      assert.deepEqual(plan2.suggestedResources, []);
    });

    it('safely normalizes invalid or missing timestamps to null', () => {
      const planWithBadDates = {
        id: 'plan-date-1',
        createdAt: 'not-a-real-date',
        updatedAt: 'garbage-timestamp-999',
      };

      const plan = normalizeDispatchPlan(planWithBadDates);
      assert.ok(plan);
      assert.equal(plan.createdAt, null);
      assert.equal(plan.updatedAt, null);
    });

    it('correctly maps fallback recommendedResources string IDs without crashing', () => {
      const fallbackPlan = {
        id: 'plan-fallback-1',
        incidentId: 'inc-99',
        status: 'PENDING',
        details: {
          recommendedResources: ['res-a', 'res-b'],
          recommendedHospitalId: 'hosp-1',
          usableRoadIds: ['road-1', 'road-2'],
          notes: 'Awaiting operator approval.',
        },
      };

      const plan = normalizeDispatchPlan(fallbackPlan);
      assert.ok(plan);
      assert.equal(plan.id, 'plan-fallback-1');
      assert.equal(plan.suggestedResources.length, 2);
      assert.equal(plan.suggestedResources[0].resourceId, 'res-a');
      assert.equal(plan.suggestedResources[0].assignmentStatus, 'SUGGESTED');
      assert.equal(plan.suggestedResources[0].isConfirmed, false);
      assert.equal(plan.suggestedResources[0].route, null);
      assert.equal(plan.targetHospitalId, 'hosp-1');
      assert.deepEqual(plan.usableRoadIds, ['road-1', 'road-2']);
      assert.equal(plan.notes, 'Awaiting operator approval.');
    });

    it('correctly maps EXECUTED plan allocations as confirmed dispatches', () => {
      const executedPlan = {
        id: 'plan-exec-1',
        incidentId: 'inc-77',
        status: 'EXECUTED',
        details: {
          recommendedResources: ['res-1'],
        },
      };

      const plan = normalizeDispatchPlan(executedPlan);
      assert.ok(plan);
      assert.equal(plan.status, 'EXECUTED');
      assert.equal(plan.suggestedResources.length, 1);
      assert.equal(plan.suggestedResources[0].isConfirmed, true);
      assert.equal(plan.suggestedResources[0].assignmentStatus, 'CONFIRMED');
    });
  });

  describe('normalizeDispatchPlanList', () => {
    it('handles non-array and empty responses safely without throwing', () => {
      assert.deepEqual(normalizeDispatchPlanList(null), []);
      assert.deepEqual(normalizeDispatchPlanList(undefined), []);
      assert.deepEqual(normalizeDispatchPlanList('invalid payload'), []);
      assert.deepEqual(normalizeDispatchPlanList(1234), []);
      assert.deepEqual(normalizeDispatchPlanList({}), []);
    });

    it('extracts plans from enveloped list responses', () => {
      const enveloped = {
        dispatchPlans: [
          { id: 'p-1', status: 'PENDING' },
          { id: 'p-2', status: 'EXECUTED' },
        ],
      };

      const plans: DispatchPlan[] = normalizeDispatchPlanList(enveloped);
      assert.equal(plans.length, 2);
      assert.equal(plans[0].id, 'p-1');
      assert.equal(plans[0].status, 'PENDING');
      assert.equal(plans[1].id, 'p-2');
      assert.equal(plans[1].status, 'EXECUTED');
    });

    it('skips invalid items in an array and returns valid records', () => {
      const mixed = [
        null,
        'string instead of object',
        { status: 'PENDING' }, // missing id -> skipped
        { id: 'valid-plan-1', status: 'PENDING' },
      ];

      const plans = normalizeDispatchPlanList(mixed);
      assert.equal(plans.length, 1);
      assert.equal(plans[0].id, 'valid-plan-1');
    });
  });
});

