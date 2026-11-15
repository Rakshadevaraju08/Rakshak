import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  fetchIncidentById,
  fetchIncidentsWithStats,
  getCachedIncidents,
  subscribeIncidentChanges,
  type Incident,
} from '../services/incidentService';

export interface UseIncidentsResult {
  data: Incident[];
  droppedCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<Incident[]>;
}

export interface UseIncidentResult {
  data: Incident | null;
  loading: boolean;
  error: string | null;
  statusCode: number | null;
  isNotFound: boolean;
  refetch: () => Promise<Incident | null>;
}

function extractErrorInfo(error: unknown): { message: string; status: number | null } {
  if (error instanceof ApiRequestError) {
    return {
      message: error.message,
      status: error.status,
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      status: null,
    };
  }
  if (typeof error === 'string' && error.trim()) {
    return {
      message: error,
      status: null,
    };
  }
  return {
    message: 'An unexpected error occurred while communicating with the incident service.',
    status: null,
  };
}

/**
 * Shared hook to load and manage the list of incidents.
 *
 * @param autoFetch Whether to fetch on mount (defaults to true).
 * @returns { data, droppedCount, loading, error, refetch }
 */
export function useIncidents(autoFetch = true): UseIncidentsResult {
  const [data, setData] = useState<Incident[]>(() => getCachedIncidents());
  const [droppedCount, setDroppedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(autoFetch && getCachedIncidents().length === 0);
  const [error, setError] = useState<string | null>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Subscribe to cross-component incident mutations (e.g. status changes)
  useEffect(() => {
    const unsubscribe = subscribeIncidentChanges(updatedRecords => {
      if (isMountedRef.current) {
        setData(updatedRecords);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const performFetch = useCallback(async (): Promise<Incident[]> => {
    // Cancel any in-flight request
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const stats = await fetchIncidentsWithStats(controller.signal);
      if (isMountedRef.current) {
        setData(stats.incidents);
        setDroppedCount(stats.droppedCount);
        setError(null);
      }
      return stats.incidents;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return [];
      }
      const { message } = extractErrorInfo(err);
      if (isMountedRef.current) {
        setError(message);
      }
      throw err;
    } finally {
      if (isMountedRef.current && activeControllerRef.current === controller) {
        setLoading(false);
        activeControllerRef.current = null;
      }
    }
  }, []);

  const refetch = useCallback(async (): Promise<Incident[]> => {
    try {
      return await performFetch();
    } catch {
      return [];
    }
  }, [performFetch]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoFetch) {
      void performFetch().catch(() => {});
    }

    return () => {
      isMountedRef.current = false;
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [autoFetch, performFetch]);

  return {
    data,
    droppedCount,
    loading,
    error,
    refetch,
  };
}

/**
 * Shared hook to load and manage a single incident by ID.
 *
 * @param id Incident identifier
 * @param autoFetch Whether to fetch on mount / id change (defaults to true)
 * @returns { data, loading, error, statusCode, isNotFound, refetch }
 */
export function useIncident(
  id: string | null | undefined,
  autoFetch = true
): UseIncidentResult {
  const [data, setData] = useState<Incident | null>(() => {
    if (!id) return null;
    return getCachedIncidents().find(inc => inc.id === id) || null;
  });
  const [loading, setLoading] = useState<boolean>(Boolean(autoFetch && id));
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Subscribe to cache updates to keep incident view synced across components
  useEffect(() => {
    const unsubscribe = subscribeIncidentChanges(updatedRecords => {
      if (isMountedRef.current && id) {
        const found = updatedRecords.find(item => item.id === id);
        if (found) {
          setData(prev => (prev ? { ...prev, ...found } : found));
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, [id]);

  const performFetch = useCallback(async (targetId: string): Promise<Incident | null> => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setStatusCode(null);

    try {
      const record = await fetchIncidentById(targetId, { signal: controller.signal });
      if (isMountedRef.current) {
        setData(record);
        setError(null);
        setStatusCode(200);
      }
      return record;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return null;
      }
      const { message, status } = extractErrorInfo(err);
      if (isMountedRef.current) {
        setError(message);
        setStatusCode(status);
      }
      throw err;
    } finally {
      if (isMountedRef.current && activeControllerRef.current === controller) {
        setLoading(false);
        activeControllerRef.current = null;
      }
    }
  }, []);

  const refetch = useCallback(async (): Promise<Incident | null> => {
    if (!id) {
      setData(null);
      setLoading(false);
      setError(null);
      setStatusCode(null);
      return null;
    }
    try {
      return await performFetch(id);
    } catch {
      return null;
    }
  }, [id, performFetch]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!id) {
      setData(null);
      setLoading(false);
      setError(null);
      setStatusCode(null);
      return;
    }

    // Seed from cache if available
    const cached = getCachedIncidents().find(inc => inc.id === id);
    if (cached) {
      setData(cached);
    }

    if (autoFetch) {
      void performFetch(id).catch(() => {});
    }

    return () => {
      isMountedRef.current = false;
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [id, autoFetch, performFetch]);

  return {
    data,
    loading,
    error,
    statusCode,
    isNotFound: statusCode === 404,
    refetch,
  };
}
