import { createContext, useContext, useState, type ReactNode } from 'react';
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

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [latestAnalysis, setLatestAnalysis] = useState<LatestIncidentAnalysis | null>(null);

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
