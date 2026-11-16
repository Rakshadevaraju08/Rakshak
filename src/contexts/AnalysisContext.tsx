import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { FullResponsePlan, Incident } from '../services/api';

export type LatestIncidentAnalysis = {
  incident: Incident;
  response: FullResponsePlan;
  receivedAt: string;
};

type AnalysisContextValue = {
  latestAnalysis: LatestIncidentAnalysis | null;
  recordAnalysis: (incident: Incident, response: FullResponsePlan) => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);
const STORAGE_KEY = 'rakshak.latestIncidentAnalysis';

function readSavedAnalysis(): LatestIncidentAnalysis | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Partial<LatestIncidentAnalysis>;
    return value.incident && value.response && typeof value.receivedAt === 'string'
      ? value as LatestIncidentAnalysis
      : null;
  } catch {
    return null;
  }
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [latestAnalysis, setLatestAnalysis] = useState<LatestIncidentAnalysis | null>(readSavedAnalysis);

  useEffect(() => {
    try {
      if (latestAnalysis) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(latestAnalysis));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Session storage can be unavailable in restricted browser contexts.
    }
  }, [latestAnalysis]);

  function recordAnalysis(incident: Incident, response: FullResponsePlan) {
    setLatestAnalysis({ incident, response, receivedAt: new Date().toISOString() });
  }

  return (
    <AnalysisContext.Provider value={{ latestAnalysis, recordAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisContext() {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error('useAnalysisContext must be used within AnalysisProvider.');
  return context;
}
