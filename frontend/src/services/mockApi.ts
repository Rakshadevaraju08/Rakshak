export type IncidentPriority = 1 | 2 | 3 | 4 | 5;
export type IncidentStatus = 'new' | 'active' | 'dispatched' | 'resolved' | 'queued';

export interface Incident {
  id: string;
  type: string;
  priority: IncidentPriority;
  victimCount: number;
  location: { lat: number; lng: number };
  timestamp: string;
  status: IncidentStatus;
  receivedVia: 'direct' | 'offline-sync';
  description?: string;
  contact?: string;
  mediaReferences?: string[];
  duplicateReportLinks?: string[];
}

export interface AgentResult { name: string; question: string; status: 'idle' | 'processing' | 'complete'; summary: string; }

const wait = (min = 300, max = 800) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.round(min + Math.random() * (max - min))));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

let roadBlocked = false;
let hospitalFull = false;
let rainfall = 42;
let waterLevel = 1.3;
let ambulanceAvailable = true;
let incidents: Incident[] = [
  { id: 'INC-MYS-104', type: 'Medical emergency', priority: 1, victimCount: 1, location: { lat: 12.3074, lng: 76.6444 }, timestamp: new Date(Date.now() - 5 * 60_000).toISOString(), status: 'active', receivedVia: 'direct', description: 'Unresponsive adult at a residential address. Family requests immediate medical aid.', contact: '+91 98••• 4412', mediaReferences: [], duplicateReportLinks: [] },
  { id: 'INC-MYS-111', type: 'Road obstruction', priority: 2, victimCount: 0, location: { lat: 12.2827, lng: 76.6326 }, timestamp: new Date(Date.now() - 13 * 60_000).toISOString(), status: 'new', receivedVia: 'offline-sync', description: 'Large fallen tree blocks both directions. Nearby residents are safe.', contact: '+91 97••• 8270', mediaReferences: ['road-photo-01.jpg'], duplicateReportLinks: ['RPT-873'] },
  { id: 'INC-ASM-208', type: 'Flood rescue', priority: 1, victimCount: 4, location: { lat: 26.1445, lng: 91.7362 }, timestamp: new Date(Date.now() - 9 * 60_000).toISOString(), status: 'dispatched', receivedVia: 'direct', description: 'Family isolated by rising water on the first floor. Rescue boat access requested.', contact: '+91 88••• 1138', mediaReferences: ['voice-note-208.mp3'], duplicateReportLinks: [] },
];

export async function getIncidents() { await wait(); return clone(incidents.filter((incident) => incident.status !== 'queued')); }
export async function getIncidentDetail(id: string) { await wait(); const incident = incidents.find((item) => item.id === id); if (!incident) throw new Error('Incident not found'); return clone(incident); }
export async function getDispatchPlan(incidentId: string) {
  await wait();
  const incident = incidents.find((item) => item.id === incidentId); if (!incident) throw new Error('Incident not found');
  const flood = incident.type.toLowerCase().includes('flood');
  return {
    assignedResource: ambulanceAvailable ? (flood ? 'Rescue Boat 2' : 'Ambulance Medic-4') : 'Rescue Unit Delta-3',
    route: roadBlocked ? 'Alternate safe corridor via Sector B' : 'Fastest verified route via primary corridor',
    hospital: hospitalFull ? 'St. Jude Trauma Center' : 'Mercy General Hospital',
    etaMinutes: roadBlocked ? 18 : flood ? 14 : 9,
    reasoning: [`Priority ${incident.priority} incident with ${incident.victimCount} affected person(s).`, roadBlocked ? 'Primary route is blocked; an alternate route is active.' : 'Primary route is clear.', hospitalFull ? 'Mercy General is at capacity; diversion applied.' : 'Nearest receiving hospital has capacity.'],
    ...(roadBlocked || hospitalFull || !ambulanceAvailable ? { replanReason: roadBlocked ? 'Road blockage reported' : hospitalFull ? 'Hospital capacity changed' : 'Ambulance became unavailable' } : {}),
  };
}
export async function approvePlan(incidentId: string) { await wait(); updateIncident(incidentId, { status: 'dispatched' }); return { id: `DSP-${incidentId}`, status: 'approved' }; }
export async function modifyPlan(incidentId: string, changes: Record<string, unknown>) { await wait(); return { id: `DSP-${incidentId}`, status: 'modified', changes }; }
export async function rejectPlan(incidentId: string) { await wait(); updateIncident(incidentId, { status: 'active' }); return { id: `DSP-${incidentId}`, status: 'rejected' }; }
export async function getResources() { await wait(); return clone({ units: [{ id: 'MEDIC-4', type: 'Ambulance', status: ambulanceAvailable ? 'available' : 'busy' }, { id: 'BOAT-2', type: 'Rescue boat', status: 'en-route' }, { id: 'DELTA-3', type: 'Rescue unit', status: 'available' }], hospitals: [{ id: 'MERCY', name: 'Mercy General Hospital', availableBeds: hospitalFull ? 0 : 8, capacity: 42 }, { id: 'ST-JUDE', name: 'St. Jude Trauma Center', availableBeds: 15, capacity: 36 }] }); }
export async function getPredictiveZones() { await wait(); return clone([{ zoneName: 'River corridor', currentRisk: Math.min(95, 48 + Math.round(waterLevel * 12)), timeline: [{ minutesAhead: 0, riskLevel: 'Elevated' }, { minutesAhead: 30, riskLevel: waterLevel > 2 ? 'Critical' : 'High' }, { minutesAhead: 60, riskLevel: rainfall > 70 ? 'Critical' : 'High' }], recommendation: 'Pre-position water-rescue assets and notify low-lying communities.' }, { zoneName: 'Urban drainage basin', currentRisk: Math.min(92, 30 + Math.round(rainfall / 2)), timeline: [{ minutesAhead: 0, riskLevel: 'Moderate' }, { minutesAhead: 30, riskLevel: rainfall > 60 ? 'High' : 'Elevated' }, { minutesAhead: 60, riskLevel: rainfall > 80 ? 'Critical' : 'High' }], recommendation: 'Monitor road closures and activate diversion routes.' }]); }
export async function runAgentPipeline(incidentId: string): Promise<AgentResult[]> { await wait(); const incident = incidents.find((item) => item.id === incidentId); if (!incident) throw new Error('Incident not found'); return [{ name: 'Situation Agent', question: 'What is happening?', status: 'complete', summary: `${incident.type} verified at reported coordinates.` }, { name: 'Risk Agent', question: 'How urgent is it?', status: 'complete', summary: `Priority ${incident.priority} risk classification confirmed.` }, { name: 'Resource Agent', question: 'Who should respond?', status: 'complete', summary: ambulanceAvailable ? 'Best available resource allocated.' : 'Fallback resource allocated.' }, { name: 'Route Agent', question: 'How do we reach them?', status: 'complete', summary: roadBlocked ? 'Alternate route selected.' : 'Fastest safe route selected.' }, { name: 'Predictive Agent', question: 'What happens next?', status: 'complete', summary: `Rainfall ${rainfall} mm/h; water level ${waterLevel.toFixed(1)} m.` }, { name: 'Master Coordinator', question: 'What should we do?', status: 'complete', summary: 'Dispatch plan ready for operator approval.' }]; }
export async function simulateEvent(type: 'generate-sos' | 'block-road' | 'hospital-full' | 'increase-rainfall' | 'increase-water-level' | 'ambulance-unavailable') {
  await wait();
  if (type === 'generate-sos') { incidents = [{ id: `INC-DEMO-${Date.now().toString().slice(-4)}`, type: 'Citizen SOS', priority: 2, victimCount: 2, location: { lat: 12.2968, lng: 76.6384 }, timestamp: new Date().toISOString(), status: 'new', receivedVia: 'direct', description: 'New demonstration SOS report.', contact: 'Not supplied', mediaReferences: [], duplicateReportLinks: [] }, ...incidents]; }
  if (type === 'block-road') roadBlocked = true;
  if (type === 'hospital-full') hospitalFull = true;
  if (type === 'increase-rainfall') rainfall += 25;
  if (type === 'increase-water-level') waterLevel += 0.6;
  if (type === 'ambulance-unavailable') ambulanceAvailable = false;
  return { type, message: `${type.replaceAll('-', ' ')} applied` };
}
export async function submitSos(data: Omit<Incident, 'id' | 'timestamp' | 'status' | 'receivedVia'> & { offlineMode: boolean; photoReferences?: string[]; audioReferences?: string[] }) {
  await wait(); const id = `SOS-${Date.now().toString().slice(-6)}`; const incident: Incident = { id, type: data.type, priority: data.priority, victimCount: data.victimCount, location: data.location, timestamp: new Date().toISOString(), status: data.offlineMode ? 'queued' : 'new', receivedVia: data.offlineMode ? 'offline-sync' : 'direct', description: data.description, contact: data.contact, mediaReferences: [...(data.photoReferences || []), ...(data.audioReferences || [])], duplicateReportLinks: [] }; incidents = [incident, ...incidents]; return { id, status: data.offlineMode ? 'queued' : 'sent' }; }
export async function syncOfflineSos(id: string) { await wait(); const incident = incidents.find((item) => item.id === id); if (!incident) throw new Error('Queued SOS not found'); incident.status = 'new'; return { id, status: 'synced' }; }

function updateIncident(id: string, changes: Partial<Incident>) { const incident = incidents.find((item) => item.id === id); if (!incident) throw new Error('Incident not found'); Object.assign(incident, changes); }
