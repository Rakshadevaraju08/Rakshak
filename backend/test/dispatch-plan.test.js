const assert = require('node:assert/strict');
const test = require('node:test');

const modulePaths = [
  require.resolve('../src/utils/prisma'),
  require.resolve('../src/services/ai'),
  require.resolve('../src/services/aiContext'),
  require.resolve('../src/services/dispatch'),
];
const originalModules = new Map(modulePaths.map(path => [path, require.cache[path]]));

const createdPlans = [];
const prismaMock = {
  incident: {
    async findUnique() {
      return {
        id: 'incident-1',
        type: 'FLOOD',
        locationLat: 12.9,
        locationLng: 77.5,
      };
    },
  },
  resource: { async findMany() { return []; } },
  hospital: { async findMany() { return []; } },
  road: { async findMany() { return []; } },
  weatherObservation: { async findMany() { return []; } },
  waterLevel: { async findMany() { return []; } },
  dispatchPlan: {
    async create({ data }) {
      const plan = { id: `plan-${createdPlans.length + 1}`, ...data };
      createdPlans.push(plan);
      return plan;
    },
  },
};

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
  exports: { requestAIAnalysis: async () => ({ incident_id: 'incident-1', recommended_action: 'MONITOR' }) },
};
require.cache[modulePaths[2]] = {
  id: modulePaths[2],
  filename: modulePaths[2],
  loaded: true,
  exports: {
    buildDisasterAnalysisContext: ({ incident, resources, hospitals, roads, weatherObservations, waterLevelObservations }) => {
      assert.equal(incident.id, 'incident-1');
      assert.deepEqual(resources, []);
      assert.deepEqual(hospitals, []);
      assert.deepEqual(roads, []);
      assert.deepEqual(weatherObservations, []);
      assert.deepEqual(waterLevelObservations, []);
      return { context: { incident: { id: incident.id } } };
    },
  },
};
delete require.cache[modulePaths[3]];
const { createPlan } = require('../src/services/dispatch');

test('dispatch plan creation uses the active AI analysis service and stores a pending version', async () => {
  try {
    const plan = await createPlan('incident-1');
    assert.equal(plan.status, 'PENDING');
    assert.equal(plan.incidentId, 'incident-1');
    assert.equal(plan.details.recommended_action, 'MONITOR');
    assert.equal(createdPlans.length, 1);
  } finally {
    modulePaths.forEach((path, index) => {
      if (originalModules.get(path)) require.cache[path] = originalModules.get(path);
      else delete require.cache[path];
    });
  }
});
