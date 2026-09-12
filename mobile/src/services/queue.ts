import localforage from 'localforage';

export interface SOSRequest {
  id: string;
  category: string;
  people: number;
  details: string;
  location: string;
  timestamp: number;
}

const queueStore = localforage.createInstance({
  name: 'DisasterLinkMobile',
  storeName: 'sos_queue'
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function enqueueSOS(request: Omit<SOSRequest, 'id' | 'timestamp'>) {
  const sos: SOSRequest = {
    ...request,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  
  await queueStore.setItem(sos.id, sos);
  return sos;
}

export async function getQueueCount() {
  const keys = await queueStore.keys();
  return keys.length;
}

export async function syncQueue() {
  if (!navigator.onLine) return;

  const keys = await queueStore.keys();
  if (keys.length === 0) return;

  for (const key of keys) {
    const sos = await queueStore.getItem<SOSRequest>(key);
    if (!sos) continue;

    try {
      // Split location string "lat, lng" into coords if possible
      let lat = 12.2958, lng = 76.6394;
      if (sos.location.includes(',')) {
        const parts = sos.location.split(',');
        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);
      }

      const response = await fetch(`${API_URL}/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mesh-gateway-device-token' // Placeholder if auth needed
        },
        body: JSON.stringify({
          title: `SOS: ${sos.category} Emergency`,
          description: `Victims: ${sos.people}. ${sos.details}`,
          status: 'NEW',
          priority: 'P1',
          source: 'MOBILE_APP',
          locationLat: lat,
          locationLng: lng,
          meshNodeId: 'mobile-client'
        })
      });

      if (response.ok) {
        await queueStore.removeItem(key);
      }
    } catch (error) {
      console.error('Failed to sync SOS:', error);
      // Stop syncing if we hit a network error to avoid failing repeatedly
      break;
    }
  }
}
