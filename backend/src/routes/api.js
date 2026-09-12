const express = require('express');
const prisma = require('../utils/prisma');
const { publish, subscribe } = require('../services/events');
const { createPlan } = require('../services/dispatch');
const { requestAIAnalysis } = require('../services/ai');
const { requireRole, signToken } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
const ops = requireRole('OPERATOR', 'ADMIN');
const pick = (body, keys) => Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const passwordMatches = (password, stored) => {
  if (typeof password !== 'string' || !stored) return false;
  const [salt, digest] = stored.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return digest.length === candidate.length && crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(candidate));
};

router.post('/auth/register', async (req, res, next) => { try { const { email, password, name } = req.body; if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'email and a password of at least 8 characters are required' }); const user = await prisma.user.create({ data: { email: email.toLowerCase().trim(), name, passwordHash: hashPassword(password) } }); const token = signToken(user); res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token }); } catch (e) { next(e); } });
router.post('/auth/login', async (req, res, next) => { try { const { email, password } = req.body; const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } }); if (!user || !passwordMatches(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid email or password' }); const token = signToken(user); res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token }); } catch (e) { next(e); } });

router.get('/events', subscribe);

router.post('/sos', async (req, res, next) => {
  try {
    const { title = 'Emergency SOS', description, locationLat, locationLng, reporterId } = req.body;
    const incident = await prisma.incident.create({ data: { title, description, locationLat, locationLng, reporterId } });
    await publish('SOS_RECEIVED', incident);
    res.status(201).json(incident);
  } catch (error) { next(error); }
});

router.get('/incidents', async (req, res, next) => { try { res.json(await prisma.incident.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { next(e); } });
router.get('/incidents/:id', async (req, res, next) => { try { const incident = await prisma.incident.findUnique({ where: { id: req.params.id }, include: { reports: true, predictions: true, dispatchPlans: true } }); if (!incident) return res.status(404).json({ error: 'Incident not found' }); res.json(incident); } catch (e) { next(e); } });
router.patch('/incidents/:id', ops, async (req, res, next) => { try { const incident = await prisma.incident.update({ where: { id: req.params.id }, data: pick(req.body, ['title', 'description', 'status', 'locationLat', 'locationLng']) }); await publish('INCIDENT_UPDATED', incident); res.json(incident); } catch (e) { next(e); } });
router.post('/incidents/:id/reports', async (req, res, next) => { try { if (typeof req.body.content !== 'string' || !req.body.content.trim()) return res.status(400).json({ error: 'content is required' }); const report = await prisma.incidentReport.create({ data: { incidentId: req.params.id, content: req.body.content.trim() } }); await publish('INCIDENT_REPORT_RECEIVED', report); res.status(201).json(report); } catch (e) { next(e); } });
router.post('/incidents/:id/outcomes', ops, async (req, res, next) => { try { if (typeof req.body.resolution !== 'string' || !req.body.resolution.trim()) return res.status(400).json({ error: 'resolution is required' }); const outcome = await prisma.incidentOutcome.create({ data: { incidentId: req.params.id, resolution: req.body.resolution.trim(), feedback: req.body.feedback } }); const incident = await prisma.incident.update({ where: { id: req.params.id }, data: { status: 'RESOLVED' } }); await publish('INCIDENT_RESOLVED', { incident, outcome }); res.status(201).json(outcome); } catch (e) { next(e); } });

router.get('/resources', async (req, res, next) => { try { res.json(await prisma.resource.findMany({ include: { ambulances: true, rescueTeams: true } })); } catch (e) { next(e); } });
router.post('/resources', ops, async (req, res, next) => { try { const { type, name, plateNumber, personnel } = req.body; if (!['AMBULANCE', 'RESCUE_TEAM'].includes(type) || !name) return res.status(400).json({ error: 'type (AMBULANCE or RESCUE_TEAM) and name are required' }); const data = pick(req.body, ['type', 'name', 'status', 'locationLat', 'locationLng']); if (type === 'AMBULANCE' && plateNumber) data.ambulances = { create: { plateNumber } }; if (type === 'RESCUE_TEAM' && Number.isInteger(personnel)) data.rescueTeams = { create: { personnel } }; const resource = await prisma.resource.create({ data, include: { ambulances: true, rescueTeams: true } }); await publish('RESOURCE_AVAILABLE', resource); res.status(201).json(resource); } catch (e) { next(e); } });
router.patch('/resources/:id', ops, async (req, res, next) => { try { const resource = await prisma.resource.update({ where: { id: req.params.id }, data: pick(req.body, ['name', 'status', 'locationLat', 'locationLng']) }); await publish(resource.status === 'AVAILABLE' ? 'RESOURCE_AVAILABLE' : 'RESOURCE_UNAVAILABLE', resource); res.json(resource); } catch (e) { next(e); } });

router.get('/hospitals', async (req, res, next) => { try { res.json(await prisma.hospital.findMany({ include: { capacities: { orderBy: { updatedAt: 'desc' }, take: 1 } } })); } catch (e) { next(e); } });
router.post('/hospitals', ops, async (req, res, next) => { try { const { name, locationLat, locationLng, totalBeds, available } = req.body; if (!name) return res.status(400).json({ error: 'name is required' }); const data = { name, locationLat, locationLng }; if (Number.isInteger(totalBeds) && Number.isInteger(available)) data.capacities = { create: { totalBeds, available } }; const hospital = await prisma.hospital.create({ data, include: { capacities: true } }); await publish('HOSPITAL_CAPACITY_CHANGED', hospital); res.status(201).json(hospital); } catch (e) { next(e); } });
router.patch('/hospitals/:id/capacity', ops, async (req, res, next) => { try { const { totalBeds, available } = req.body; if (!Number.isInteger(totalBeds) || !Number.isInteger(available)) return res.status(400).json({ error: 'totalBeds and available must be integers' }); const capacity = await prisma.hospitalCapacity.create({ data: { hospitalId: req.params.id, totalBeds, available } }); if (available <= 0) await publish('HOSPITAL_FULL', capacity); else await publish('HOSPITAL_CAPACITY_CHANGED', capacity); res.json(capacity); } catch (e) { next(e); } });

router.get('/roads', async (req, res, next) => { try { res.json(await prisma.road.findMany()); } catch (e) { next(e); } });
router.post('/roads', ops, async (req, res, next) => { try { if (!req.body.name) return res.status(400).json({ error: 'name is required' }); const road = await prisma.road.create({ data: pick(req.body, ['name', 'status', 'incidentId']) }); await publish(road.status === 'BLOCKED' ? 'ROAD_BLOCKED' : 'ROAD_UPDATED', road); res.status(201).json(road); } catch (e) { next(e); } });
router.patch('/roads/:id', ops, async (req, res, next) => { try { const road = await prisma.road.update({ where: { id: req.params.id }, data: pick(req.body, ['name', 'status', 'incidentId']) }); await publish(road.status === 'BLOCKED' ? 'ROAD_BLOCKED' : 'ROAD_UPDATED', road); res.json(road); } catch (e) { next(e); } });

router.post('/dispatch/plan', ops, async (req, res, next) => { try { const plan = await createPlan(req.body.incidentId); await publish('DISPATCH_PLANNED', plan); res.status(201).json(plan); } catch (e) { next(e); } });
router.post('/dispatch/execute', ops, async (req, res, next) => { try { const plan = await prisma.dispatchPlan.update({ where: { id: req.body.planId }, data: { status: 'EXECUTED' } }); const ids = plan.details.recommendedResources || []; if (ids.length) await prisma.resource.updateMany({ where: { id: { in: ids } }, data: { status: 'DISPATCHED' } }); await publish('DISPATCH_APPROVED', plan); res.json(plan); } catch (e) { next(e); } });

router.post('/mesh/sync', async (req, res, next) => { try { const messages = Array.isArray(req.body) ? req.body : (Array.isArray(req.body.messages) ? req.body.messages : [req.body]); if (!messages.length || messages.some((message) => !message.senderId || message.payload === undefined)) return res.status(400).json({ error: 'Each mesh message requires senderId and payload' }); const saved = await Promise.all(messages.map(({ payload, senderId, receivedAt, incidentId }) => prisma.meshMessage.create({ data: { payload: typeof payload === 'string' ? payload : JSON.stringify(payload), senderId, receivedAt: receivedAt ? new Date(receivedAt) : undefined, incidentId } }))); await Promise.all(saved.map((message) => publish('MESH_MESSAGE_RECEIVED', message))); res.status(201).json({ synced: saved.length, messages: saved }); } catch (e) { next(e); } });

router.get('/predictions', async (req, res, next) => { try { res.json(await prisma.prediction.findMany({ orderBy: { timestamp: 'desc' }, include: { incident: true } })); } catch (e) { next(e); } });
router.post('/predictions', ops, async (req, res, next) => { try { const { predictedRisk, predictedWorsening, incidentId, weatherObservationId, waterLevelId } = req.body; if (typeof predictedRisk !== 'number' || typeof predictedWorsening !== 'boolean') return res.status(400).json({ error: 'predictedRisk (number) and predictedWorsening (boolean) are required' }); const prediction = await prisma.prediction.create({ data: { predictedRisk, predictedWorsening, incidentId, weatherObservationId, waterLevelId } }); await publish('PREDICTION_UPDATED', prediction); res.status(201).json(prediction); } catch (e) { next(e); } });
router.post('/observations/weather', ops, async (req, res, next) => { try { const { locationLat, locationLng, rainfallMm } = req.body; if (![locationLat, locationLng, rainfallMm].every((value) => typeof value === 'number')) return res.status(400).json({ error: 'locationLat, locationLng, and rainfallMm must be numbers' }); const observation = await prisma.weatherObservation.create({ data: { locationLat, locationLng, rainfallMm } }); await publish('WEATHER_CHANGED', observation); res.status(201).json(observation); } catch (e) { next(e); } });
router.post('/observations/water-levels', ops, async (req, res, next) => { try { const { locationLat, locationLng, levelMeters } = req.body; if (![locationLat, locationLng, levelMeters].every((value) => typeof value === 'number')) return res.status(400).json({ error: 'locationLat, locationLng, and levelMeters must be numbers' }); const observation = await prisma.waterLevel.create({ data: { locationLat, locationLng, levelMeters } }); await publish('WATER_LEVEL_CHANGED', observation); res.status(201).json(observation); } catch (e) { next(e); } });

router.post('/incidents/:id/analyze', ops, async (req, res, next) => {
  try {
    const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    
    const [resources, hospitals, roads, weatherObv, waterObv] = await Promise.all([
      prisma.resource.findMany({ where: { status: 'AVAILABLE' } }),
      prisma.hospital.findMany({ include: { capacities: { orderBy: { updatedAt: 'desc' }, take: 1 } } }),
      prisma.road.findMany(),
      prisma.weatherObservation.findFirst({ orderBy: { timestamp: 'desc' } }),
      prisma.waterLevel.findFirst({ orderBy: { timestamp: 'desc' } })
    ]);

    const context = {
      incident: {
        id: incident.id,
        type: incident.type || "OTHER",
        latitude: incident.locationLat || 0,
        longitude: incident.locationLng || 0,
        victim_count: incident.victimCount || 0,
        elderly_count: incident.elderlyCount || 0,
        children_count: incident.childrenCount || 0,
        disabled_count: incident.disabledCount || 0,
        water_level: incident.waterLevel !== null ? incident.waterLevel : null,
        rainfall: incident.rainfall !== null ? incident.rainfall : null,
        road_access: incident.roadAccess || "OPEN"
      },
      resources: resources.map(r => ({
        id: r.id,
        type: r.type,
        status: r.status,
        latitude: r.locationLat || 0,
        longitude: r.locationLng || 0
      })),
      hospitals: hospitals.map(h => ({
        id: h.id,
        name: h.name,
        latitude: h.locationLat || 0,
        longitude: h.locationLng || 0,
        available_beds: h.capacities?.[0]?.available || 0
      })),
      roads: roads.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status
      })),
      environment: {}
    };

    if (weatherObv || waterObv) {
      if (weatherObv) context.environment.rainfall_trend_mm_per_hour = weatherObv.rainfallMm;
      if (waterObv) context.environment.water_level_trend_m_per_hour = waterObv.levelMeters;
    }

    const aiRecommendation = await requestAIAnalysis(context);

    const plan = await prisma.dispatchPlan.create({
      data: {
        incidentId: incident.id,
        status: 'PENDING',
        details: aiRecommendation
      }
    });
    
    await publish('DISPATCH_PLANNED', plan);
    res.status(201).json(aiRecommendation);

  } catch (error) {
    if (error.code === 'AI_SERVICE_TIMEOUT' || error.code === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(error.status).json({
        error: error.code,
        message: error.message
      });
    }
    if (error.status === 422 || error.status === 400) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid disaster analysis request',
        details: error.details
      });
    }
    next(error);
  }
});

module.exports = router;
