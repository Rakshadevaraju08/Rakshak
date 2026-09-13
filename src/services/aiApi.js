export const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || '';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRoadStatus = (road) => {
  if (road?.status) return road.status;
  if (road?.blocked === true) return 'BLOCKED';
  if (road?.blocked === 'PARTIAL') return 'PARTIAL';
  return 'OPEN';
};

const normalizeResourceStatus = (status) => {
  const normalized = String(status || 'AVAILABLE').toUpperCase();

  if (normalized === 'BUSY') {
    return 'MAINTENANCE';
  }

  if (['AVAILABLE', 'DISPATCHED', 'MAINTENANCE'].includes(normalized)) {
    return normalized;
  }

  return 'AVAILABLE';
};

const getRoadCoordinates = (road) => {
  if (Array.isArray(road?.routePoints) && road.routePoints.length > 0) {
    return road.routePoints[0];
  }

  if (Number.isFinite(road?.latitude) && Number.isFinite(road?.longitude)) {
    return [road.latitude, road.longitude];
  }

  return [0, 0];
};

export function buildDisasterAnalysisRequest({
  incident,
  resources = [],
  hospitals = [],
  roads = [],
  environment = {},
}) {
  if (!incident) {
    throw new Error('No incident selected for AI analysis.');
  }

  const now = new Date().toISOString();
  const incidentType = String(incident.disasterType || incident.type || 'OTHER').toUpperCase();

  return {
    incident: {
      id: incident.id,
      type: incidentType,
      timestamp: now,
      source: 'OPERATOR_DASHBOARD',
      confidence: 0.96,
      latitude: toNumber(incident.latitude, 0),
      longitude: toNumber(incident.longitude, 0),
      victim_count: toNumber(incident.victims, 0),
      critical_victim_count: toNumber(
        incident.criticalVictims ?? Math.max(0, Math.round((incident.victims ?? 0) * 0.3)),
        0
      ),
      elderly_count: toNumber(incident.elderlyCount ?? incident.vulnerable ?? 0, 0),
      children_count: toNumber(incident.childrenCount ?? 0, 0),
      disabled_count: toNumber(incident.disabledCount ?? 0, 0),
      water_level:
        incident.waterLevel != null
          ? {
              value: toNumber(incident.waterLevel, 0),
              source: 'OPERATOR_DASHBOARD',
              timestamp: now,
              confidence: 0.85,
              quality: 'VALID',
              sensor_id: 'dashboard-water-level',
            }
          : null,
      rainfall: {
        value: toNumber(environment.rainfallCurrent ?? incident.rainfall ?? 18, 0),
        source: 'OPERATOR_DASHBOARD',
        timestamp: now,
        confidence: 0.85,
        quality: 'VALID',
        sensor_id: 'dashboard-rainfall',
      },
      road_access: roads.some((road) => road?.blocked) ? 'BLOCKED' : 'OPEN',
    },
    resources: resources.map((resource) => ({
      id: resource.id,
      type: resource.type || 'AMBULANCE',
      status: normalizeResourceStatus(resource.status),
      timestamp: now,
      source: 'OPERATOR_DASHBOARD',
      confidence: 0.95,
      latitude: toNumber(resource.latitude, 0),
      longitude: toNumber(resource.longitude, 0),
      capacity: toNumber(resource.capacity, 0) || undefined,
    })),
    hospitals: hospitals.map((hospital) => ({
      id: hospital.id,
      name: hospital.name,
      latitude: toNumber(hospital.latitude, 0),
      longitude: toNumber(hospital.longitude, 0),
      total_beds: toNumber(hospital.totalBeds ?? hospital.capacity ?? 0, 0),
      available_beds: toNumber(hospital.availableBeds ?? hospital.capacity ?? 0, 0),
    })),
    roads: roads.map((road) => {
      const [latitude, longitude] = getRoadCoordinates(road);
      return {
        id: road.id,
        name: road.name || road.id,
        latitude: toNumber(latitude, 0),
        longitude: toNumber(longitude, 0),
        status: normalizeRoadStatus(road),
      };
    }),
    environment: {
      timestamp: now,
      source: 'OPERATOR_DASHBOARD',
      confidence: 0.9,
      general_weather: environment.general_weather || 'Variable conditions',
      temperature_celsius: toNumber(environment.temperature_celsius ?? 24, 24),
      forecast_summary:
        environment.forecast_summary || 'Operator dashboard is monitoring current field conditions.',
      rainfall_trend_mm_per_hour: toNumber(environment.rainfall_trend_mm_per_hour ?? 12, 12),
      water_level_trend_m_per_hour: toNumber(
        environment.water_level_trend_m_per_hour ?? 0.3,
        0.3
      ),
    },
  };
}

export async function analyzeIncident(payload) {
  if (!AI_SERVICE_URL) {
    throw new Error(
      'AI service configuration is missing. Set VITE_AI_SERVICE_URL to the FastAPI service base URL.'
    );
  }

  const baseUrl = AI_SERVICE_URL.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/api/ai/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    let message = 'AI analysis failed. Please try again.';

    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data.detail)) {
        message = data.detail
          .map((item) => item.msg || item.message || 'Validation error')
          .join('; ');
      } else if (typeof data.message === 'string') {
        message = data.message;
      } else if (typeof data.detail === 'string') {
        message = data.detail;
      }
    } else if (typeof data === 'string' && data.trim()) {
      message = data;
    }

    throw new Error(message);
  }

  return data;
}
