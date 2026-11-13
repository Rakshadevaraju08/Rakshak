const INCIDENT_TYPES = new Set([
  'FLOOD',
  'EARTHQUAKE',
  'FIRE',
  'LANDSLIDE',
  'MEDICAL',
  'LOCALIZED_ACCIDENT',
  'OTHER'
]);
const RESOURCE_TYPES = new Set(['AMBULANCE', 'RESCUE_TEAM', 'FIRE_TRUCK', 'RESCUE_BOAT', 'MEDICAL_TEAM']);
const RESOURCE_STATUSES = new Set(['AVAILABLE', 'DISPATCHED', 'MAINTENANCE']);
const ROAD_STATUSES = new Set(['OPEN', 'PARTIAL', 'BLOCKED', 'ROUTE_UNAVAILABLE']);
const { resolveHistoricalIncidentFields } = require('./incidentIntake');

class AnalysisInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalysisInputError';
    this.code = 'AI_ANALYSIS_INPUT_INVALID';
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLatitude(value) {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

function isLongitude(value) {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

function toTimestamp(value) {
  if (value === null || value === undefined) return null;
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeIncidentType(value, warnings) {
  const originalType = typeof value === 'string' ? value.trim() : '';
  const normalized = originalType.toUpperCase();
  if (INCIDENT_TYPES.has(normalized)) {
    return { type: normalized, source: 'RAKSHAK_BACKEND' };
  }

  if (!originalType) {
    warnings.push('Incident category was missing; OTHER was used only in the AI request.');
    return { type: 'OTHER', source: 'RAKSHAK_BACKEND' };
  }

  if (normalized === 'ACCIDENT' || normalized === 'ROAD_ACCIDENT' || normalized === 'TRAFFIC_ACCIDENT') {
    warnings.push('Incident category was normalized to LOCALIZED_ACCIDENT for the AI request; the stored incident is unchanged.');
    return { type: 'LOCALIZED_ACCIDENT', source: `RAKSHAK_BACKEND; original_type=${originalType}` };
  }

  warnings.push('Unsupported incident category was normalized to OTHER for the AI request; the stored incident is unchanged.');
  return { type: 'OTHER', source: `RAKSHAK_BACKEND; original_type=${originalType}` };
}

function normalizeRoadStatus(value, warnings, label) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (ROAD_STATUSES.has(normalized)) return normalized;

  warnings.push(`${label} status was mapped to ROUTE_UNAVAILABLE for the AI request; the stored road data is unchanged.`);
  return 'ROUTE_UNAVAILABLE';
}

function makeObservation(value, timestamp) {
  if (!isFiniteNumber(value)) return null;
  const observation = { value, source: 'INCIDENT_RECORD' };
  const recordedAt = toTimestamp(timestamp);
  if (recordedAt) observation.timestamp = recordedAt;
  return observation;
}

function hourlyTrend(observations, valueKey) {
  const validObservations = observations
    .map(observation => {
      const timestamp = observation?.timestamp;
      return {
        value: observation?.[valueKey],
        timestamp: timestamp === null || timestamp === undefined
          ? Number.NaN
          : timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime()
      };
    })
    .filter(observation => isFiniteNumber(observation.value) && Number.isFinite(observation.timestamp))
    .sort((left, right) => right.timestamp - left.timestamp);

  if (validObservations.length < 2) return null;

  const [newest, previous] = validObservations;
  const elapsedHours = (newest.timestamp - previous.timestamp) / 3_600_000;
  if (elapsedHours <= 0) return null;

  const trend = (newest.value - previous.value) / elapsedHours;
  return isFiniteNumber(trend) ? trend : null;
}

function mapResource(resource, warnings) {
  const type = typeof resource.type === 'string' ? resource.type.trim().toUpperCase() : '';
  const status = typeof resource.status === 'string' ? resource.status.trim().toUpperCase() : '';
  if (!RESOURCE_TYPES.has(type) || !RESOURCE_STATUSES.has(status) || typeof resource.id !== 'string') {
    warnings.push('A resource with unsupported type, status, or identifier was omitted from the AI request.');
    return null;
  }

  const mapped = { id: resource.id, type, status };
  if (isLatitude(resource.locationLat)) mapped.latitude = resource.locationLat;
  if (isLongitude(resource.locationLng)) mapped.longitude = resource.locationLng;
  return mapped;
}

function mapHospital(hospital) {
  const capacity = Array.isArray(hospital.capacities) ? hospital.capacities[0] : null;
  if (
    typeof hospital.id !== 'string' ||
    typeof hospital.name !== 'string' ||
    !isLatitude(hospital.locationLat) ||
    !isLongitude(hospital.locationLng) ||
    !Number.isInteger(capacity?.totalBeds) ||
    capacity.totalBeds < 0 ||
    !Number.isInteger(capacity?.available) ||
    capacity.available < 0
  ) {
    return null;
  }

  return {
    id: hospital.id,
    name: hospital.name,
    latitude: hospital.locationLat,
    longitude: hospital.locationLng,
    total_beds: capacity.totalBeds,
    available_beds: capacity.available
  };
}

function buildDisasterAnalysisContext({
  incident,
  resources = [],
  hospitals = [],
  roads = [],
  weatherObservations = [],
  waterLevelObservations = []
}) {
  if (!isLatitude(incident.locationLat) || !isLongitude(incident.locationLng)) {
    throw new AnalysisInputError('Valid incident latitude and longitude are required by the AI service.');
  }

  const warnings = [];
  const resolvedIncident = resolveHistoricalIncidentFields(incident);
  const normalizedType = normalizeIncidentType(resolvedIncident.type, warnings);
  if (resolvedIncident.typeInferredFromDescription) {
    warnings.push('Incident category was recovered from the original description because the stored type was missing or OTHER.');
  }
  if (resolvedIncident.typeInferredFromTitle) {
    warnings.push('Incident category was recovered from the SOS title because the stored type was missing or OTHER.');
  }
  if (resolvedIncident.victimCountInferredFromDescription) {
    warnings.push('Victim count was recovered from the original description because the structured value was missing.');
  }
  const waterLevel = makeObservation(incident.waterLevel, incident.updatedAt);
  const rainfall = makeObservation(incident.rainfall, incident.updatedAt);

  const mappedResources = resources
    .map(resource => mapResource(resource, warnings))
    .filter(Boolean);
  const mappedHospitals = hospitals.map(mapHospital).filter(Boolean);
  if (mappedHospitals.length !== hospitals.length) {
    warnings.push('Hospitals without valid coordinates and a real capacity snapshot were omitted from the AI request.');
  }

  const mappedRoads = roads
    .filter(road => typeof road.name === 'string' && road.name.trim())
    .map(road => ({
      id: road.id,
      name: road.name,
      status: normalizeRoadStatus(road.status, warnings, 'Road')
    }));

  const incidentContext = {
    id: incident.id,
    type: normalizedType.type,
    source: [
      normalizedType.source,
      resolvedIncident.typeInferredFromDescription ? 'type_inferred_from_description' : null,
      resolvedIncident.typeInferredFromTitle ? 'type_inferred_from_title' : null,
      resolvedIncident.victimCountInferredFromDescription ? 'victim_count_inferred_from_description' : null
    ].filter(Boolean).join('; '),
    latitude: incident.locationLat,
    longitude: incident.locationLng,
    victim_count: resolvedIncident.victimCount,
    ...(Number.isInteger(incident.elderlyCount) && incident.elderlyCount >= 0
      ? { elderly_count: incident.elderlyCount }
      : {}),
    ...(Number.isInteger(incident.childrenCount) && incident.childrenCount >= 0
      ? { children_count: incident.childrenCount }
      : {}),
    ...(Number.isInteger(incident.disabledCount) && incident.disabledCount >= 0
      ? { disabled_count: incident.disabledCount }
      : {}),
    ...(toTimestamp(incident.createdAt) ? { timestamp: toTimestamp(incident.createdAt) } : {}),
    ...(waterLevel ? { water_level: waterLevel } : {}),
    ...(rainfall ? { rainfall } : {}),
    ...(incident.roadAccess
      ? { road_access: normalizeRoadStatus(incident.roadAccess, warnings, 'Incident road access') }
      : {})
  };

  const environment = {};
  // No station-radius configuration exists; never use another location's readings as incident trends.
  const incidentLocationObservations = observations => observations.filter(observation =>
    observation?.locationLat === incident.locationLat &&
    observation?.locationLng === incident.locationLng
  );
  const localWeatherObservations = incidentLocationObservations(weatherObservations);
  const localWaterLevelObservations = incidentLocationObservations(waterLevelObservations);
  if (localWeatherObservations.length !== weatherObservations.length) {
    warnings.push('Weather observations from other coordinates were excluded from incident trend analysis.');
  }
  if (localWaterLevelObservations.length !== waterLevelObservations.length) {
    warnings.push('Water-level observations from other coordinates were excluded from incident trend analysis.');
  }
  const rainfallTrend = hourlyTrend(localWeatherObservations, 'rainfallMm');
  const waterLevelTrend = hourlyTrend(localWaterLevelObservations, 'levelMeters');
  if (rainfallTrend !== null) environment.rainfall_trend_mm_per_hour = rainfallTrend;
  if (waterLevelTrend !== null) environment.water_level_trend_m_per_hour = waterLevelTrend;

  return {
    context: {
      incident: incidentContext,
      resources: mappedResources,
      hospitals: mappedHospitals,
      roads: mappedRoads,
      environment
    },
    warnings
  };
}

module.exports = { AnalysisInputError, buildDisasterAnalysisContext };
