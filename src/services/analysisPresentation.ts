export type AnalysisRecord = Record<string, unknown>;

export type AnalysisNoticeSeverity = 'critical' | 'warning' | 'info';

export interface AnalysisWarningDetail {
  code: string;
  source: string;
  message: string;
}

export interface AnalysisWarningGroup {
  key: string;
  title: string;
  description: string;
  severity: AnalysisNoticeSeverity;
  details: AnalysisWarningDetail[];
}

export interface MissingIncidentDetail {
  key: string;
  label: string;
  guidance: string;
}

const priorityLabels: Record<number, string> = {
  1: 'P1 · Critical',
  2: 'P2 · High',
  3: 'P3 · Medium',
  4: 'P4 · Low',
  5: 'P5 · Monitor',
};

const warningPresentations: Record<string, {
  title: string;
  description: string;
  severity: AnalysisNoticeSeverity;
}> = {
  DATA_CONFLICT: {
    title: 'Incident readings conflict',
    description: 'Some reported conditions differ between sources. Confirm which observation is current before acting.',
    severity: 'warning',
  },
  EMPTY_HOSPITAL_LIST: {
    title: 'Hospital information unavailable',
    description: 'No hospital records were available to assess capacity.',
    severity: 'warning',
  },
  INCOMPLETE_INCIDENT: {
    title: 'Incident details need confirmation',
    description: 'Some incident information was not reported. Confirm it with the reporting source; no values have been inferred.',
    severity: 'warning',
  },
  INVALID_COORDINATES: {
    title: 'Incident location needs review',
    description: 'The location could not be used for routing. Confirm the incident coordinates before dispatch.',
    severity: 'critical',
  },
  MALFORMED_INPUT: {
    title: 'Incident information could not be checked',
    description: 'Some input was not in a usable format. Confirm the incident details before relying on this plan.',
    severity: 'critical',
  },
  MISSING_ENVIRONMENT_DATA: {
    title: 'Current environmental readings unavailable',
    description: 'No usable local weather or water-level readings were available; trend-based prediction may be limited.',
    severity: 'info',
  },
  MISSING_RESOURCES: {
    title: 'Resource information unavailable',
    description: 'No resource records were available to evaluate for this incident.',
    severity: 'warning',
  },
  MODEL_FILE_MISSING: {
    title: 'Risk model unavailable',
    description: 'The AI risk model could not be loaded. Review the returned rule-based assessment before dispatch.',
    severity: 'warning',
  },
  MODEL_NOT_VALIDATED: {
    title: 'Risk model not validated for operations',
    description: 'The model was not used as operational evidence. The returned risk assessment uses the available rule-based fallback.',
    severity: 'warning',
  },
  MODEL_PREDICTION_FAILED: {
    title: 'Model result unavailable',
    description: 'A model result could not be produced. Review the other returned assessment details before acting.',
    severity: 'warning',
  },
  NO_AVAILABLE_RESOURCE: {
    title: 'No available resources found',
    description: 'No currently available response resources were found for assignment.',
    severity: 'warning',
  },
  NO_SUITABLE_RESOURCE: {
    title: 'No suitable resource found',
    description: 'No available resource matched the requirements returned for this incident.',
    severity: 'warning',
  },
  OSRM_UNAVAILABLE: {
    title: 'Road-network routing unavailable',
    description: 'Any displayed route distance or arrival time may be approximate. Confirm the route before dispatch.',
    severity: 'warning',
  },
  OPTIMIZATION_FAILURE: {
    title: 'Resource matching needs review',
    description: 'Automated resource matching could not complete normally. Review the assignments and unfulfilled requirements.',
    severity: 'warning',
  },
  PREDICTION_FAILURE: {
    title: 'Trend prediction unavailable',
    description: 'A trend projection could not be prepared. This does not invalidate the other results returned by the AI analysis.',
    severity: 'info',
  },
  RESOURCE_FAILURE: {
    title: 'Resource recommendations incomplete',
    description: 'The resource-assignment stage did not complete normally. Review the returned plan before dispatch.',
    severity: 'warning',
  },
  RISK_FAILURE: {
    title: 'Risk assessment needs review',
    description: 'The risk-assessment stage did not complete normally. Do not rely on an incomplete assessment for dispatch.',
    severity: 'critical',
  },
  ROUTE_FAILURE: {
    title: 'Route recommendation needs review',
    description: 'A route could not be confirmed. Verify road access and arrival time before dispatch.',
    severity: 'warning',
  },
  SITUATION_FAILURE: {
    title: 'Situation assessment incomplete',
    description: 'The situation-assessment stage did not complete normally. Confirm the incident details before acting.',
    severity: 'critical',
  },
  STALE_DATA: {
    title: 'Some information may be out of date',
    description: 'Confirm current conditions with field teams before relying on older observations.',
    severity: 'warning',
  },
};

const incidentFieldPresentations: Record<string, { label: string; guidance: string }> = {
  children_count: {
    label: 'Number of children affected',
    guidance: 'Confirm this count with the caller or field team. Do not estimate it if it cannot be verified.',
  },
  critical_victim_count: {
    label: 'Number of people critically injured',
    guidance: 'Ask the caller or field team to confirm whether anyone has critical injuries.',
  },
  disabled_count: {
    label: 'Number of people with disabilities affected',
    guidance: 'Confirm this count with the caller or field team. Do not estimate it if it cannot be verified.',
  },
  elderly_count: {
    label: 'Number of older adults affected',
    guidance: 'Confirm this count with the caller or field team. Do not estimate it if it cannot be verified.',
  },
  rainfall: {
    label: 'Current rainfall reading',
    guidance: 'For a flood incident, request a current local rainfall reading if one is available.',
  },
  road_access: {
    label: 'Road access to the incident',
    guidance: 'Confirm with field teams whether responders can reach the incident location.',
  },
  victim_count: {
    label: 'Total number of people affected',
    guidance: 'Ask the caller or field team to confirm the number of people affected, then update the incident record.',
  },
  water_level: {
    label: 'Current water-level reading',
    guidance: 'For a flood incident, request a current local water-level reading if one is available.',
  },
};

const incidentFieldKeys = Object.keys(incidentFieldPresentations)
  .sort((left, right) => right.length - left.length);

function isAnalysisRecord(value: unknown): value is AnalysisRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecordString(record: AnalysisRecord | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function humanizeCode(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function groupAnalysisWarnings(warnings: unknown[]): AnalysisWarningGroup[] {
  const groups = new Map<string, AnalysisWarningGroup>();

  warnings.forEach(warning => {
    const record = isAnalysisRecord(warning) ? warning : null;
    const code = getRecordString(record, 'code')?.toUpperCase() ?? '';
    const message = getRecordString(record, 'message')
      ?? (typeof warning === 'string' && warning.trim() ? warning.trim() : 'Warning details were not returned.');
    const key = code || message;
    const presentation = warningPresentations[code];
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        title: presentation?.title ?? (code ? humanizeCode(code) : 'Pipeline notice'),
        description: presentation?.description ?? message,
        severity: presentation?.severity ?? 'warning',
        details: [],
      };
      groups.set(key, group);
    }

    group.details.push({
      code: code || 'Pipeline warning',
      source: getRecordString(record, 'source') ?? 'AI service',
      message,
    });
  });

  return [...groups.values()];
}

export function getMissingIncidentDetails(fields: unknown[]): MissingIncidentDetail[] {
  const found = new Map<string, MissingIncidentDetail>();

  fields.forEach(value => {
    if (typeof value !== 'string' || !value.trim()) return;
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const matchedKeys = incidentFieldKeys.filter(key => normalized.includes(key));
    const keys = matchedKeys.length
      ? matchedKeys.filter(key => !matchedKeys.some(other => other !== key && other.includes(key)))
      : [normalized.replace(/^_+|_+$/g, '')];

    keys.sort((left, right) => normalized.indexOf(left) - normalized.indexOf(right)).forEach(key => {
      if (!key || found.has(key)) return;
      const presentation = incidentFieldPresentations[key];
      const label = presentation?.label ?? humanizeCode(key);
      found.set(key, {
        key,
        label,
        guidance: presentation?.guidance
          ?? `Confirm ${label.toLowerCase()} with the reporting source, and update the record only when verified.`,
      });
    });
  });

  return [...found.values()];
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
