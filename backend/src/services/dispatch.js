const prisma = require('../utils/prisma');
const { requestDispatchRecommendation } = require('./ai');

const distance = (a, b) => {
  if (![a.locationLat, a.locationLng, b.locationLat, b.locationLng].every(Number.isFinite)) return Number.MAX_SAFE_INTEGER;
  return (a.locationLat - b.locationLat) ** 2 + (a.locationLng - b.locationLng) ** 2;
};

async function createPlan(incidentId) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) { const error = new Error('Incident not found'); error.code = 'P2025'; throw error; }
  const [resources, hospitals, roads] = await Promise.all([
    prisma.resource.findMany({ where: { status: 'AVAILABLE' } }),
    prisma.hospital.findMany({ include: { capacities: { orderBy: { updatedAt: 'desc' }, take: 1 } } }),
    prisma.road.findMany({ where: { status: { not: 'BLOCKED' } } }),
  ]);
  const ranked = resources.sort((a, b) => distance(a, incident) - distance(b, incident));
  const hospital = hospitals.filter((h) => h.capacities[0]?.available > 0).sort((a, b) => distance(a, incident) - distance(b, incident))[0];
  const fallback = {
    incidentId, recommendedResources: ranked.slice(0, 3).map((r) => r.id),
    recommendedHospitalId: hospital?.id || null,
    usableRoadIds: roads.map((road) => road.id),
    notes: hospital ? 'Awaiting operator approval.' : 'No hospital capacity currently available; escalate to operator.',
  };
  const aiRecommendation = await requestDispatchRecommendation({ incident, resources: ranked, hospitals, roads });
  const details = { ...fallback, aiRecommendation };
  return prisma.dispatchPlan.create({ data: { incidentId, details } });
}

module.exports = { createPlan };
