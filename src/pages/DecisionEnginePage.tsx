import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAnalysisContext } from '../contexts/AnalysisContext';
import { useIncident } from '../hooks/useIncidents';
import {
  formatPriority,
  isPredictionAvailable,
} from '../services/analysisPresentation';
import { isJsonRecord, type IncidentDispatchPlan, type JsonRecord } from '../services/api';
import { presentDecisionStatus } from '../services/decisionPresentation';

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

function getRecord(value: unknown): JsonRecord | null {
  return isJsonRecord(value) ? value : null;
}

function getStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function warningDetails(value: unknown): { label: string; message: string } | null {
  if (typeof value === 'string' && value.trim()) {
    return { label: 'Warning', message: value };
  }
  const warning = getRecord(value);
  if (!warning) return null;
  const message = getString(warning, 'message');
  if (!message) return null;
  return { label: getString(warning, 'code') || 'Warning', message };
}

function sortedPlans(plans: IncidentDispatchPlan[]): IncidentDispatchPlan[] {
  return [...plans].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function DecisionEnginePage() {
  const { latestAnalysis } = useAnalysisContext();
  const analysis = latestAnalysis?.response ?? null;
  const incident = latestAnalysis?.incident ?? null;
  const {
    data: incidentDetails,
    loading: isLoadingHistory,
    error: historyError,
    refetch,
  } = useIncident(incident?.id);

  const risk = getRecord(analysis?.risk);
  const safety = getRecord(analysis?.safety_check);
  const autonomy = getRecord(analysis?.autonomy_decision);
  const prediction = getRecord(analysis?.prediction);
  const resourceResult = getRecord(analysis?.resource_agent_result);
  const warnings = Array.isArray(analysis?.warnings)
    ? analysis.warnings.map(warningDetails).filter((warning): warning is NonNullable<typeof warning> => warning !== null)
    : [];
  const riskReasons = getStrings(risk?.reasons);
  const safetyWarnings = getStrings(safety?.warnings);
  const blockingIssues = getStrings(safety?.blocking_issues);
  const blockingFactors = getStrings(autonomy?.blocking_factors);
  const explanation = getStrings(analysis?.explanation);
  const unfulfilledRequirements = getStrings(resourceResult?.unfulfilled_requirements);
  const humanReviewRequired = analysis
    ? getBoolean(analysis, 'human_review_required') ?? getBoolean(autonomy, 'human_review_required')
    : null;
  const plans = incident && incidentDetails?.id === incident.id
    ? sortedPlans(incidentDetails.dispatchPlans.filter(plan => plan.incidentId === incident.id))
    : [];
  const latestPlan = plans[0] ?? null;
  const latestPlanStatus = presentDecisionStatus(latestPlan?.status);
  const predictionAvailable = isPredictionAvailable(prediction);

  return (
    <>
      <div className="page-heading decision-page-heading">
        <div>
          <div className="eyebrow"><span /> HUMAN-IN-THE-LOOP REVIEW</div>
          <h1>Decision Engine</h1>
          <p>Review the latest AI recommendation, its safety considerations, and any plan status recorded by the backend.</p>
        </div>
        <Link className="secondary-button" to="/incidents">
          Open incidents <ArrowRight size={15} />
        </Link>
      </div>

      {!analysis || !incident ? (
        <section className="decision-empty" aria-labelledby="decision-empty-title">
          <span className="decision-empty-icon"><BrainCircuit size={22} /></span>
          <div>
            <span className="decision-kicker">NO ANALYSIS TO REVIEW</span>
            <h2 id="decision-empty-title">Run an incident analysis first</h2>
            <p>This page uses the latest analysis returned in this browser session. It does not generate recommendations or substitute sample data.</p>
          </div>
          <Link className="primary-button" to="/incidents">Go to incidents <ArrowRight size={14} /></Link>
        </section>
      ) : (
        <>
          <section className="decision-incident" aria-labelledby="decision-incident-title">
            <div className="decision-incident-icon"><FileText size={20} /></div>
            <div className="decision-incident-copy">
              <span className="decision-kicker">AI-ANALYSED INCIDENT</span>
              <h2 id="decision-incident-title">{incident.title}</h2>
              <p>{incident.type || 'Category unavailable'} · Incident {incident.id}</p>
              <div className="decision-incident-meta">
                {analysis.trace_id && <span>Trace {analysis.trace_id}</span>}
                <span>Analysis received {formatTime(latestAnalysis.receivedAt)}</span>
                <span className={analysis.degraded ? 'decision-data-state is-warning' : 'decision-data-state'}>
                  {analysis.degraded ? 'Incomplete / degraded analysis' : 'Analysis response received'}
                </span>
              </div>
            </div>
            <Link className="decision-intelligence-link" to="/intelligence">
              View AI pipeline <ArrowRight size={14} />
            </Link>
          </section>

          <section className="decision-overview" aria-label="Decision overview">
            <article className="decision-overview-card decision-action-card">
              <span className="decision-kicker">AI-GENERATED RECOMMENDATION</span>
              <h2>{getString(analysis, 'recommended_action') || 'Recommendation not returned'}</h2>
              <p>This is an AI recommendation for operator review, not an approved action or dispatch.</p>
            </article>
            <article className="decision-overview-card">
              <span className="decision-kicker">RISK PRIORITY</span>
              <strong className={`risk-badge risk-${(getString(risk, 'risk_level') || 'unknown').toLowerCase()}`}>
                {getString(risk, 'risk_level') || 'Not returned'}
              </strong>
              <p>{formatPriority(risk?.priority)}</p>
            </article>
            <article className="decision-overview-card">
              <span className="decision-kicker">LATEST RECORDED PLAN</span>
              {isLoadingHistory ? (
                <strong className="decision-loading-inline"><LoaderCircle size={15} className="is-spinning" /> Loading plan status</strong>
              ) : (
                <strong className={`decision-status-chip decision-status-${latestPlanStatus.tone}`}>
                  {latestPlan ? latestPlanStatus.label : 'No plan status recorded'}
                </strong>
              )}
              <p>{latestPlan ? `Updated ${formatTime(latestPlan.updatedAt)}` : 'Plan state is not available in the incident record.'}</p>
            </article>
          </section>

          <div className="decision-content-grid">
            <section className="decision-panel" aria-labelledby="decision-review-title">
              <div className="decision-panel-heading">
                <div>
                  <span className="decision-kicker">REASONS AND CONTEXT</span>
                  <h2 id="decision-review-title">Recommendation review</h2>
                </div>
                <span className="decision-panel-icon"><Gauge size={17} /></span>
              </div>
              <div className="decision-metrics">
                <div><span>Risk level</span><strong>{getString(risk, 'risk_level') || 'Not returned'}</strong></div>
                <div><span>Severity</span><strong>{getString(risk, 'severity') || 'Not returned'}</strong></div>
                <div><span>Priority</span><strong>{formatPriority(risk?.priority)}</strong></div>
                {predictionAvailable && (
                  <div><span>Prediction</span><strong>{getBoolean(prediction, 'escalation_detected') === null
                    ? 'Result available'
                    : getBoolean(prediction, 'escalation_detected') ? 'Escalation detected' : 'No escalation detected'}</strong></div>
                )}
              </div>
              <DecisionList title="AI explanation" items={explanation} emptyText="No recommendation explanation was returned." />
              <DecisionList title="Risk factors" items={riskReasons} emptyText="No risk reasons were returned." />
              {unfulfilledRequirements.length > 0 && (
                <DecisionList title="Unfulfilled requirements" items={unfulfilledRequirements} emptyText="" tone="warning" />
              )}
            </section>

            <section className="decision-panel decision-safety-panel" aria-labelledby="decision-safety-title">
              <div className="decision-panel-heading">
                <div>
                  <span className="decision-kicker">SAFETY AND HUMAN REVIEW</span>
                  <h2 id="decision-safety-title">Safety recommendations</h2>
                </div>
                <span className="decision-panel-icon"><ShieldCheck size={17} /></span>
              </div>
              {safety ? (
                <>
                  <div className="decision-safety-state">
                    <span className={`safety-badge safety-${(getString(safety, 'status') || 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-')}`}>
                      {getString(safety, 'status') || 'Status not returned'}
                    </span>
                    <span>{getBoolean(safety, 'is_safe_for_autonomous_execution') === null
                      ? 'Autonomous-execution safety not returned'
                      : getBoolean(safety, 'is_safe_for_autonomous_execution')
                        ? 'Marked safe for autonomous execution by the AI response'
                        : 'Not marked safe for autonomous execution'}</span>
                  </div>
                  <DecisionList title="Safety warnings and precautions" items={safetyWarnings} emptyText="No safety warnings were returned." tone="warning" />
                  <DecisionList title="Blocking safety issues" items={blockingIssues} emptyText="No blocking issues were returned." tone="danger" />
                </>
              ) : (
                <div className="decision-unavailable"><ShieldAlert size={17} /><p>No safety-check result was included in this analysis.</p></div>
              )}
              <div className={`decision-review-requirement${humanReviewRequired ? ' is-required' : ''}`}>
                {humanReviewRequired ? <AlertTriangle size={17} /> : <UserRoundCheck size={17} />}
                <div>
                  <strong>Human review: {humanReviewRequired === null
                    ? 'Not returned'
                    : humanReviewRequired ? 'Required' : 'Not marked as required by the AI response'}</strong>
                  <p>{getString(autonomy, 'reason') || 'No autonomy decision explanation was returned.'}</p>
                </div>
              </div>
              <DecisionList title="Autonomy blocking factors" items={blockingFactors} emptyText="" tone="warning" />
            </section>
          </div>

          <section className="decision-panel decision-warnings-panel" aria-labelledby="decision-warnings-title">
            <div className="decision-panel-heading">
              <div>
                <span className="decision-kicker">PIPELINE-REPORTED LIMITATIONS</span>
                <h2 id="decision-warnings-title">Analysis warnings</h2>
              </div>
              <span className="decision-panel-icon"><AlertTriangle size={17} /></span>
            </div>
            {warnings.length > 0 ? (
              <ul className="decision-warning-list">
                {warnings.map((warning, index) => (
                  <li key={`${warning.label}-${index}`}>
                    <AlertTriangle size={15} />
                    <div><strong>{warning.label}</strong><p>{warning.message}</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="decision-muted">No pipeline warnings were returned.</p>}
          </section>

          <section className="decision-panel decision-history-panel" aria-labelledby="decision-history-title">
            <div className="decision-panel-heading">
              <div>
                <span className="decision-kicker">BACKEND-RECORDED PLAN STATES</span>
                <h2 id="decision-history-title">Plan status history</h2>
                <p>Shows persisted plan records only; operator identity and approval/rejection audit events are not exposed by the current API.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => { void refetch(); }} disabled={isLoadingHistory || !incident}>
                <RefreshCw size={14} className={isLoadingHistory ? 'is-spinning' : undefined} /> Refresh
              </button>
            </div>
            {isLoadingHistory ? (
              <div className="decision-state-message" role="status">
                <LoaderCircle size={18} className="is-spinning" /> Loading recorded plan states…
              </div>
            ) : historyError ? (
              <div className="decision-state-message is-error" role="alert">
                <AlertTriangle size={18} />
                <div><strong>Could not load plan history</strong><p>{historyError}</p></div>
                <button className="text-button" type="button" onClick={() => { void refetch(); }}>Try again</button>
              </div>
            ) : plans.length > 0 ? (
              <ol className="decision-history-list">
                {plans.map(plan => {
                  const status = presentDecisionStatus(plan.status);
                  return (
                    <li key={plan.id}>
                      <span className={`decision-history-marker decision-status-${status.tone}`}>
                        {status.tone === 'approved' || status.tone === 'executed'
                          ? <CheckCircle2 size={15} />
                          : status.tone === 'cancelled'
                            ? <XCircle size={15} />
                            : <Clock3 size={15} />}
                      </span>
                      <div className="decision-history-entry">
                        <div>
                          <strong>{status.label}</strong>
                          <span>Plan {plan.id}</span>
                        </div>
                        <div className="decision-history-times">
                          <span>Created {formatTime(plan.createdAt)}</span>
                          <span>Updated {formatTime(plan.updatedAt)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="decision-state-message">
                <Clock3 size={18} />
                <p>No dispatch plan status is currently recorded for this incident.</p>
              </div>
            )}
          </section>

          <section className="decision-action-boundary" aria-label="Approval action availability">
            <UserRoundCheck size={18} />
            <div>
              <strong>Review only — no approval or dispatch action available here</strong>
              <p>The existing backend exposes dispatch execution, which would change resource status. It does not expose a standalone approve/reject or approval-audit API, so this interface will not trigger execution or imply an operator decision.</p>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function DecisionList({
  title,
  items,
  emptyText,
  tone = 'default',
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  if (!items.length && !emptyText) return null;
  return (
    <div className={`decision-list decision-list-${tone}`}>
      <h3>{title}</h3>
      {items.length > 0
        ? <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        : <p>{emptyText}</p>}
    </div>
  );
}

export default DecisionEnginePage;
