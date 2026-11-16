const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');

const modulePaths = [
  require.resolve('../src/utils/prisma'),
  require.resolve('../src/services/events'),
  require.resolve('../src/services/dispatch'),
  require.resolve('../src/services/ai'),
  require.resolve('../src/services/aiContext'),
  require.resolve('../src/routes/api'),
];
const originalModules = new Map(modulePaths.map(path => [path, require.cache[path]]));
const savedPlans = [];
let incident = {
  id: 'incident-1',
  title: 'Flood report',
  description: 'Water is entering homes.',
  type: 'FLOOD',
  status: 'NEW',
  locationLat: 12.9,
  locationLng: 77.5,
  victimCount: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
};
const prismaMock = {
  incident: { async findUnique() { return incident; } },
  resource: { async findMany() { return []; } },
  hospital: { async findMany() { return []; } },
  road: { async findMany() { return []; } },
  weatherObservation: { async findMany() { return []; } },
  waterLevel: { async findMany() { return []; } },
  dispatchPlan: {
    async create({ data }) {
      const plan = { id: `plan-${savedPlans.length + 1}`, ...data };
      savedPlans.push(plan);
      return plan;
    },
  },
};

class AnalysisInputError extends Error {
  constructor(message) {
    super(message);
    this.code = 'INVALID_ANALYSIS_INPUT';
  }
}

require.cache[modulePaths[0]] = {
  id: modulePaths[0],
  filename: modulePaths[0],
  loaded: true,
  exports: prismaMock,
};
require.cache[modulePaths[1]] = {
  id: modulePaths[1],
  filename: modulePaths[1],
  loaded: true,
  exports: { publish: async () => {}, subscribe: () => {} },
};
require.cache[modulePaths[2]] = {
  id: modulePaths[2],
  filename: modulePaths[2],
  loaded: true,
  exports: { createPlan: async () => null },
};
require.cache[modulePaths[3]] = {
  id: modulePaths[3],
  filename: modulePaths[3],
  loaded: true,
  exports: { requestAIAnalysis: async context => ({
    incident_id: context.incident.id,
    recommended_action: 'MONITOR',
    assignments: [],
    explanation: [],
    warnings: [],
    provenance: [],
    overall_confidence: 0.6,
    human_review_required: true,
    fallback_used: false,
    degraded: false,
  }) },
};
require.cache[modulePaths[4]] = {
  id: modulePaths[4],
  filename: modulePaths[4],
  loaded: true,
  exports: {
    AnalysisInputError,
    buildDisasterAnalysisContext: ({ incident: source }) => ({ context: { incident: { id: source.id } }, warnings: [] }),
  },
};
delete require.cache[modulePaths[5]];
const api = require('../src/routes/api');

async function postAnalysis(baseUrl, id = 'incident-1') {
  return fetch(`${baseUrl}/incidents/${id}/analyze`, { method: 'POST' });
}

test('analysis creates auditable pending plan versions and rejects missing GPS before plan creation', async () => {
  const app = express();
  app.use(express.json());
  app.use(api);
  const server = app.listen(0);

  try {
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const first = await postAnalysis(baseUrl);
    const second = await postAnalysis(baseUrl);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(savedPlans.length, 2);
    assert.deepEqual(savedPlans.map(plan => plan.status), ['PENDING', 'PENDING']);
    assert.notEqual(savedPlans[0].id, savedPlans[1].id);

    incident = { ...incident, id: 'incident-no-gps', locationLat: null, locationLng: null };
    const missingGps = await postAnalysis(baseUrl, 'incident-no-gps');
    assert.equal(missingGps.status, 400);
    assert.match((await missingGps.json()).message, /latitude and longitude/i);
    assert.equal(savedPlans.length, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    modulePaths.forEach((path, index) => {
      if (originalModules.get(path)) require.cache[path] = originalModules.get(path);
      else delete require.cache[path];
    });
  }
});
