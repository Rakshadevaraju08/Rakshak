const assert = require('node:assert/strict');
const test = require('node:test');
const { AnalysisInputError, buildDisasterAnalysisContext } = require('../src/services/aiContext');

const incidentDate = new Date('2026-11-12T10:00:00.000Z');

function incident(overrides = {}) {
  return {
    id: 'test-incident',
    type: 'FLOOD',
    locationLat: 0,
    locationLng: 77.5,
    victimCount: 4,
    elderlyCount: null,
    childrenCount: 1,
    disabledCount: null,
    waterLevel: null,
    rainfall: null,
    roadAccess: null,
    createdAt: incidentDate,
    updatedAt: incidentDate,
    ...overrides
  };
}

test('builds a schema-compatible flood context using observed values and capacities', () => {
  const result = buildDisasterAnalysisContext({
    incident: incident({ waterLevel: 1.25, rainfall: 24 }),
    resources: [{
      id: 'resource-1',
      type: 'AMBULANCE',
      status: 'AVAILABLE',
      locationLat: null,
      locationLng: null
    }],
    hospitals: [
      {
        id: 'hospital-with-capacity',
        name: 'District Hospital',
        locationLat: 12.9,
        locationLng: 77.5,
        capacities: [{ totalBeds: 80, available: 21 }]
      },
      {
        id: 'hospital-without-capacity',
        name: 'Unmeasured Hospital',
        locationLat: 12.8,
        locationLng: 77.4,
        capacities: []
      }
    ],
    roads: [{ id: 'road-1', name: 'River Road', status: 'HAZARDOUS' }],
    weatherObservations: [
      { locationLat: 0, locationLng: 77.5, rainfallMm: 30, timestamp: new Date('2026-11-12T10:00:00.000Z') },
      { locationLat: 0, locationLng: 77.5, rainfallMm: 20, timestamp: new Date('2026-11-12T09:00:00.000Z') }
    ],
    waterLevelObservations: [
      { locationLat: 0, locationLng: 77.5, levelMeters: 2, timestamp: new Date('2026-11-12T10:00:00.000Z') },
      { locationLat: 0, locationLng: 77.5, levelMeters: 1.5, timestamp: new Date('2026-11-12T09:00:00.000Z') }
    ]
  });

  assert.equal(result.context.incident.latitude, 0);
  assert.equal(result.context.incident.children_count, 1);
  assert.equal(Object.hasOwn(result.context.incident, 'elderly_count'), false);
  assert.equal(Object.hasOwn(result.context.incident, 'disabled_count'), false);
  assert.deepEqual(result.context.incident.water_level, {
    value: 1.25,
    source: 'INCIDENT_RECORD',
    timestamp: incidentDate.toISOString()
  });
  assert.deepEqual(result.context.incident.rainfall, {
    value: 24,
    source: 'INCIDENT_RECORD',
    timestamp: incidentDate.toISOString()
  });
  assert.deepEqual(result.context.resources[0], {
    id: 'resource-1',
    type: 'AMBULANCE',
    status: 'AVAILABLE'
  });
  assert.deepEqual(result.context.hospitals, [{
    id: 'hospital-with-capacity',
    name: 'District Hospital',
    latitude: 12.9,
    longitude: 77.5,
    total_beds: 80,
    available_beds: 21
  }]);
  assert.equal(result.context.roads[0].status, 'ROUTE_UNAVAILABLE');
  assert.equal(result.context.environment.rainfall_trend_mm_per_hour, 10);
  assert.equal(result.context.environment.water_level_trend_m_per_hour, 0.5);
  assert(result.warnings.some(warning => warning.includes('Hospitals without valid coordinates')));
});

test('preserves supported types and safely normalizes unsupported types without mutating input', () => {
  const fire = buildDisasterAnalysisContext({ incident: incident({ type: 'fire' }) });
  assert.equal(fire.context.incident.type, 'FIRE');

  const landslide = buildDisasterAnalysisContext({ incident: incident({ type: 'LANDSLIDE' }) });
  assert.equal(landslide.context.incident.type, 'LANDSLIDE');

  const original = incident({ type: 'UNRECOGNIZED' });
  const other = buildDisasterAnalysisContext({
    incident: original,
    roads: [{ id: 'road-2', name: 'Unknown Road', status: 'UNRECOGNIZED' }]
  });
  assert.equal(other.context.incident.type, 'OTHER');
  assert.equal(other.context.incident.source, 'RAKSHAK_BACKEND; original_type=UNRECOGNIZED');
  assert.equal(original.type, 'UNRECOGNIZED');
  assert.equal(other.context.roads[0].status, 'ROUTE_UNAVAILABLE');
  assert(other.warnings.some(warning => warning.includes('Unsupported incident category')));
});

test('recovers labeled historical category and victim count without inventing missing values', () => {
  const recovered = buildDisasterAnalysisContext({
    incident: incident({
      type: 'OTHER',
      victimCount: null,
      title: 'SOS: Flood Emergency',
      description: 'Category: Flood\nPeople needing help: 7\nAdditional details: Water entering the house.'
    })
  });

  assert.equal(recovered.context.incident.type, 'FLOOD');
  assert.equal(recovered.context.incident.victim_count, 7);
  assert(recovered.context.incident.source.includes('type_inferred_from_description'));
  assert(recovered.context.incident.source.includes('victim_count_inferred_from_description'));

  const missing = buildDisasterAnalysisContext({
    incident: incident({
      type: 'OTHER',
      victimCount: null,
      description: 'Category: Other\nAdditional details: Number of people unknown.'
    })
  });
  assert.equal(missing.context.incident.type, 'OTHER');
  assert.equal(missing.context.incident.victim_count, null);
  assert(!missing.warnings.some(warning => warning.includes('Victim count was recovered')));
});

test('omits absent sensor and hospital data and rejects missing incident coordinates', () => {
  const result = buildDisasterAnalysisContext({
    incident: incident({ waterLevel: null, rainfall: Number.NaN }),
    hospitals: [{
      id: 'hospital-no-capacity',
      name: 'Hospital',
      locationLat: 12,
      locationLng: 77,
      capacities: []
    }]
  });

  assert.equal(Object.hasOwn(result.context.incident, 'water_level'), false);
  assert.equal(Object.hasOwn(result.context.incident, 'rainfall'), false);
  assert.equal(result.context.hospitals.length, 0);
  assert.throws(
    () => buildDisasterAnalysisContext({ incident: incident({ locationLat: null }) }),
    AnalysisInputError
  );
});

test('excludes observations not recorded at the incident coordinates from trend estimates', () => {
  const result = buildDisasterAnalysisContext({
    incident: incident(),
    weatherObservations: [
      { locationLat: 1, locationLng: 77.5, rainfallMm: 30, timestamp: new Date('2026-11-12T10:00:00.000Z') },
      { locationLat: 1, locationLng: 77.5, rainfallMm: 20, timestamp: new Date('2026-11-12T09:00:00.000Z') }
    ]
  });

  assert.deepEqual(result.context.environment, {});
  assert(result.warnings.some(warning => warning.includes('other coordinates were excluded')));
});
