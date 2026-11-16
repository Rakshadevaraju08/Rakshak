import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AnalysisWarningGroups from '../components/AnalysisWarningGroups';
import { useAnalysisContext } from '../contexts/AnalysisContext';
import { useIncident } from '../hooks/useIncidents';
import {
  formatPriority,
  getMissingIncidentDetails,
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

function sortedPlans(plans: IncidentDispatchPlan[]): IncidentDispatchPlan[] {
  return [...plans].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
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
  const dataQuality = getRecord(analysis?.data_quality);
  const situation = getRecord(analysis?.situation);
  const resourceResult = getRecord(analysis?.resource_agent_result);
  const warnings = Array.isArray(analysis?.warnings) ? analysis.warnings : [];
  const blockingIssues = getStrings(safety?.blocking_issues);
  const safetyWarnings = getStrings(safety?.warnings);
  const riskReasons = getStrings(risk?.reasons);
  const explanation = getStrings(analysis?.explanation);
  const unfulfilledRequirements = getStrings(resourceResult?.unfulfilled_requirements);
  const missingFields = [...new Set([
    ...getStrings(dataQuality?.missing_fields),
    ...getStrings(situation?.missing_information),
  ])];
  const missingDetails = getMissingIncidentDetails(missingFields);
  const humanReviewRequired = getBoolean(analysis, 'human_review_required')
    ?? getBoolean(autonomy, 'human_review_required');
  const dataConfidence = getNumber(dataQuality, 'confidence');
  const pipelineConfidence = getNumber(analysis, 'overall_confidence');
  const displayedConfidence = dataConfidence ?? pipelineConfidence;
  const plans = incident && incidentDetails?.id === incident.id
    ? sortedPlans(incidentDetails.dispatchPlans.filter(plan => plan.incidentId === incident.id))
    : [];
  const latestPlan = plans[0] ?? null;
  const latestPlanStatus = presentDecisionStatus(latestPlan?.status);
  const predictionAvailable = isPredictionAvailable(prediction);
  const safetyStatus = getString(safety, 'status');
  const safetyBlocked = safetyStatus?.toUpperCase() === 'BLOCKED' || blockingIssues.length > 0;
  const autonomyMode = getString(autonomy, 'mode');

  return (
    <>
      <div className="page-heading decision-page-heading">
        <div>
          <div className="eyebrow"><span /> HUMAN-IN-THE-LOOP REVIEW</div>
          <h1>Decision Engine</h1>
          <p>Understand the incident, the recommendation, and the safety conditions before moving to dispatch review.</p>
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
            <p>This page displays the latest real analysis returned in this browser session. It does not generate recommendations or substitute sample data.</p>
          </div>
          <Link className="primary-button" to="/incidents">Go to incidents <ArrowRight size={14} /></Link>
        </section>
      ) : (
        <>
          <section className="decision-incident" aria-labelledby="decision-incident-title">
            <div className="decision-incident-icon"><FileText size={20} /></div>
            <div className="decision-incident-copy">
              <span className="decision-kicker">INCIDENT UNDER REVIEW</span>
              <h2 id="decision-incident-title">{incident.title}</h2>
              <p>{incident.type || 'Category unavailable'} · Incident {incident.id}</p>
              <div className="decision-incident-meta">
                <span><MapPin size={13} /> {incident.locationLat !== null && incident.locationLng !== null
                  ? `${incident.locationLat.toFixed(5)}, ${incident.locationLng.toFixed(5)}`
                  : 'Location not provided'}</span>
                <span><UsersRound size={13} /> {incident.victimCount === null ? 'Victim count not provided' : `${incident.victimCount} people reported`}</span>
                {analysis.trace_id && <span>Trace {analysis.trace_id}</span>}
                <span>Analysis received {formatTime(latestAnalysis.receivedAt)}</span>
              </div>
            </div>
            <Link className="decision-intelligence-link" to="/intelligence">
              View AI details <ArrowRight size={14} />
            </Link>
          </section>

          <section className="decision-facts-grid" aria-label="Incident details used for review">
            <div><span>Category</span><strong>{incident.type || 'Not provided'}</strong></div>
            <div><span>Current status</span><strong>{incident.status || 'Not provided'}</strong></div>
            <div><span>People affected</span><strong>{incident.victimCount ?? 'Not provided'}</strong></div>
            <div><span>Older adults</span><strong>{incident.elderlyCount ?? 'Not provided'}</strong></div>
            <div><span>Children</span><strong>{incident.childrenCount ?? 'Not provided'}</strong></div>
            <div><span>People with disabilities</span><strong>{incident.disabledCount ?? 'Not provided'}</strong></div>
            <div className="decision-facts-description"><span>Incident description</span><strong>{incident.description || 'Not provided'}</strong></div>
            <div><span>Last updated</span><strong>{incident.updatedAt ? formatTime(incident.updatedAt) : 'Not provided'}</strong></div>
          </section>

          <section className="decision-overview" aria-label="Decision summary">
            <article className="decision-overview-card decision-action-card">
              <span className="decision-kicker">AI RECOMMENDATION</span>
              <h2>{getString(analysis, 'recommended_action') || 'Recommendation not returned'}</h2>
              <p>This is advice for review. It is not approval or a dispatch order.</p>
            </article>
            <article className="decision-overview-card">
              <span className="decision-kicker">RISK AND PRIORITY</span>
              <strong className={`risk-badge risk-${(getString(risk, 'risk_level') || 'unknown').toLowerCase()}`}>
                {getString(risk, 'risk_level') || 'Not returned'}
              </strong>
              <p>{formatPriority(risk?.priority)}{getNumber(risk, 'score') === null ? '' : ` · Score ${getNumber(risk, 'score')}/100`}</p>
            </article>
            <article className="decision-overview-card">
              <span className="decision-kicker">{dataConfidence === null ? 'PIPELINE CONFIDENCE' : 'INPUT / DATA CONFIDENCE'}</span>
              <strong>{displayedConfidence === null ? 'Not returned' : `${Math.round(displayedConfidence * 100)}%`}</strong>
              <p>{dataConfidence === null
                ? 'Overall agent confidence was returned; it is not the probability that a prediction is correct.'
                : 'Data-quality confidence describes the input assessment; it is not the probability that a prediction is correct.'}</p>
            </article>
            <article className="decision-overview-card">
              <span className="decision-kicker">OPERATOR APPROVAL</span>
              <strong className="decision-approval-required">Required before dispatch</strong>
              <p>AI review flag: {humanReviewRequired === null ? 'not returned' : humanReviewRequired ? 'additional human review required' : 'not flagged by AI'}.</p>
            </article>
          </section>

          <div className="decision-content-grid decision-content-grid-readable">
            <section className="decision-panel" aria-labelledby="decision-review-title">
              <div className="decision-panel-heading">
                <div>
                  <span className="decision-kicker">WHY THIS RECOMMENDATION</span>
                  <h2 id="decision-review-title">Evidence and context</h2>
                </div>
                <span className="decision-panel-icon"><Gauge size={17} /></span>
              </div>
              {getString(situation, 'summary') && (
                <div className="decision-situation-summary">
                  <span>Situation assessment</span>
                  <p>{getString(situation, 'summary')}</p>
                </div>
              )}
              <DecisionList title="Main incident factors" items={riskReasons} emptyText="No risk factors were returned." />
              <DecisionList title="Recommendation explanation" items={explanation} emptyText="No explanation was returned." />
              {predictionAvailable && (
                <div className="decision-prediction-note">
                  <span>Trend prediction</span>
                  <strong>{getBoolean(prediction, 'escalation_detected') === null
                    ? 'Prediction returned; escalation status not provided'
                    : getBoolean(prediction, 'escalation_detected') ? 'Escalation detected' : 'No escalation detected'}</strong>
                </div>
              )}
              {prediction && !predictionAvailable && (
                <div className="decision-prediction-note is-info">
                  <span>Trend prediction</span>
                  <strong>Unavailable; this does not invalidate the other analysis results.</strong>
                </div>
              )}
              {unfulfilledRequirements.length > 0 && (
                <DecisionList title="Unfulfilled response requirements" items={unfulfilledRequirements} emptyText="" tone="warning" />
              )}
              <div className="decision-missing-details">
                <h3>Information to confirm</h3>
                {missingDetails.length > 0 ? (
                  <ul>
                    {missingDetails.map(detail => (
                      <li key={detail.key}><strong>{detail.label}</strong><span>{detail.guidance}</span></li>
                    ))}
                  </ul>
                ) : (
                  <p>{dataQuality || situation ? 'No missing information was reported by the analysis.' : 'No data-quality result was returned.'}</p>
                )}
              </div>
            </section>

            <section className="decision-panel decision-safety-panel" aria-labelledby="decision-safety-title">
              <div className="decision-panel-heading">
                <div>
                  <span className="decision-kicker">SAFETY AND REVIEW</span>
                  <h2 id="decision-safety-title">Approval conditions</h2>
                </div>
                <span className="decision-panel-icon">{safetyBlocked ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}</span>
              </div>
              {safety ? (
                <>
                  <div className={`decision-safety-state${safetyBlocked ? ' is-blocked' : ''}`}>
                    {safetyBlocked ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
                    <div>
                      <strong>{safetyStatus || 'Safety status not returned'}</strong>
                      <span>{getBoolean(safety, 'is_safe_for_autonomous_execution') === true
                        ? 'Marked safe for autonomous execution by the AI response'
                        : 'Autonomous execution is not permitted by this result'}</span>
                    </div>
                  </div>
                  <DecisionList title="Blocking safety issues" items={blockingIssues} emptyText={safetyBlocked ? 'The response marked this plan as blocked.' : 'No blocking issue was returned.'} tone="danger" />
                  <DecisionList title="Warnings and precautions" items={safetyWarnings} emptyText="No safety warnings were returned." tone="warning" />
                </>
              ) : (
                <div className="decision-unavailable"><ShieldAlert size={17} /><p>No safety-check result was included. This plan cannot be approved without one.</p></div>
              )}
              <div className={`decision-review-requirement${humanReviewRequired ? ' is-required' : ''}`}>
                <UserRoundCheck size={18} />
                <div>
                  <strong>Operator decision is always required before dispatch</strong>
                  <p>AI review flag: {humanReviewRequired === null ? 'not returned' : humanReviewRequired ? 'human review required' : 'not marked as required'}. {getString(autonomy, 'reason') || 'The AI review flag does not replace the operator approval step.'}</p>
                </div>
              </div>
              {autonomyMode && <p className="decision-autonomy-mode">AI autonomy mode: <strong>{autonomyMode}</strong></p>}
              <DecisionList title="Outstanding safety actions" items={getStrings(autonomy?.blocking_factors)} emptyText="" tone="warning" />
            </section>
          </div>

          <section className="decision-panel decision-warnings-panel" aria-labelledby="decision-warnings-title">
            <div className="decision-panel-heading">
              <div>
                <span className="decision-kicker">ANALYSIS LIMITATIONS</span>
                <h2 id="decision-warnings-title">Warnings and notices</h2>
              </div>
              <span className="decision-panel-icon"><AlertTriangle size={17} /></span>
            </div>
            <AnalysisWarningGroups warnings={warnings} />
          </section>

          <details className="decision-technical-details">
            <summary>Technical analysis details</summary>
            <p>Raw response data is shown for diagnostics; it does not override the safety or approval requirements above.</p>
            <pre>{JSON.stringify({
              data_quality: dataQuality,
              situation,
              risk,
              prediction,
              resource_agent_result: resourceResult,
              safety_check: safety,
              autonomy_decision: autonomy,
              trace: analysis.trace,
            }, null, 2)}</pre>
          </details>

          <section className="decision-panel decision-history-panel" aria-labelledby="decision-history-title">
            <div className="decision-panel-heading">
              <div>
                <span className="decision-kicker">PERSISTED PLAN VERSIONS</span>
                <h2 id="decision-history-title">Plan status history</h2>
                <p>Every analysis creates a new plan record; earlier versions remain available for audit. The newest version is highlighted.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => { void refetch(); }} disabled={isLoadingHistory || !incident}>
                <RefreshCw size={14} className={isLoadingHistory ? 'is-spinning' : undefined} /> Refresh
              </button>
            </div>
            {isLoadingHistory ? (
              <div className="decision-state-message" role="status">
                <LoaderCircle size={18} className="is-spinning" /> Loading plan versions…
              </div>
            ) : historyError ? (
              <div className="decision-state-message is-error" role="alert">
                <AlertTriangle size={18} />
                <div><strong>Could not load plan history</strong><p>{historyError}</p></div>
                <button className="text-button" type="button" onClick={() => { void refetch(); }}>Try again</button>
              </div>
            ) : plans.length > 0 ? (
              <ol className="decision-history-list">
                {plans.map((plan, index) => {
                  const status = presentDecisionStatus(plan.status);
                  return (
                    <li className={index === 0 ? 'is-latest' : ''} key={plan.id}>
                      <span className={`decision-history-marker decision-status-${status.tone}`}>
                        {status.tone === 'approved' || status.tone === 'executed'
                          ? <CheckCircle2 size={15} />
                          : status.tone === 'cancelled'
                            ? <XCircle size={15} />
                            : <Clock3 size={15} />}
                      </span>
                      <div className="decision-history-entry">
                        <div>
                          <strong>{index === 0 ? 'Latest version · ' : `Earlier version ${plans.length - index} · `}{status.label}</strong>
                          <span>Plan {plan.id}</span>
                        </div>
                        <div className="decision-history-times">
                          <span>Created {formatTime(plan.createdAt)}</span>
                          <span>Updated {formatTime(plan.updatedAt)}</span>
                        </div>
                        <Link to={`/dispatch?planId=${encodeURIComponent(plan.id)}`} className="decision-history-link">
                          Review in Planning &amp; Dispatch <ArrowRight size={13} />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="decision-state-message">
                <Clock3 size={18} />
                <p>No dispatch plan is currently recorded for this incident.</p>
              </div>
            )}
          </section>

          <section className="decision-action-boundary" aria-label="Approval and dispatch actions">
            <UserRoundCheck size={18} />
            <div>
              <strong>Approval and execution are separate recorded steps</strong>
              <p>Continue to Planning &amp; Dispatch to review requirements, record an approval, and execute only an approved plan. Execution is blocked when safety checks fail or assigned resources are unavailable.</p>
            </div>
            <Link to={latestPlan ? `/dispatch?planId=${encodeURIComponent(latestPlan.id)}` : '/dispatch'} className="primary-button">
              Open dispatch review <ArrowRight size={14} />
            </Link>
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
