import assert from 'node:assert/strict';
import type { Incident } from '../services/incidentService';
import {
  compareIncidents,
  filterAndSortIncidents,
  formatAbsoluteTime,
  formatRelativeTime,
  matchesDateRange,
  matchesSearch,
} from './incidentFilters';

console.log('--- Running incidentFilters tests ---');

const baseMockIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: 'inc-100',
  title: 'Flash Flood in Adyar',
  type: 'FLOOD',
  status: 'ACTIVE',
  priority: 'HIGH',
  timestamp: '2026-11-15T10:00:00.000Z',
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T10:05:00.000Z',
  description: 'Water rising up to 2 meters',
  locationLat: 13.0067,
  locationLng: 80.2565,
  location: { lat: 13.0067, lng: 80.2565 },
  victimCount: 6,
  elderlyCount: 2,
  childrenCount: 1,
  disabledCount: 0,
  victimInformation: { total: 6, elderly: 2, children: 1, disabled: 0 },
  reports: [],
  predictions: [],
  dispatchPlans: [],
  updates: [],
  ...overrides,
});

// 1. Empty list
{
  const result = filterAndSortIncidents([], { searchQuery: 'flood', statuses: ['ACTIVE'] });
  assert.deepEqual(result, [], 'Empty incident list should always yield empty list');
}
console.log('✓ Test 1 passed: Empty list handled gracefully');

// 2. Search with special characters and null fields
{
  const incidentWithNulls = baseMockIncident({
    id: 'special-id-[123]',
    title: 'Bridge collapse (Hazardous *danger*)',
    description: null,
    locationLat: null,
    locationLng: null,
    location: null,
    victimCount: null,
    elderlyCount: null,
    childrenCount: null,
    disabledCount: null,
  });

  // Query with regex special characters: [, (, *, \
  assert.equal(matchesSearch(incidentWithNulls, '[123]'), true);
  assert.equal(matchesSearch(incidentWithNulls, '(Hazardous *danger*)'), true);
  assert.equal(matchesSearch(incidentWithNulls, '*danger*'), true);
  assert.equal(matchesSearch(incidentWithNulls, 'Hazardous *'), true);
  assert.equal(matchesSearch(incidentWithNulls, 'non-matching?'), false);
  assert.equal(matchesSearch(incidentWithNulls, ''), true);
}
console.log('✓ Test 2 passed: Search with special characters and null fields succeeds without error');

// 3. Multi-select filters
{
  const incFlood = baseMockIncident({ id: '1', type: 'FLOOD', status: 'ACTIVE', priority: 'HIGH' });
  const incFire = baseMockIncident({ id: '2', type: 'FIRE', status: 'NEW', priority: 'CRITICAL' });
  const incMedical = baseMockIncident({ id: '3', type: 'MEDICAL', status: 'RESOLVED', priority: 'LOW' });
  const list = [incFlood, incFire, incMedical];

  // Match multiple statuses
  const byStatus = filterAndSortIncidents(list, { statuses: ['ACTIVE', 'NEW'] });
  assert.equal(byStatus.length, 2);
  assert.deepEqual(byStatus.map(i => i.id).sort(), ['1', '2']);

  // Match multiple priorities
  const byPriority = filterAndSortIncidents(list, { priorities: ['CRITICAL', 'LOW'] });
  assert.equal(byPriority.length, 2);
  assert.deepEqual(byPriority.map(i => i.id).sort(), ['2', '3']);

  // Match multiple types
  const byType = filterAndSortIncidents(list, { types: ['FLOOD', 'MEDICAL'] });
  assert.equal(byType.length, 2);
  assert.deepEqual(byType.map(i => i.id).sort(), ['1', '3']);
}
console.log('✓ Test 3 passed: Multi-select status, priority, and type filtering works');

// 4. All filters on together
{
  const target = baseMockIncident({
    id: 'target-match',
    title: 'Hospital generator fire',
    type: 'FIRE',
    status: 'ACTIVE',
    priority: 'CRITICAL',
    timestamp: '2026-11-15T11:00:00.000Z',
  });
  const nearMiss1 = baseMockIncident({
    id: 'miss-1',
    title: 'Hospital generator fire',
    type: 'FIRE',
    status: 'RESOLVED', // doesn't match ACTIVE
    priority: 'CRITICAL',
  });
  const nearMiss2 = baseMockIncident({
    id: 'miss-2',
    title: 'Apartment fire',
    type: 'FIRE',
    status: 'ACTIVE',
    priority: 'MEDIUM', // doesn't match CRITICAL
  });

  const now = new Date('2026-11-15T12:00:00.000Z').getTime();
  const allFiltered = filterAndSortIncidents(
    [target, nearMiss1, nearMiss2],
    {
      searchQuery: 'Hospital',
      statuses: ['ACTIVE'],
      priorities: ['CRITICAL'],
      types: ['FIRE'],
      dateRange: '24H',
      sortKey: 'newest',
    },
    now
  );

  assert.equal(allFiltered.length, 1);
  assert.equal(allFiltered[0].id, 'target-match');
}
console.log('✓ Test 4 passed: All filters combined together filter correctly');

// 5. Sorting with invalid/missing timestamps sorting last
{
  const validNew = baseMockIncident({ id: 'v-new', timestamp: '2026-11-15T11:00:00.000Z' });
  const validOld = baseMockIncident({ id: 'v-old', timestamp: '2026-11-15T09:00:00.000Z' });
  const invalidTime = baseMockIncident({ id: 'v-bad', timestamp: null, createdAt: null });
  const list = [invalidTime, validOld, validNew];

  const sortedNewest = [...list].sort((a, b) => compareIncidents(a, b, 'newest'));
  assert.equal(sortedNewest[0].id, 'v-new');
  assert.equal(sortedNewest[1].id, 'v-old');
  assert.equal(sortedNewest[2].id, 'v-bad', 'Missing timestamp must sort last for newest');

  const sortedOldest = [...list].sort((a, b) => compareIncidents(a, b, 'oldest'));
  assert.equal(sortedOldest[0].id, 'v-old');
  assert.equal(sortedOldest[1].id, 'v-new');
  assert.equal(sortedOldest[2].id, 'v-bad', 'Missing timestamp must sort last for oldest');
}
console.log('✓ Test 5 passed: Missing/invalid timestamps sort last');

// 6. Priority ranking order
{
  const low = baseMockIncident({ id: 'p-low', priority: 'LOW' });
  const crit = baseMockIncident({ id: 'p-crit', priority: 'CRITICAL' });
  const unk = baseMockIncident({ id: 'p-unk', priority: 'UNKNOWN' });
  const high = baseMockIncident({ id: 'p-high', priority: 'HIGH' });
  const med = baseMockIncident({ id: 'p-med', priority: 'MEDIUM' });

  const list = [low, unk, high, med, crit];
  const sortedDesc = [...list].sort((a, b) => compareIncidents(a, b, 'priority-desc'));
  assert.deepEqual(
    sortedDesc.map(i => i.priority),
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
  );
}
console.log('✓ Test 6 passed: Priority sorted strictly by defined rank order');

// 7. Human-readable and absolute time formatting
{
  const fixedNow = new Date('2026-11-15T12:00:00.000Z').getTime();
  const justNow = new Date(fixedNow - 30_000).toISOString();
  const fiveMin = new Date(fixedNow - 5 * 60_000).toISOString();
  const twoHours = new Date(fixedNow - 2 * 3600_000).toISOString();
  const yesterday = new Date(fixedNow - 24 * 3600_000).toISOString();

  assert.equal(formatRelativeTime(justNow, fixedNow), 'Just now');
  assert.equal(formatRelativeTime(fiveMin, fixedNow), '5m ago');
  assert.equal(formatRelativeTime(twoHours, fixedNow), '2h ago');
  assert.equal(formatRelativeTime(yesterday, fixedNow), 'Yesterday');
  assert.equal(formatRelativeTime(null), 'Time not provided');

  assert.ok(formatAbsoluteTime('2026-11-15T12:00:00.000Z').includes('2026'));
  assert.equal(formatAbsoluteTime(null), 'Time not provided');
}
console.log('✓ Test 7 passed: Human-readable and absolute time formatting verified');

console.log('--- All incidentFilters tests passed successfully! ---');
