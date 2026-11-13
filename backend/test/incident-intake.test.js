const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');

const prismaModulePath = require.resolve('../src/utils/prisma');
const eventsModulePath = require.resolve('../src/services/events');
const apiModulePath = require.resolve('../src/routes/api');
const originalPrismaModule = require.cache[prismaModulePath];
const originalEventsModule = require.cache[eventsModulePath];
const originalApiModule = require.cache[apiModulePath];

const savedIncidents = [];
const prismaMock = {
  incident: {
    async create({ data }) {
      const incident = { id: `test-${savedIncidents.length + 1}`, ...data };
      savedIncidents.push(incident);
      return incident;
    }
  }
};

require.cache[prismaModulePath] = {
  id: prismaModulePath,
  filename: prismaModulePath,
  loaded: true,
  exports: prismaMock
};
require.cache[eventsModulePath] = {
  id: eventsModulePath,
  filename: eventsModulePath,
  loaded: true,
  exports: { publish: async () => {}, subscribe: () => {} }
};
delete require.cache[apiModulePath];

const api = require('../src/routes/api');

function restoreModule(path, original) {
  if (original) require.cache[path] = original;
  else delete require.cache[path];
}

async function postSOS(baseUrl, body) {
  return fetch(`${baseUrl}/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('POST /sos stores category and victim count while preserving the original description', async () => {
  const app = express();
  app.use(express.json());
  app.use(api);
  const server = app.listen(0);

  try {
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const floodDescription = 'Category: Flood\nPeople needing help: 7\nAdditional details: Water entering the house.';
    const floodResponse = await postSOS(baseUrl, {
      title: 'SOS: Flood Emergency',
      description: floodDescription,
      locationLat: 12.97,
      locationLng: 77.59
    });
    assert.equal(floodResponse.status, 201);
    const floodSaved = await floodResponse.json();
    assert.equal(floodSaved.type, 'FLOOD');
    assert.equal(floodSaved.victimCount, 7);
    assert.equal(floodSaved.locationLat, 12.97);
    assert.equal(floodSaved.locationLng, 77.59);
    assert.equal(floodSaved.description, floodDescription);

    const fireDescription = 'Category: Fire\nPeople needing help: 4\nAdditional details: Smoke on the second floor.';
    const fireResponse = await postSOS(baseUrl, {
      title: 'SOS: Fire Emergency',
      description: fireDescription,
      locationLat: 13.01,
      locationLng: 77.6
    });
    assert.equal(fireResponse.status, 201);
    const fireSaved = await fireResponse.json();
    assert.equal(fireSaved.type, 'FIRE');
    assert.equal(fireSaved.victimCount, 4);
    assert.equal(fireSaved.description, fireDescription);

    const missingResponse = await postSOS(baseUrl, {
      title: 'Emergency SOS',
      description: 'Category: Other\nAdditional details: Please confirm the number of people.',
      locationLat: 13.02,
      locationLng: 77.61
    });
    assert.equal(missingResponse.status, 201);
    const missingSaved = await missingResponse.json();
    assert.equal(missingSaved.type, 'OTHER');
    assert.equal(missingSaved.victimCount, null);
    assert.equal(missingSaved.description, 'Category: Other\nAdditional details: Please confirm the number of people.');

    assert.deepEqual(
      savedIncidents.map(({ type, victimCount }) => ({ type, victimCount })),
      [
        { type: 'FLOOD', victimCount: 7 },
        { type: 'FIRE', victimCount: 4 },
        { type: 'OTHER', victimCount: null }
      ]
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreModule(apiModulePath, originalApiModule);
    restoreModule(eventsModulePath, originalEventsModule);
    restoreModule(prismaModulePath, originalPrismaModule);
  }
});

test('supports explicit LANDSLIDE and recovers legacy OTHER/null fields from labeled description data', () => {
  const { buildSOSIncidentFields, resolveHistoricalIncidentFields } = require('../src/services/incidentIntake');
  assert.deepEqual(buildSOSIncidentFields({ type: 'landslide', victimCount: 2 }), {
    type: 'LANDSLIDE',
    victimCount: 2
  });

  assert.deepEqual(resolveHistoricalIncidentFields({
    type: 'OTHER',
    title: 'SOS: Flood Emergency',
    description: 'Category: Flood\nPeople needing help: 7',
    victimCount: null
  }), {
    type: 'FLOOD',
    victimCount: 7,
    typeInferredFromDescription: true,
    typeInferredFromTitle: false,
    victimCountInferredFromDescription: true
  });

  assert.deepEqual(resolveHistoricalIncidentFields({
    type: 'OTHER',
    title: 'Emergency SOS',
    description: 'Category: Other',
    victimCount: null
  }), {
    type: 'OTHER',
    victimCount: null,
    typeInferredFromDescription: true,
    typeInferredFromTitle: false,
    victimCountInferredFromDescription: false
  });
});
