export type AnalysisRecord = Record<string, unknown>;

const priorityLabels: Record<number, string> = {
  1: 'P1 · Critical',
  2: 'P2 · High',
  3: 'P3 · Medium',
  4: 'P4 · Low',
  5: 'P5 · Monitor',
};

function isAnalysisRecord(value: unknown): value is AnalysisRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPredictionAvailable(prediction: AnalysisRecord | null): boolean {
  return prediction !== null
    && prediction.prediction_available === true
    && Array.isArray(prediction.forecast)
    && prediction.forecast.some(forecast => isAnalysisRecord(forecast)
      && typeof forecast.horizon_minutes === 'number'
      && Number.isFinite(forecast.horizon_minutes)
      && typeof forecast.risk_level === 'string'
      && forecast.risk_level.trim().length > 0);
}

export function formatPriority(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return priorityLabels[value] ?? String(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const match = /^P([1-5])(?:[_\s-]+(.+))?$/i.exec(value.trim());
    if (match) {
      const priority = priorityLabels[Number(match[1])];
      return match[2] ? `${priority.split(' · ')[0]} · ${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}` : priority;
    }
    return value;
  }

  return 'Not returned';
}
