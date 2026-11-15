/**
 * useIncidents & useIncident Hooks (frontend workspace adaptation)
 * Mirrors the canonical root src/hooks/useIncidents implementation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchIncidentById, fetchIncidents, getCachedIncidents, subscribeIncidentChanges } from '../services/incidentService';

function extractErrorInfo(error) {
  if (error && typeof error.status === 'number') {
    return { message: error.message, status: error.status };
  }
  if (error instanceof Error) {
    return { message: error.message, status: null };
  }
  if (typeof error === 'string' && error.trim()) {
    return { message: error, status: null };
  }
  return {
    message: 'An unexpected error occurred while communicating with the incident service.',
    status: null,
  };
}

export function useIncidents(autoFetch = true) {
  const [data, setData] = useState(() => (typeof getCachedIncidents === 'function' ? getCachedIncidents() : []));
  const [droppedCount, setDroppedCount] = useState(0);
  const [loading, setLoading] = useState(autoFetch && data.length === 0);
  const [error, setError] = useState(null);

  const activeControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (typeof subscribeIncidentChanges !== 'function') return;
    const unsubscribe = subscribeIncidentChanges(updatedRecords => {
      if (isMountedRef.current) {
        setData(updatedRecords);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const performFetch = useCallback(async () => {
    if (activeControllerRef.current) activeControllerRef.current.abort();

    const controller = new AbortController();
    activeControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const records = await fetchIncidents(controller.signal);
      if (isMountedRef.current) {
        setData(records);
        setError(null);
      }
      return records;
    } catch (err) {
      if (controller.signal.aborted) return [];
      const { message } = extractErrorInfo(err);
      if (isMountedRef.current) setError(message);
      throw err;
    } finally {
      if (isMountedRef.current && activeControllerRef.current === controller) {
        setLoading(false);
        activeControllerRef.current = null;
      }
    }
  }, []);

  const refetch = useCallback(async () => {
    try {
      return await performFetch();
    } catch {
      return [];
    }
  }, [performFetch]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoFetch) {
      performFetch().catch(() => {});
    }
    return () => {
      isMountedRef.current = false;
      if (activeControllerRef.current) activeControllerRef.current.abort();
    };
  }, [autoFetch, performFetch]);

  return { data, droppedCount, loading, error, refetch };
}

export function useIncident(id, autoFetch = true) {
  const [data, setData] = useState(() => {
    if (!id || typeof getCachedIncidents !== 'function') return null;
    return getCachedIncidents().find(inc => inc.id === id) || null;
  });
  const [loading, setLoading] = useState(Boolean(autoFetch && id));
  const [error, setError] = useState(null);
  const [statusCode, setStatusCode] = useState(null);

  const activeControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!id || typeof subscribeIncidentChanges !== 'function') return;
    const unsubscribe = subscribeIncidentChanges(updatedRecords => {
      if (isMountedRef.current) {
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

  const performFetch = useCallback(async (targetId) => {
    if (activeControllerRef.current) activeControllerRef.current.abort();

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
    } catch (err) {
      if (controller.signal.aborted) return null;
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

  const refetch = useCallback(async () => {
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

    if (typeof getCachedIncidents === 'function') {
      const cached = getCachedIncidents().find(inc => inc.id === id);
      if (cached) setData(cached);
    }

    if (autoFetch) {
      performFetch(id).catch(() => {});
    }

    return () => {
      isMountedRef.current = false;
      if (activeControllerRef.current) activeControllerRef.current.abort();
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
