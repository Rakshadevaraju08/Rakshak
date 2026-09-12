// Mock data service for the Operator Dashboard
// This allows the UI to be built and tested before all backend endpoints exist.

export async function fetchMockIncidents(regionCenter) {
  const [lat, lng] = regionCenter || [12.2958, 76.6394];
  return new Promise((resolve) => setTimeout(() => resolve([
    {
      id: 'INC-MOCK-001',
      title: 'Flash Flood on Main Arterial',
      description: 'Rapid water rise blocking transport.',
      status: 'NEW',
      locationLat: lat + 0.005,
      locationLng: lng + 0.005,
      victimCount: 15,
      elderlyCount: 3,
      childrenCount: 4,
      waterLevel: 2.1,
      createdAt: new Date(Date.now() - 1200000).toISOString(),
      updatedAt: new Date(Date.now() - 60000).toISOString()
    },
    {
      id: 'INC-MOCK-002',
      title: 'Medical Emergency - Heart Attack',
      description: 'Patient requires immediate airlift.',
      status: 'ANALYZING',
      locationLat: lat - 0.015,
      locationLng: lng + 0.01,
      victimCount: 1,
      elderlyCount: 1,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 300000).toISOString()
    }
  ]), 400));
}

export async function fetchDashboardMetrics() {
  return new Promise((resolve) => setTimeout(() => resolve({
    activeIncidents: 42,
    criticalIncidents: 8,
    availableResources: { total: 120, active: 45, idle: 75 },
    hospitals: { total: 12, withCapacity: 8, critical: 4 }
  }), 300));
}

export async function fetchPredictiveRisks() {
  return new Promise((resolve) => setTimeout(() => resolve([
    { id: 'R-001', type: 'warning', title: 'Flash Flood Risk', description: 'Heavy rainfall upstream likely to affect Zone 4 in 2 hours.' },
    { id: 'R-002', type: 'error', title: 'Power Grid Failure', description: 'Substation Alpha at critical load. Expect outages in North Sector.' }
  ]), 300));
}

export async function fetchActiveOperations() {
  return new Promise((resolve) => setTimeout(() => resolve([
    { id: 'OP-112', title: 'Evacuate Sector 7', units: 4, status: 'EN_ROUTE' },
    { id: 'OP-113', title: 'Medical Supply Drop', units: 1, status: 'DISPATCHED' }
  ]), 300));
}
export async function fetchMapEntities(regionCenter) {
  // Return some mock hospitals and resources clustered around the region center
  const [lat, lng] = regionCenter || [12.2958, 76.6394];
  
  return new Promise((resolve) => setTimeout(() => resolve({
    hospitals: [
      { id: 'H-01', name: 'General Hospital', locationLat: lat + 0.02, locationLng: lng + 0.01, availableBeds: 45, totalBeds: 200 },
      { id: 'H-02', name: 'City Medical', locationLat: lat - 0.015, locationLng: lng - 0.02, availableBeds: 5, totalBeds: 120 }
    ],
    resources: [
      { id: 'R-01', name: 'Ambulance 4A', type: 'AMBULANCE', status: 'AVAILABLE', locationLat: lat + 0.01, locationLng: lng - 0.01 },
      { id: 'R-02', name: 'Rescue Team Bravo', type: 'RESCUE_TEAM', status: 'DISPATCHED', locationLat: lat - 0.005, locationLng: lng + 0.025 }
    ],
    routes: [
      // Mock active route from Ambulance 4A to an incident
      { id: 'RT-01', coordinates: [[lat + 0.01, lng - 0.01], [lat, lng]] }
    ]
  }), 200));
}
export async function fetchSystemEvents() {
  return new Promise((resolve) => setTimeout(() => resolve([
    { id: 'E-991', timestamp: Date.now() - 60000, message: 'New SOS received from Mesh Node 42', type: 'info' },
    { id: 'E-992', timestamp: Date.now() - 300000, message: 'Resource Unit Ambulance-03 status changed to Idle', type: 'info' },
    { id: 'E-993', timestamp: Date.now() - 1800000, message: 'AI Situation Agent completed analysis for INC-084', type: 'success' },
    { id: 'E-994', timestamp: Date.now() - 3600000, message: 'Connection lost to Hospital Gateway 2', type: 'error' }
  ]), 300));
}
