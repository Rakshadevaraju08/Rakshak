const prisma = require('../utils/prisma');
const { requestAIAnalysis } = require('./ai');
const { buildDisasterAnalysisContext } = require('./aiContext');

async function createPlan(incidentId) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) { const error = new Error('Incident not found'); error.code = 'P2025'; throw error; }
  const [resources, hospitals, roads, weatherObservations, waterLevelObservations] = await Promise.all([
    prisma.resource.findMany({ where: { status: 'AVAILABLE' } }),
    prisma.hospital.findMany({ include: { capacities: { orderBy: { updatedAt: 'desc' }, take: 1 } } }),
    prisma.road.findMany(),
    prisma.weatherObservation.findMany({
      where: { locationLat: incident.locationLat, locationLng: incident.locationLng },
      orderBy: { timestamp: 'desc' },
      take: 2,
    }),
    prisma.waterLevel.findMany({
      where: { locationLat: incident.locationLat, locationLng: incident.locationLng },
      orderBy: { timestamp: 'desc' },
      take: 2,
    }),
  ]);
  const { context } = buildDisasterAnalysisContext({
    incident,
    resources,
    hospitals,
    roads,
    weatherObservations,
    waterLevelObservations,
  });
  const recommendation = await requestAIAnalysis(context);
  return prisma.dispatchPlan.create({
    data: { incidentId, status: 'PENDING', details: recommendation },
  });
}

module.exports = { createPlan };
