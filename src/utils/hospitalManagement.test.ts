import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiRequestError,
  normalizeHospitalList,
  normalizeResourceList,
} from '../services/incidentService';
import {
  filterHospitals,
  filterResourcesByStatus,
  getHospitalBedMetrics,
  getHospitalCapacitySummary,
  NO_STATUS_FILTER,
} from './hospitalManagement';

const hospitals = normalizeHospitalList([
  {
    id: 'hospital-1',
    name: 'North General',
    locationLat: 26.2,
    locationLng: 91.7,
    capacities: [{ totalBeds: 100, available: 25, updatedAt: '2026-11-15T10:00:00.000Z' }],
  },
  { id: 'hospital-2', name: 'River Clinic', locationLat: null, locationLng: null, capacities: [] },
]);

const resources = normalizeResourceList([
  { id: 'resource-1', name: 'Ambulance A', type: 'AMBULANCE', status: 'AVAILABLE', ambulances: [{ plateNumber: 'AS-01' }] },
  { id: 'resource-2', name: 'Team B', type: 'RESCUE_TEAM', status: 'DISPATCHED', rescueTeams: [{ personnel: 5 }] },
  { id: 'resource-3', name: 'Unknown resource', type: null, status: null },
]);

test('normalizes only hospital/resource fields returned by the API', () => {
  assert.deepEqual(hospitals[0], {
    id: 'hospital-1',
    name: 'North General',
    locationLat: 26.2,
    locationLng: 91.7,
    capacity: {
      totalBeds: 100,
      available: 25,
      updatedAt: '2026-11-15T10:00:00.000Z',
    },
  });
  assert.equal(hospitals[1].capacity, null);
  assert.equal(resources[0].ambulancePlateNumbers[0], 'AS-01');
  assert.deepEqual(resources[1].rescuePersonnel, [5]);
  assert.equal(resources[2].status, null);
  assert.throws(() => normalizeHospitalList({ hospitals: [] }), ApiRequestError);
  assert.throws(() => normalizeResourceList(null), ApiRequestError);
});

test('searches hospitals by name and returned coordinates only', () => {
  assert.deepEqual(filterHospitals(hospitals, 'north'), [hospitals[0]]);
  assert.deepEqual(filterHospitals(hospitals, '26.2'), [hospitals[0]]);
  assert.deepEqual(filterHospitals(hospitals, 'unknown address'), []);
  assert.equal(filterHospitals(hospitals, '  ').length, hospitals.length);
});

test('filters resource records by their actual status, including missing status', () => {
  assert.deepEqual(filterResourcesByStatus(resources, 'AVAILABLE'), [resources[0]]);
  assert.deepEqual(filterResourcesByStatus(resources, NO_STATUS_FILTER), [resources[2]]);
  assert.equal(filterResourcesByStatus(resources, '').length, resources.length);
});

test('derives occupied beds and occupancy only from consistent capacity values', () => {
  assert.deepEqual(getHospitalBedMetrics(hospitals[0]), {
    occupiedBeds: 75,
    occupancyPercent: 75,
  });
  assert.deepEqual(getHospitalCapacitySummary(hospitals), {
    hospitalCount: 1,
    totalBeds: 100,
    availableBeds: 25,
    occupiedBeds: 75,
    occupancyPercent: 75,
  });
  assert.equal(getHospitalBedMetrics(hospitals[1]), null);

  const inconsistent = normalizeHospitalList([{
    id: 'hospital-3',
    name: 'Invalid capacity',
    capacities: [{ totalBeds: 20, available: 21 }],
  }])[0];
  assert.equal(getHospitalBedMetrics(inconsistent), null);
  assert.equal(getHospitalCapacitySummary([inconsistent]), null);
});
