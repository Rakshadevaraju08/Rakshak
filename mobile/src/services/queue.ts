import localforage from 'localforage';

export interface SOSRequest {
  id: string;
  category: string;
  people: number;
  details: string;
  location: string;
  timestamp: number;
}

export interface QueueSyncResult {
  acceptedIds: string[];
  error: string | null;
}

const queueStore = localforage.createInstance({
  name: 'DisasterLinkMobile',
  storeName: 'sos_queue'
});

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
let isSyncing = false;

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

function getCoordinates(location: string) {
  const parts = location.split(',');
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0].trim());
  const longitude = Number(parts[1].trim());
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { locationLat: latitude, locationLng: longitude };
}

export async function syncQueue(): Promise<QueueSyncResult> {
  const acceptedIds: string[] = [];
  if (!navigator.onLine || isSyncing) return { acceptedIds, error: null };

  isSyncing = true;
  try {
    const keys = await queueStore.keys();
    for (const key of keys) {
      const sos = await queueStore.getItem<SOSRequest>(key);
      if (!sos) continue;

      const coordinates = getCoordinates(sos.location);
      const description = [
        `Category: ${sos.category}`,
        `People needing help: ${sos.people}`,
        sos.details.trim() ? `Additional details: ${sos.details.trim()}` : null,
        `Submitted from mobile at ${new Date(sos.timestamp).toISOString()}`,
        coordinates ? null : 'GPS coordinates unavailable; confirm the location from the additional details.'
      ].filter((part): part is string => part !== null).join('\n');

      let response: Response;
      try {
        response = await fetch(`${API_URL}/sos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `SOS: ${sos.category} Emergency`,
            description,
            ...(coordinates ?? {})
          })
        });
      } catch (error) {
        console.error('Failed to sync SOS:', error);
        const reason = error instanceof Error ? ` ${error.message}` : '';
        return { acceptedIds, error: `SOS sync failed; the request remains queued for retry.${reason}` };
      }

      if (!response.ok) {
        console.error(`Failed to sync SOS: backend returned HTTP ${response.status}`);
        return { acceptedIds, error: `SOS sync failed (HTTP ${response.status}); the request remains queued for retry.` };
      }

      acceptedIds.push(sos.id);
      try {
        await queueStore.removeItem(key);
      } catch (error) {
        console.error('Backend accepted SOS, but removing the local queue item failed:', error);
        return { acceptedIds, error: 'The backend accepted the SOS, but this device could not clear its saved copy. It may be sent again.' };
      }
    }
    return { acceptedIds, error: null };
  } finally {
    isSyncing = false;
  }
}
