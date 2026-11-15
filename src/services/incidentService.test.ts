import assert from 'node:assert/strict';
import {
  normalizeIncident,
  normalizeIncidentList,
  type Incident,
} from './incidentService';

console.log('--- Running incidentService normalization tests ---');

// 1. Records with no usable ID must be skipped and logged with console.warn
{
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const rawList = [
      { id: '', title: 'Missing id string' },
      { id: null, title: 'Null id' },
      { id: undefined, title: 'Undefined id' },
      { id: '   ', title: 'Whitespace id' },
      { title: 'No id field at all' },
      null,
      'just a string',
      { id: 'valid-id-1', title: 'Valid incident 1', status: 'NEW' },
    ];

    const results = normalizeIncidentList(rawList);
    assert.equal(results.length, 1, 'Only 1 record should be returned');
    assert.equal(results[0].id, 'valid-id-1');
    assert.equal(warnings.length >= 7, true, 'Warnings should be logged for skipped records');
  } finally {
    console.warn = originalWarn;
  }
}
console.log('✓ Test 1 passed: Records with no usable ID skipped and logged');

// 2. Non-array responses handled gracefully
{
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    assert.deepEqual(normalizeIncidentList(null), []);
    assert.deepEqual(normalizeIncidentList(undefined), []);
    assert.deepEqual(normalizeIncidentList('not an array'), []);
    assert.deepEqual(normalizeIncidentList(12345), []);
    assert.deepEqual(normalizeIncidentList({ error: 'Failed' }), []);

    // Handles { incidents: [...] } or { data: [...] }
    const wrapped = { incidents: [{ id: 'inc-1', title: 'Wrapped incident' }] };
    const wrappedResults = normalizeIncidentList(wrapped);
    assert.equal(wrappedResults.length, 1);
    assert.equal(wrappedResults[0].id, 'inc-1');
  } finally {
    console.warn = originalWarn;
  }
}
console.log('✓ Test 2 passed: Non-array responses handled gracefully without throwing');

// 3. Tolerates null/missing fields and maps defaults
{
  const raw = {
    id: 'test-sparse',
  };

  const normalized = normalizeIncident(raw);
  assert.ok(normalized);
  assert.equal(normalized.id, 'test-sparse');
  assert.equal(normalized.title, 'Untitled Emergency');
  assert.equal(normalized.description, null);
  assert.equal(normalized.status, 'UNKNOWN');
  assert.equal(normalized.priority, 'UNKNOWN');
  assert.equal(normalized.type, 'UNKNOWN');
  assert.equal(normalized.timestamp, null);
  assert.equal(normalized.createdAt, null);
  assert.equal(normalized.locationLat, null);
  assert.equal(normalized.locationLng, null);
  assert.equal(normalized.location, null);
  assert.equal(normalized.victimCount, null);
  assert.equal(normalized.victimInformation.total, null);
  assert.deepEqual(normalized.reports, []);
  assert.deepEqual(normalized.predictions, []);
  assert.deepEqual(normalized.dispatchPlans, []);
}
console.log('✓ Test 3 passed: Tolerates completely sparse payload with safe fallbacks');

// 4. Invalid or unparseable timestamps map to null
{
  const rawInvalidDate = {
    id: 'test-date-1',
    title: 'Invalid Date Test',
    createdAt: 'not-a-valid-date-string-12345',
  };
  const normalized1 = normalizeIncident(rawInvalidDate);
  assert.ok(normalized1);
  assert.equal(normalized1.timestamp, null);
  assert.equal(normalized1.createdAt, null);

  const rawValidDate = {
    id: 'test-date-2',
    title: 'Valid Date Test',
    createdAt: '2026-11-15T10:30:00.000Z',
  };
  const normalized2 = normalizeIncident(rawValidDate);
  assert.ok(normalized2);
  assert.equal(normalized2.timestamp, '2026-11-15T10:30:00.000Z');
  assert.equal(normalized2.createdAt, '2026-11-15T10:30:00.000Z');
}
console.log('✓ Test 4 passed: Unparseable timestamps safely map to null');

// 5. Unknown status and priority values map to safe "UNKNOWN" display
{
  const rawUnknown = {
    id: 'test-unknowns',
    title: 'Unknown Values',
    status: 'SOMETHING_UNRECOGNIZED',
    priority: 'ULTRA_EXTREME_PRIORITY',
    type: 'SPACE_INVASION',
  };
  const normalized = normalizeIncident(rawUnknown);
  assert.ok(normalized);
  assert.equal(normalized.status, 'UNKNOWN');
  assert.equal(normalized.priority, 'UNKNOWN');
  assert.equal(normalized.type, 'SPACE_INVASION'); // Preserves string fallback for custom types
}
console.log('✓ Test 5 passed: Unknown status and priority map to UNKNOWN');

// 6. Known status and priority mapped correctly
{
  const rawKnown = {
    id: 'test-knowns',
    title: 'Flood in Sector 4',
    status: 'active', // lowercase test
    priority: 'critical', // lowercase test
    type: 'FLOOD',
    locationLat: 13.0827,
    locationLng: 80.2707,
    victimCount: 8,
    elderlyCount: 2,
    childrenCount: 3,
    disabledCount: 1,
    reports: [
      { id: 'rep-1', content: 'Rescue boats en route', createdAt: '2026-11-15T10:35:00.000Z' },
    ],
  };
  const normalized = normalizeIncident(rawKnown);
  assert.ok(normalized);
  assert.equal(normalized.status, 'ACTIVE');
  assert.equal(normalized.priority, 'CRITICAL');
  assert.equal(normalized.type, 'FLOOD');
  assert.equal(normalized.locationLat, 13.0827);
  assert.equal(normalized.locationLng, 80.2707);
  assert.deepEqual(normalized.location, { lat: 13.0827, lng: 80.2707 });
  assert.equal(normalized.victimCount, 8);
  assert.equal(normalized.victimInformation.total, 8);
  assert.equal(normalized.victimInformation.elderly, 2);
  assert.equal(normalized.reports.length, 1);
  assert.equal(normalized.reports[0].content, 'Rescue boats en route');
}
console.log('✓ Test 6 passed: Known values and nested structures normalized accurately');

// 7. Coordinates bounds validation
{
  const invalidCoords = {
    id: 'test-coords',
    title: 'Bad Coords',
    locationLat: 120.0, // Invalid latitude (> 90)
    locationLng: -200.0, // Invalid longitude (< -180)
  };
  const normalized = normalizeIncident(invalidCoords);
  assert.ok(normalized);
  assert.equal(normalized.locationLat, null);
  assert.equal(normalized.locationLng, null);
  assert.equal(normalized.location, null);
}
console.log('✓ Test 7 passed: Out-of-range coordinates are sanitized to null');

// 8. Type aliasing
{
  assert.equal(normalizeIncident({ id: 'alias-1', type: 'ROAD_ACCIDENT' })?.type, 'LOCALIZED_ACCIDENT');
  assert.equal(normalizeIncident({ id: 'alias-2', type: 'TRAFFIC_ACCIDENT' })?.type, 'LOCALIZED_ACCIDENT');
  assert.equal(normalizeIncident({ id: 'alias-3', type: 'LAND_SLIDE' })?.type, 'LANDSLIDE');
}
console.log('✓ Test 8 passed: Known aliases normalize to standard incident types');

// 9. Priority derivation from predictions
{
  const withPrediction = {
    id: 'risk-pred-1',
    predictions: [{ predictedRisk: 88, predictedWorsening: true }],
  };
  assert.equal(normalizeIncident(withPrediction)?.priority, 'CRITICAL');

  const withMedRisk = {
    id: 'risk-pred-2',
    predictions: [{ predictedRisk: 45, predictedWorsening: false }],
  };
  assert.equal(normalizeIncident(withMedRisk)?.priority, 'MEDIUM');
}
console.log('✓ Test 9 passed: Priority derived from predictions when explicit priority absent');

// 10. Updates synthesized in chronological order
{
  const withUpdates = {
    id: 'update-seq-1',
    createdAt: '2026-11-15T10:00:00.000Z',
    reports: [
      { id: 'r1', content: 'First report', createdAt: '2026-11-15T10:10:00.000Z' },
      { id: 'r2', content: 'Second report', createdAt: '2026-11-15T10:20:00.000Z' },
    ],
    dispatchPlans: [
      { id: 'dp1', status: 'PENDING', createdAt: '2026-11-15T10:15:00.000Z' },
    ],
  };
  const normalized = normalizeIncident(withUpdates);
  assert.ok(normalized);
  assert.equal(normalized.updates.length, 4);
  assert.equal(normalized.updates[0].content, 'Second report'); // latest first
  assert.equal(normalized.updates[1].type, 'DISPATCH');
  assert.equal(normalized.updates[2].content, 'First report');
  assert.equal(normalized.updates[3].id, 'init');
}
console.log('✓ Test 10 passed: Updates synthesized correctly in reverse chronological order');

console.log('--- All incidentService tests passed successfully! ---');
