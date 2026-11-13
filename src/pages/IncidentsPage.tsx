import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import {
  analyzeIncident,
  ApiRequestError,
  fetchIncidents,
  isJsonRecord,
  type FullResponsePlan,
  type Incident,
  type JsonRecord,
} from '../services/api';
import { useAnalysisContext } from '../contexts/AnalysisContext';

function getString(record: JsonRecord | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function getNumber(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBoolean(record: JsonRecord | null, key: string): boolean | null {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : null;
}

function getRecord(record: JsonRecord | null, key: string): JsonRecord | null {
  const value = record?.[key];
  return isJsonRecord(value) ? value : null;
}

function getRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isJsonRecord) : [];
}

function getStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatIncidentTime(value?: string | null): string {
  if (!value) return 'Time not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatLocation(incident: Incident): string {
  if (typeof incident.locationLat !== 'number' || typeof incident.locationLng !== 'number') {
    return 'Location not provided';
  }
  return `${incident.locationLat.toFixed(5)}, ${incident.locationLng.toFixed(5)}`;
}

function formatConfidence(value: number | null): string {
  return value === null ? 'Not returned' : `${Math.round(value * 100)}%`;
}

function slug(value: string | null): string {
  return value?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'unknown';
}

function victimSummary(incident: Incident): string {
  const details = [
    typeof incident.victimCount === 'number' ? `${incident.victimCount} reported` : null,
    typeof incident.elderlyCount === 'number' ? `${incident.elderlyCount} elderly` : null,
    typeof incident.childrenCount === 'number' ? `${incident.childrenCount} children` : null,
    typeof incident.disabledCount === 'number' ? `${incident.disabledCount} with disabilities` : null,
  ].filter((detail): detail is string => detail !== null);

  return details.length ? details.join(' · ') : 'Victim information not reported';
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'An unexpected error occurred.';
  if (error instanceof ApiRequestError && error.status === 401) {
    return `${error.message}. This endpoint requires an OPERATOR or ADMIN bearer token when backend JWT authentication is enabled.`;
  }
  if (error instanceof ApiRequestError && error.status === 403) {
    return `${error.message}. The current account must have the OPERATOR or ADMIN role.`;
  }
  return error.message;
}

function IncidentsPage() {
  const { recordAnalysis } = useAnalysisContext();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FullResponsePlan | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingIncidentId, setAnalyzingIncidentId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    fetchIncidents(controller.signal)
      .then(setIncidents)
      .catch(error => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [refreshVersion]);

  const selectedIncident = incidents.find(incident => incident.id === selectedIncidentId) ?? null;

  async function handleAnalyze(incident: Incident) {
    if (analyzingIncidentId) return;
    setSelectedIncidentId(incident.id);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalyzingIncidentId(incident.id);

    try {
      const response = await analyzeIncident(incident.id);
      setAnalysis(response);
      recordAnalysis(incident, response);
    } catch (error) {
      setAnalysisError(errorMessage(error));
    } finally {
      setAnalyzingIncidentId(null);
    }
  }

  return (
    <>
      <div className="page-heading incidents-page-heading">
        <div>
          <div className="eyebrow"><span /> RESPONSE OPERATIONS</div>
          <h1>Incidents</h1>
          <p>Review incoming reports and request AI-assisted response analysis.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setRefreshVersion(version => version + 1)}
          disabled={isLoading}
        >
          <RefreshCw size={15} className={isLoading ? 'is-spinning' : undefined} />
          Refresh
        </button>
      </div>

      <div className="incident-workspace">
        <section className="incident-list-panel" aria-labelledby="incident-list-title">
          <div className="incident-list-heading">
            <div>
              <h2 id="incident-list-title">Incident queue</h2>
              <p>{isLoading ? 'Loading incidents…' : `${incidents.length} ${incidents.length === 1 ? 'incident' : 'incidents'} returned`}</p>
            </div>
            <span className="quiet-badge">Backend feed</span>
          </div>

          {isLoading && (
            <div className="incident-state" role="status">
              <LoaderCircle size={20} className="is-spinning" />
              <span>Loading incidents from the backend…</span>
            </div>
          )}

          {!isLoading && loadError && (
            <div className="incident-error" role="alert">
              <AlertTriangle size={18} />
              <div>
                <strong>Could not load incidents</strong>
                <p>{loadError}</p>
              </div>
              <button type="button" className="text-button" onClick={() => setRefreshVersion(version => version + 1)}>
                Try again
              </button>
            </div>
          )}

          {!isLoading && !loadError && incidents.length === 0 && (
            <div className="incident-empty">
              <span className="placeholder-icon"><UsersRound size={23} /></span>
              <strong>No incidents returned</strong>
              <p>The backend incident endpoint returned an empty list.</p>
            </div>
          )}

          {!isLoading && !loadError && incidents.length > 0 && (
            <div className="incident-list">
              {incidents.map(incident => (
                <article
                  className={`incident-card${selectedIncidentId === incident.id ? ' is-selected' : ''}`}
                  key={incident.id}
                >
                  <div className="incident-card-top">
                    <span className="incident-category">{incident.type || 'Category not provided'}</span>
                    <span className={`incident-status status-${slug(incident.status ?? null)}`}>
                      {incident.status || 'Status not provided'}
                    </span>
                  </div>
                  <h3>{incident.title}</h3>
                  {incident.description && <p className="incident-description">{incident.description}</p>}
                  <div className="incident-meta">
                    <span><MapPin size={14} />{formatLocation(incident)}</span>
                    <span><Clock3 size={14} />{formatIncidentTime(incident.createdAt)}</span>
                    <span><UsersRound size={14} />{victimSummary(incident)}</span>
                  </div>
                  <div className="incident-card-actions">
                    <span className="incident-id">ID · {incident.id}</span>
                    <button
                      type="button"
                      className="analyze-button"
                      onClick={() => void handleAnalyze(incident)}
                      disabled={analyzingIncidentId !== null}
                    >
                      {analyzingIncidentId === incident.id
                        ? <LoaderCircle size={15} className="is-spinning" />
                        : <BrainCircuit size={15} />}
                      {analyzingIncidentId === incident.id ? 'Analysing…' : 'Analyse with AI'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <AnalysisPanel
          incident={selectedIncident}
          analysis={analysis}
          error={analysisError}
          isLoading={analyzingIncidentId !== null}
        />
      </div>
    </>
  );
}

function AnalysisPanel({
  incident,
  analysis,
  error,
  isLoading,
}: {
  incident: Incident | null;
  analysis: FullResponsePlan | null;
  error: string | null;
  isLoading: boolean;
}) {
  return (
    <aside className="analysis-panel" aria-labelledby="analysis-panel-title">
      <div className="analysis-panel-header">
        <span className="analysis-mark"><BrainCircuit size={19} /></span>
        <div>
          <span className="analysis-kicker">AI DECISION SUPPORT</span>
          <h2 id="analysis-panel-title">Analysis workspace</h2>
        </div>
      </div>

      {incident && (
        <div className="analysis-incident-context">
          <span>SELECTED INCIDENT</span>
          <strong>{incident.title}</strong>
        </div>
      )}

      {isLoading && (
        <div className="analysis-state" role="status">
          <LoaderCircle size={24} className="is-spinning" />
          <strong>Analysing incident</strong>
          <p>Waiting for the backend and AI service response.</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="analysis-error" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>AI analysis failed</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!isLoading && !error && analysis && <AnalysisDetails response={analysis} />}

      {!isLoading && !error && !analysis && (
        <div className="analysis-empty">
          <span className="analysis-empty-icon"><BrainCircuit size={22} /></span>
          <strong>{incident ? 'Ready to analyse' : 'Select an incident'}</strong>
          <p>
            {incident
              ? 'Use “Analyse with AI” on the incident card to request a response analysis.'
              : 'Choose an incident to view its AI-assisted assessment and recommendations.'}
          </p>
        </div>
      )}

      <div className="analysis-dispatch-note">
        <ShieldCheck size={15} />
        <span>Analysis creates a pending dispatch plan in the backend; it does not execute dispatch.</span>
      </div>
    </aside>
  );
}

function AnalysisDetails({ response }: { response: FullResponsePlan }) {
  const situation = getRecord(response, 'situation');
  const risk = getRecord(response, 'risk');
  const prediction = getRecord(response, 'prediction');
  const dataQuality = getRecord(response, 'data_quality');
  const resourceResult = getRecord(response, 'resource_agent_result');
  const safety = getRecord(response, 'safety_check');
  const autonomy = getRecord(response, 'autonomy_decision');
  const trace = getRecord(response, 'trace');
  const riskLevel = getString(risk, 'risk_level');
  const overallConfidence = getNumber(response, 'overall_confidence');
  const humanReview = getBoolean(response, 'human_review_required')
    ?? getBoolean(autonomy, 'human_review_required');
  const assignments = getRecords(response.assignments);
  const resourceAssignments = getRecords(resourceResult?.assignments);
  const assignmentsToDisplay = assignments.length ? assignments : resourceAssignments;
  const recommendedResources = resourceAssignments.length ? resourceAssignments : assignments;
  const warnings = Array.isArray(response.warnings) ? response.warnings : [];
  const traceSteps = getRecords(trace?.steps);

  return (
    <div className="analysis-details">
      <section className="analysis-summary-card">
        <div className="analysis-summary-heading">
          <span className="analysis-section-label">SITUATION SUMMARY</span>
          <span className={`risk-badge risk-${slug(riskLevel)}`}>{riskLevel || 'Risk not returned'}</span>
        </div>
        <h3>{getString(situation, 'summary') || 'No situation summary was returned.'}</h3>
        <div className="analysis-summary-meta">
          {getString(situation, 'normalized_incident_type') && (
            <span>{getString(situation, 'normalized_incident_type')}</span>
          )}
          {getString(risk, 'severity') && <span>{getString(risk, 'severity')} severity</span>}
          {getNumber(risk, 'score') !== null && <span>Risk score {getNumber(risk, 'score')}/100</span>}
        </div>
        {getString(situation, 'severity_assessment') && (
          <p className="analysis-summary-note">{getString(situation, 'severity_assessment')}</p>
        )}
      </section>

      <section className="analysis-metric-row" aria-label="Analysis overview">
        <div className="analysis-metric">
          <span>RECOMMENDED ACTION</span>
          <strong>{getString(response, 'recommended_action') || 'Not returned'}</strong>
        </div>
        <div className="analysis-metric">
          <span>CONFIDENCE</span>
          <strong>{formatConfidence(overallConfidence)}</strong>
        </div>
        <div className="analysis-metric">
          <span>HUMAN REVIEW</span>
          <strong>{humanReview === null ? 'Not returned' : humanReview ? 'Required' : 'Not required'}</strong>
        </div>
      </section>

      <AnalysisSection title="Prediction">
        {prediction ? (
          <>
            <div className="prediction-overview">
              <span>Current risk <strong>{getString(prediction, 'current_risk') || 'Not returned'}</strong></span>
              <span>Escalation <strong>{getBoolean(prediction, 'escalation_detected') === null
                ? 'Not returned'
                : getBoolean(prediction, 'escalation_detected') ? 'Detected' : 'Not detected'}</strong></span>
              <span>Confidence <strong>{formatConfidence(getNumber(prediction, 'confidence'))}</strong></span>
            </div>
            {Array.isArray(prediction.forecast) && prediction.forecast.length > 0 && (
              <ul className="forecast-list">
                {getRecords(prediction.forecast).map((item, index) => (
                  <li key={`${getNumber(item, 'horizon_minutes') ?? index}-${index}`}>
                    <span>{getNumber(item, 'horizon_minutes') ?? '—'} min</span>
                    <span className={`risk-badge risk-${slug(getString(item, 'risk_level'))}`}>
                      {getString(item, 'risk_level') || 'Risk not returned'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <StringList items={getStrings(prediction.explanation)} emptyText="No prediction explanation was returned." />
          </>
        ) : <p className="analysis-muted">No prediction was returned.</p>}
      </AnalysisSection>

      <AnalysisSection title="Recommended resources">
        {recommendedResources.length ? (
          <ul className="recommendation-list">
            {recommendedResources.map((assignment, index) => (
              <li key={`${getString(assignment, 'resource_id') ?? 'resource'}-${index}`}>
                <span className="resource-symbol"><UsersRound size={15} /></span>
                <span>
                  <strong>{getString(assignment, 'resource_id') || 'Resource ID not returned'}</strong>
                  <small>{getString(assignment, 'action') || 'Action not returned'}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="analysis-muted">No recommended resources were returned.</p>}
        <StringList
          items={getStrings(resourceResult?.unfulfilled_requirements)}
          emptyText=""
          label="Unfulfilled requirements"
        />
      </AnalysisSection>

      <AnalysisSection title="Resource assignments">
        {assignmentsToDisplay.length ? (
          <div className="assignment-list">
            {assignmentsToDisplay.map((assignment, index) => {
              const route = getRecord(assignment, 'route');
              const arrivalTime = getNumber(assignment, 'estimated_arrival_time_mins')
                ?? getNumber(route, 'estimated_time_mins');
              return (
                <article className="assignment-card" key={`${getString(assignment, 'resource_id') ?? 'assignment'}-${index}`}>
                  <div className="assignment-heading">
                    <strong>{getString(assignment, 'resource_id') || 'Resource ID not returned'}</strong>
                    <span>{getString(assignment, 'action') || 'Action not returned'}</span>
                  </div>
                  <div className="assignment-route">
                    {getString(route, 'route_status') && <span>{getString(route, 'route_status')}</span>}
                    {arrivalTime !== null && <span>ETA {arrivalTime} min</span>}
                    {getNumber(route, 'distance_km') !== null && <span>{getNumber(route, 'distance_km')} km</span>}
                  </div>
                  {getString(route, 'explanation') && <p>{getString(route, 'explanation')}</p>}
                </article>
              );
            })}
          </div>
        ) : <p className="analysis-muted">No resource assignments were returned.</p>}
      </AnalysisSection>

      <AnalysisSection title="Recommendation explanation">
        <StringList
          items={[
            ...getStrings(response.explanation),
            ...getStrings(risk?.reasons),
            ...getStrings(resourceResult?.reasons),
          ]}
          emptyText="No explanation was returned."
        />
      </AnalysisSection>

      <AnalysisSection title="Data quality">
        {dataQuality ? (
          <>
            <div className="quality-overview">
              <span className={`quality-badge quality-${slug(getString(dataQuality, 'overall_quality'))}`}>
                {getString(dataQuality, 'overall_quality') || 'Quality not returned'}
              </span>
              <span>Confidence <strong>{formatConfidence(getNumber(dataQuality, 'confidence'))}</strong></span>
            </div>
            <QualityField label="Missing fields" values={getStrings(dataQuality.missing_fields)} />
            <QualityField label="Stale fields" values={getStrings(dataQuality.stale_fields)} />
            <QualityField label="Invalid fields" values={getStrings(dataQuality.invalid_fields)} />
            <QualityField label="Conflicting fields" values={getStrings(dataQuality.conflicting_fields)} />
            <StringList items={getStrings(dataQuality.warnings)} emptyText="" label="Quality warnings" />
          </>
        ) : <p className="analysis-muted">No data-quality assessment was returned.</p>}
      </AnalysisSection>

      <AnalysisSection title="Warnings">
        {warnings.length ? (
          <ul className="warning-list">
            {warnings.map((warning, index) => {
              const item = isJsonRecord(warning) ? warning : null;
              const message = getString(item, 'message')
                || (typeof warning === 'string' ? warning : 'Warning details were not returned.');
              return (
                <li key={`${getString(item, 'code') ?? 'warning'}-${index}`}>
                  <AlertTriangle size={15} />
                  <span>
                    <strong>{getString(item, 'code') || 'Pipeline warning'}</strong>
                    <small>{getString(item, 'source') || 'AI service'}</small>
                    <p>{message}</p>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="analysis-muted">No warnings were returned.</p>}
      </AnalysisSection>

      <AnalysisSection title="Human review & safety">
        <div className="safety-overview">
          <span className={`safety-badge safety-${slug(getString(safety, 'status'))}`}>
            Safety: {getString(safety, 'status') || 'Not returned'}
          </span>
          <span className="safety-badge">
            Human review: {humanReview === null ? 'Not returned' : humanReview ? 'Required' : 'Not required'}
          </span>
        </div>
        {getBoolean(safety, 'is_safe_for_autonomous_execution') !== null && (
          <p className="analysis-muted">
            Autonomous execution: {getBoolean(safety, 'is_safe_for_autonomous_execution') ? 'marked safe' : 'not marked safe'}
            {getNumber(safety, 'checks_performed') !== null && ` · ${getNumber(safety, 'checks_performed')} checks performed`}
          </p>
        )}
        {getString(autonomy, 'mode') && (
          <p className="autonomy-reason">
            <strong>{getString(autonomy, 'mode')}</strong>
            {getString(autonomy, 'reason') && ` · ${getString(autonomy, 'reason')}`}
          </p>
        )}
        <QualityField label="Blocking issues" values={getStrings(safety?.blocking_issues)} />
        <QualityField label="Safety warnings" values={getStrings(safety?.warnings)} />
      </AnalysisSection>

      {(trace || getString(response, 'trace_id')) && (
        <AnalysisSection title="AI execution trace">
          <div className="trace-meta">
            {(getString(trace, 'trace_id') || getString(response, 'trace_id')) && (
              <span>Trace ID <strong>{getString(trace, 'trace_id') || getString(response, 'trace_id')}</strong></span>
            )}
            {getNumber(trace, 'total_execution_time_ms') !== null && (
              <span>Duration <strong>{getNumber(trace, 'total_execution_time_ms')} ms</strong></span>
            )}
          </div>
          {traceSteps.length > 0 && (
            <ol className="trace-list">
              {traceSteps.map((step, index) => (
                <li key={`${getString(step, 'step_name') ?? 'step'}-${index}`}>
                  <span className={`trace-step-status trace-${slug(getString(step, 'status'))}`} />
                  <span>
                    <strong>{getString(step, 'step_name') || getString(step, 'agent_name') || 'Pipeline step'}</strong>
                    <small>{getString(step, 'agent_name') || getString(step, 'status') || 'Status not returned'}</small>
                  </span>
                  {getNumber(step, 'execution_time_ms') !== null && (
                    <span className="trace-duration">{getNumber(step, 'execution_time_ms')} ms</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </AnalysisSection>
      )}
    </div>
  );
}

function AnalysisSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="analysis-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function StringList({
  items,
  emptyText,
  label,
}: {
  items: string[];
  emptyText: string;
  label?: string;
}) {
  if (!items.length && !emptyText) return null;
  return (
    <div className="string-list-block">
      {label && <h4>{label}</h4>}
      {items.length ? (
        <ul className="string-list">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
      ) : <p className="analysis-muted">{emptyText}</p>}
    </div>
  );
}

function QualityField({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="quality-field">
      <strong>{label}</strong>
      <span>{values.join(', ')}</span>
    </div>
  );
}

export default IncidentsPage;
