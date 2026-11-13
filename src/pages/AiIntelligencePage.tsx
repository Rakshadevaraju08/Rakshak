import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  GitBranch,
  MapPin,
  Route as RouteIcon,
  ShieldCheck,
  Siren,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAnalysisContext } from '../contexts/AnalysisContext';
import { isJsonRecord, type FullResponsePlan, type JsonRecord } from '../services/api';

type AgentDefinition = {
  name: string;
  title: string;
  responsibility: string;
  icon: LucideIcon;
  outputKey: string;
};

const agents: AgentDefinition[] = [
  {
    name: 'DataQualityAgent',
    title: 'Data quality',
    responsibility: 'Checks observation freshness, value ranges, missing inputs, and conflicting data.',
    icon: Database,
    outputKey: 'data_quality',
  },
  {
    name: 'SituationAgent',
    title: 'Situation analysis',
    responsibility: 'Validates and normalizes incident details, summarizes context, and identifies missing information.',
    icon: FileSearch,
    outputKey: 'situation',
  },
  {
    name: 'RiskAgent',
    title: 'Risk assessment',
    responsibility: 'Assigns an incident priority, risk level, score, and reasons.',
    icon: Gauge,
    outputKey: 'risk',
  },
  {
    name: 'PredictiveAgent',
    title: 'Risk prediction',
    responsibility: 'Estimates near-term risk changes from current risk and available environmental trends.',
    icon: Activity,
    outputKey: 'prediction',
  },
  {
    name: 'ResourceAgent',
    title: 'Resource planning',
    responsibility: 'Matches available units to the incident and reports unfulfilled requirements.',
    icon: UsersRound,
    outputKey: 'resource_agent_result',
  },
  {
    name: 'RouteAgent',
    title: 'Route analysis',
    responsibility: 'Calculates routes for selected resources, with a fallback estimate if road routing is unavailable.',
    icon: RouteIcon,
    outputKey: 'route',
  },
  {
    name: 'ResponseSafetyChecker',
    title: 'Safety validation',
    responsibility: 'Checks plan consistency, resource and route constraints, data quality, and confidence.',
    icon: ShieldCheck,
    outputKey: 'safety_check',
  },
  {
    name: 'AutonomyDecisionMaker',
    title: 'Review requirement',
    responsibility: 'Determines the plan’s autonomy mode and whether human review is required.',
    icon: UserRoundCheck,
    outputKey: 'autonomy_decision',
  },
  {
    name: 'MasterCoordinator',
    title: 'Pipeline coordinator',
    responsibility: 'Runs the analysis stages, validates the assembled plan, and returns a FullResponsePlan.',
    icon: Workflow,
    outputKey: 'coordinator',
  },
];

const architectureStages = [
  { title: 'Citizen SOS', detail: 'POST /api/sos', icon: Siren, kind: 'Backend flow' },
  { title: 'Backend record', detail: 'Stores the incident', icon: Database, kind: 'Backend flow' },
  { title: 'Operator request', detail: 'POST /api/incidents/:id/analyze', icon: UserRoundCheck, kind: 'Operator action' },
  { title: 'Data quality', detail: 'DataQualityAgent', icon: FileSearch, kind: 'AI pipeline' },
  { title: 'Situation', detail: 'SituationAgent', icon: BrainCircuit, kind: 'AI pipeline' },
  { title: 'Risk assessment', detail: 'RiskAgent', icon: Gauge, kind: 'AI pipeline' },
  { title: 'Prediction', detail: 'PredictiveAgent', icon: Activity, kind: 'AI pipeline' },
  { title: 'Resource planning', detail: 'ResourceAgent', icon: UsersRound, kind: 'AI pipeline' },
  { title: 'Route analysis', detail: 'RouteAgent, when assigned', icon: RouteIcon, kind: 'Conditional' },
  { title: 'Safety validation', detail: 'ResponseSafetyChecker', icon: ShieldCheck, kind: 'AI pipeline' },
  { title: 'Review decision', detail: 'AutonomyDecisionMaker · operator review if required', icon: UserRoundCheck, kind: 'Operator control' },
];

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

function getRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isJsonRecord) : [];
}

function getStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function slug(value: string | null): string {
  return value?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'unknown';
}

function percent(value: number | null): string {
  return value === null ? 'Not returned' : `${Math.round(value * 100)}%`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function traceSteps(response: FullResponsePlan | null): JsonRecord[] {
  const trace = getRecord(response?.trace);
  return getRecords(trace?.steps);
}

function outputAvailable(agent: AgentDefinition, response: FullResponsePlan): boolean {
  if (agent.outputKey === 'route') {
    return getRecords(response.assignments).some(assignment => getRecord(assignment.route) !== null);
  }
  if (agent.outputKey === 'coordinator') return true;
  return getRecord(response[agent.outputKey]) !== null;
}

function summarizeAgent(agent: AgentDefinition, response: FullResponsePlan): string {
  const output = getRecord(response[agent.outputKey]);
  switch (agent.outputKey) {
    case 'data_quality': {
      const quality = getString(output, 'overall_quality');
      const missing = getStrings(output?.missing_fields).length;
      return quality
        ? `${quality} quality${missing ? ` · ${missing} missing field${missing === 1 ? '' : 's'}` : ''}`
        : 'Data quality result returned';
    }
    case 'situation':
      return getString(output, 'summary') || 'Situation result returned';
    case 'risk': {
      const level = getString(output, 'risk_level');
      const score = getNumber(output, 'score');
      return [level, score === null ? null : `score ${score}/100`].filter(Boolean).join(' · ')
        || 'Risk result returned';
    }
    case 'prediction': {
      const escalation = getBoolean(output, 'escalation_detected');
      return escalation === null
        ? 'Prediction result returned'
        : escalation ? 'Escalation detected by response' : 'No escalation reported';
    }
    case 'resource_agent_result': {
      const assignmentCount = getRecords(output?.assignments).length;
      const unmetCount = getStrings(output?.unfulfilled_requirements).length;
      return `${assignmentCount} assignment${assignmentCount === 1 ? '' : 's'} · ${unmetCount} unfulfilled requirement${unmetCount === 1 ? '' : 's'}`;
    }
    case 'route': {
      const routes = getRecords(response.assignments)
        .filter(assignment => getRecord(assignment.route) !== null).length;
      return routes ? `${routes} route result${routes === 1 ? '' : 's'} in assignments` : 'No route result returned';
    }
    case 'safety_check':
      return getString(output, 'status') || 'Safety result returned';
    case 'autonomy_decision':
      return getString(output, 'mode') || 'Autonomy decision returned';
    default:
      return response.degraded ? 'Plan returned in a degraded state' : 'FullResponsePlan returned';
  }
}

function agentTraceStatus(agentName: string, steps: JsonRecord[]): string | null {
  const matching = steps.filter(step => getString(step, 'agent_name') === agentName);
  const latest = matching[matching.length - 1];
  return getString(latest, 'status');
}

function incidentEvidence(incident: {
  title: string;
  type?: string | null;
  status?: string | null;
  createdAt?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  victimCount?: number | null;
  elderlyCount?: number | null;
  childrenCount?: number | null;
  disabledCount?: number | null;
  description?: string | null;
}) {
  const location = typeof incident.locationLat === 'number' && typeof incident.locationLng === 'number'
    ? `${incident.locationLat.toFixed(5)}, ${incident.locationLng.toFixed(5)}`
    : null;
  const vulnerable = [
    typeof incident.elderlyCount === 'number' ? `Elderly: ${incident.elderlyCount}` : null,
    typeof incident.childrenCount === 'number' ? `Children: ${incident.childrenCount}` : null,
    typeof incident.disabledCount === 'number' ? `People with disabilities: ${incident.disabledCount}` : null,
  ].filter((item): item is string => item !== null);

  return [
    { label: 'Report title', value: incident.title || null },
    { label: 'Category', value: incident.type || null },
    { label: 'Description', value: incident.description || null },
    { label: 'Coordinates', value: location },
    { label: 'Reported time', value: incident.createdAt || null },
    { label: 'Reported victims', value: typeof incident.victimCount === 'number' ? String(incident.victimCount) : null },
    { label: 'Vulnerable groups', value: vulnerable.length ? vulnerable.join(' · ') : null },
  ];
}

function AiIntelligencePage() {
  const { latestAnalysis } = useAnalysisContext();
  const response = latestAnalysis?.response ?? null;
  const incident = latestAnalysis?.incident ?? null;
  const situation = getRecord(response?.situation);
  const risk = getRecord(response?.risk);
  const prediction = getRecord(response?.prediction);
  const dataQuality = getRecord(response?.data_quality);
  const safety = getRecord(response?.safety_check);
  const autonomy = getRecord(response?.autonomy_decision);
  const assignments = getRecords(response?.assignments);
  const steps = traceSteps(response);
  const trace = getRecord(response?.trace);
  const missingInputs = [...new Set([
    ...getStrings(dataQuality?.missing_fields),
    ...getStrings(situation?.missing_information),
  ])];
  const evidence = incident ? incidentEvidence(incident) : [];
  const riskLevel = getString(risk, 'risk_level');
  const humanReview = response
    ? getBoolean(response, 'human_review_required') ?? getBoolean(autonomy, 'human_review_required')
    : null;
  const warnings = Array.isArray(response?.warnings) ? response.warnings : [];

  return (
    <>
      <div className="page-heading intel-page-heading">
        <div>
          <div className="eyebrow"><span /> EXPLAINABLE AI WORKSPACE</div>
          <h1>AI Intelligence Centre</h1>
          <p>Follow the implemented analysis pipeline and inspect its real outputs, limitations, and safety decisions.</p>
        </div>
        <Link className="secondary-button intel-open-incidents" to="/incidents">
          Open incidents <ArrowRight size={15} />
        </Link>
      </div>

      <section className={`intel-current${response ? '' : ' intel-current-empty'}`} aria-labelledby="intel-current-title">
        <div className="intel-current-icon"><BrainCircuit size={21} /></div>
        <div className="intel-current-copy">
          <span className="intel-kicker">LATEST ANALYSIS · CURRENT BROWSER SESSION</span>
          <h2 id="intel-current-title">
            {incident ? incident.title : 'No analysis response in this session'}
          </h2>
          <p>
            {incident
              ? `${incident.type || 'Category not provided'} · Received ${latestAnalysis ? dateLabel(latestAnalysis.receivedAt) : ''}`
              : 'Run “Analyse with AI” for a real incident from the Incidents page. This centre does not generate sample results or request analysis automatically.'}
          </p>
          {response && (
            <div className="intel-current-meta">
              <span>{getString(response, 'incident_id') ? `Incident ${getString(response, 'incident_id')}` : incident?.id}</span>
              {getString(response, 'trace_id') && <span>Trace {getString(response, 'trace_id')}</span>}
              <span>{response.degraded ? 'Degraded pipeline response' : 'Pipeline response returned'}</span>
            </div>
          )}
        </div>
        {response && (
          <div className="intel-current-risk">
            <span>AI risk classification</span>
            <strong className={`risk-badge risk-${slug(riskLevel)}`}>{riskLevel || 'Not returned'}</strong>
          </div>
        )}
      </section>

      <section className="intel-section" aria-labelledby="intel-architecture-title">
        <div className="intel-section-heading">
          <div>
            <span className="intel-kicker">HOW THE REQUEST FLOWS</span>
            <h2 id="intel-architecture-title">AI architecture</h2>
            <p>An operator currently requests analysis from the stored incident; SOS submission alone does not run this pipeline.</p>
          </div>
          <span className="intel-section-mark"><GitBranch size={17} /> Implemented flow</span>
        </div>
        <div className="intel-flow" aria-label="Citizen SOS to AI analysis and review flow">
          {architectureStages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div className="intel-flow-item" key={stage.title}>
                <article className={`intel-flow-node intel-flow-${slug(stage.kind)}`}>
                  <span className="intel-flow-kind">{stage.kind}</span>
                  <span className="intel-flow-icon"><Icon size={17} /></span>
                  <strong>{stage.title}</strong>
                  <small>{stage.detail}</small>
                </article>
                {index < architectureStages.length - 1 && <ArrowRight className="intel-flow-arrow" size={16} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
        <div className="intel-flow-note">
          <ShieldCheck size={16} />
          <p>Resource and route outputs are recommendations. The backend records a pending plan; this analysis view does not dispatch units or record an operator approval.</p>
        </div>
        <div className="intel-planned">
          <div>
            <Sparkles size={16} />
            <strong>Documented but not active by default</strong>
          </div>
          <p>
            The Situation Agent does not currently parse free-text with NLP. The coordinator also creates
            RiskAgent and PredictiveAgent with their default rule-based/baseline modes; optional ML inference
            is not enabled by these defaults.
          </p>
        </div>
      </section>

      <section className="intel-section" aria-labelledby="intel-agents-title">
        <div className="intel-section-heading">
          <div>
            <span className="intel-kicker">STATUS FROM THE RESPONSE TRACE</span>
            <h2 id="intel-agents-title">AI agent monitor</h2>
            <p>Agent names and responsibilities reflect the implemented service. Statuses are taken from the latest returned trace only.</p>
          </div>
          <span className="intel-section-mark"><Activity size={17} /> {response ? `${steps.length} trace steps returned` : 'No trace loaded'}</span>
        </div>
        <div className="intel-agent-grid">
          {agents.map(agent => {
            const Icon = agent.icon;
            const status = response ? agentTraceStatus(agent.name, steps) : null;
            const hasOutput = response ? outputAvailable(agent, response) : false;
            const matchingSteps = steps.filter(step => getString(step, 'agent_name') === agent.name);
            return (
              <article className="intel-agent-card" key={agent.name}>
                <div className="intel-agent-top">
                  <span className="intel-agent-icon"><Icon size={17} /></span>
                  <span className={`intel-agent-status ${status ? `trace-${slug(status)}` : ''}`}>
                    {status || (response && hasOutput ? 'Output returned' : response ? 'Not in trace' : 'No analysis')}
                  </span>
                </div>
                <h3>{agent.title}</h3>
                <code>{agent.name}</code>
                <p>{agent.responsibility}</p>
                <div className="intel-agent-output">
                  <span>{hasOutput ? 'Response output' : 'Output status'}</span>
                  <strong>{response
                    ? hasOutput
                      ? summarizeAgent(agent, response)
                      : 'No output field returned'
                    : 'Available after an analysis response'}
                  </strong>
                  {matchingSteps.length > 1 && <small>{matchingSteps.length} trace entries</small>}
                  {response && status && !hasOutput && <small>Trace status is shown; the output is absent from this response.</small>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="intel-section" aria-labelledby="intel-risk-title">
        <div className="intel-section-heading">
          <div>
            <span className="intel-kicker">CLASSIFICATION · CONFIDENCE · INPUTS</span>
            <h2 id="intel-risk-title">Risk intelligence</h2>
            <p>Risk and prediction values below come only from the latest FullResponsePlan.</p>
          </div>
        </div>
        {response ? (
          <div className="intel-risk-grid">
            <article className="intel-card intel-risk-card">
              <div className="intel-card-heading">
                <div><Gauge size={17} /><h3>Risk assessment</h3></div>
                <span className={`risk-badge risk-${slug(riskLevel)}`}>{riskLevel || 'Not returned'}</span>
              </div>
              {getNumber(risk, 'score') !== null && (
                <div className="intel-risk-score">
                  <div><strong>{getNumber(risk, 'score')}</strong><span> / 100</span></div>
                  <div className="intel-score-track" role="meter" aria-label="AI risk score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={getNumber(risk, 'score') ?? 0}>
                    <span style={{ width: `${Math.min(100, Math.max(0, getNumber(risk, 'score') ?? 0))}%` }} />
                  </div>
                </div>
              )}
              <div className="intel-metric-pair">
                <div><span>Priority</span><strong>{getString(risk, 'priority') || 'Not returned'}</strong></div>
                <div><span>Risk confidence</span><strong>{percent(getNumber(risk, 'confidence'))}</strong></div>
                <div><span>Pipeline confidence</span><strong>{percent(getNumber(response, 'overall_confidence'))}</strong></div>
                <div><span>Prediction confidence</span><strong>{percent(getNumber(prediction, 'confidence'))}</strong></div>
              </div>
              <StringList title="Risk reasons" items={getStrings(risk?.reasons)} emptyText="No risk reasons were returned." />
            </article>

            <article className="intel-card">
              <div className="intel-card-heading"><div><Activity size={17} /><h3>Prediction</h3></div></div>
              {prediction ? (
                <>
                  <div className="intel-prediction-state">
                    <span>Current risk</span><strong>{getString(prediction, 'current_risk') || 'Not returned'}</strong>
                    <span>Escalation</span>
                    <strong>{getBoolean(prediction, 'escalation_detected') === null
                      ? 'Not returned'
                      : getBoolean(prediction, 'escalation_detected') ? 'Detected' : 'Not detected'}</strong>
                  </div>
                  {getRecords(prediction.forecast).length > 0 && (
                    <div className="intel-forecast">
                      {getRecords(prediction.forecast).map((forecast, index) => (
                        <div key={`${getNumber(forecast, 'horizon_minutes') ?? index}-${index}`}>
                          <span>{getNumber(forecast, 'horizon_minutes') ?? '—'} minute horizon</span>
                          <strong className={`risk-badge risk-${slug(getString(forecast, 'risk_level'))}`}>
                            {getString(forecast, 'risk_level') || 'Not returned'}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <StringList title="Prediction explanation" items={getStrings(prediction.explanation)} emptyText="No prediction explanation was returned." />
                </>
              ) : <p className="intel-muted">No prediction object was returned.</p>}
            </article>

            <article className="intel-card intel-input-card">
              <div className="intel-card-heading"><div><MapPin size={17} /><h3>Incident information available</h3></div></div>
              <div className="intel-evidence-list">
                {evidence.map(item => (
                  <div className="intel-evidence-row" key={item.label}>
                    <span>{item.label}</span>
                    <strong className={item.value ? '' : 'is-missing'}>{item.value || 'Not provided in incident record'}</strong>
                  </div>
                ))}
              </div>
              <div className="intel-missing-fields">
                <strong>Missing fields reported by analysis</strong>
                {missingInputs.length > 0
                  ? <div>{missingInputs.map(field => <span key={field}>{field}</span>)}</div>
                  : <p>No missing fields were listed by the returned data-quality and situation results.</p>}
              </div>
              {dataQuality && (
                <div className="intel-quality-meta">
                  <span>Data quality <strong>{getString(dataQuality, 'overall_quality') || 'Not returned'}</strong></span>
                  <span>Data confidence <strong>{percent(getNumber(dataQuality, 'confidence'))}</strong></span>
                </div>
              )}
            </article>
          </div>
        ) : <EmptyAnalysisMessage />}
      </section>

      <section className="intel-section" aria-labelledby="intel-explain-title">
        <div className="intel-section-heading">
          <div>
            <span className="intel-kicker">REASONS · WARNINGS · HUMAN CONTROL</span>
            <h2 id="intel-explain-title">Explainable AI & safety</h2>
            <p>Separate the system’s recommendation and safeguards from an operator’s decision.</p>
          </div>
        </div>
        {response ? (
          <div className="intel-explain-grid">
            <article className="intel-card intel-recommendation">
              <div className="intel-card-heading"><div><Sparkles size={17} /><h3>AI recommendation</h3></div></div>
              <span className="intel-recommended-action">{getString(response, 'recommended_action') || 'Not returned'}</span>
              <StringList title="Explanation" items={getStrings(response.explanation)} emptyText="No overall explanation was returned." />
              <StringList title="Risk factors" items={getStrings(risk?.reasons)} emptyText="" />
              {assignments.length > 0 && (
                <div className="intel-assignment-summary">
                  <strong>Proposed resource assignments</strong>
                  {assignments.map((assignment, index) => {
                    const route = getRecord(assignment.route);
                    const routeDetails = [
                      getString(route, 'route_status'),
                      getNumber(route, 'distance_km') === null ? null : `${getNumber(route, 'distance_km')} km`,
                      getNumber(assignment, 'estimated_arrival_time_mins') === null
                        ? null
                        : `ETA ${getNumber(assignment, 'estimated_arrival_time_mins')} min`,
                    ].filter((detail): detail is string => detail !== null);
                    return (
                      <div key={`${getString(assignment, 'resource_id') || 'assignment'}-${index}`}>
                        <span>
                          {getString(assignment, 'resource_id') || 'Resource ID not returned'}
                          {routeDetails.length > 0 && <small>{routeDetails.join(' · ')}</small>}
                        </span>
                        <small>{getString(assignment, 'action') || 'Action not returned'}</small>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="intel-card intel-safety-card">
              <div className="intel-card-heading"><div><ShieldCheck size={17} /><h3>Safety checks</h3></div></div>
              <div className="intel-safety-summary">
                <span className={`safety-badge safety-${slug(getString(safety, 'status'))}`}>
                  {getString(safety, 'status') || 'Status not returned'}
                </span>
                <span>{getNumber(safety, 'checks_performed') === null
                  ? 'Check count not returned'
                  : `${getNumber(safety, 'checks_performed')} checks reported`}
                </span>
              </div>
              <StringList title="Blocking issues" items={getStrings(safety?.blocking_issues)} emptyText="No blocking issues were returned." />
              <StringList title="Safety warnings" items={getStrings(safety?.warnings)} emptyText="No safety warnings were returned." />
              <div className="intel-review-box">
                {humanReview
                  ? <AlertTriangle size={17} />
                  : humanReview === false ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
                <div>
                  <strong>Human review: {humanReview === null ? 'Not returned' : humanReview ? 'Required' : 'Not required by AI response'}</strong>
                  <p>{getString(autonomy, 'reason') || 'No autonomy decision explanation was returned.'}</p>
                </div>
              </div>
              <div className="intel-operator-note">
                <UserRoundCheck size={16} />
                <p><strong>Operator decision:</strong> not recorded in this AI response. A recommendation is not an approval or a dispatch.</p>
              </div>
            </article>

            <article className="intel-card intel-warnings-card">
              <div className="intel-card-heading"><div><AlertTriangle size={17} /><h3>Pipeline warnings</h3></div></div>
              {warnings.length > 0 ? (
                <ul className="intel-warning-list">
                  {warnings.map((warning, index) => {
                    const item = getRecord(warning);
                    return (
                      <li key={`${getString(item, 'code') || 'warning'}-${index}`}>
                        <AlertTriangle size={15} />
                        <div>
                          <strong>{getString(item, 'code') || 'Warning'}</strong>
                          <span>{getString(item, 'source') || 'Source not returned'}</span>
                          <p>{getString(item, 'message') || (typeof warning === 'string' ? warning : 'Warning detail not returned.')}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="intel-muted">No pipeline warnings were returned.</p>}
            </article>
          </div>
        ) : <EmptyAnalysisMessage />}
      </section>

      <section className="intel-section" aria-labelledby="intel-trace-title">
        <div className="intel-section-heading">
          <div>
            <span className="intel-kicker">OBSERVABILITY DATA</span>
            <h2 id="intel-trace-title">AI execution trace</h2>
            <p>Steps and statuses are displayed in the order provided by the AI service.</p>
          </div>
          {response && (
            <span className="intel-section-mark">
              <Clock3 size={16} />
              {getNumber(trace, 'total_execution_time_ms') === null
                ? 'Duration not returned'
                : `${getNumber(trace, 'total_execution_time_ms')} ms`}
            </span>
          )}
        </div>
        {response ? (
          steps.length > 0 ? (
            <ol className="intel-trace-list">
              {steps.map((step, index) => {
                const status = getString(step, 'status');
                const stepWarnings = getStrings(step.warnings);
                const errors = getStrings(step.errors);
                return (
                  <li className="intel-trace-item" key={`${getString(step, 'step_name') || 'step'}-${index}`}>
                    <span className={`intel-trace-marker trace-${slug(status)}`}>
                      {status?.toUpperCase() === 'FAILED' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                    </span>
                    <div className="intel-trace-content">
                      <div className="intel-trace-heading">
                        <div><strong>{getString(step, 'step_name') || 'Pipeline step'}</strong><span>{getString(step, 'agent_name') || 'Agent name not returned'}</span></div>
                        <div className="intel-trace-meta">
                          <span className={`intel-agent-status trace-${slug(status)}`}>{status || 'Status not returned'}</span>
                          {getNumber(step, 'execution_time_ms') !== null && <span>{getNumber(step, 'execution_time_ms')} ms</span>}
                        </div>
                      </div>
                      {(stepWarnings.length > 0 || errors.length > 0 || getBoolean(step, 'fallback_used') === true) && (
                        <p className="intel-trace-detail">
                          {getBoolean(step, 'fallback_used') === true && <span>Fallback used</span>}
                          {[...stepWarnings, ...errors].map((message, itemIndex) => <span key={`${index}-${itemIndex}`}>{message}</span>)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="intel-empty-trace">
              <GitBranch size={20} />
              <p>No trace steps were included in this response{getString(response, 'trace_id') ? ` (trace ${getString(response, 'trace_id')})` : ''}.</p>
            </div>
          )
        ) : <EmptyAnalysisMessage />}
        {response && <div className="intel-trace-footnote">Missing trace data is shown as unavailable; no execution steps are inferred.</div>}
      </section>

      <div className="intel-history-note">
        <Clock3 size={15} />
        <span>The backend API currently returns analysis when requested but does not expose a frontend analysis-history query. This view keeps only the latest successful response in browser memory; refreshing clears it.</span>
      </div>
    </>
  );
}

function StringList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  if (!items.length && !emptyText) return null;
  return (
    <div className="intel-string-list">
      {title && <h4>{title}</h4>}
      {items.length > 0
        ? <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        : <p className="intel-muted">{emptyText}</p>}
    </div>
  );
}

function EmptyAnalysisMessage() {
  return (
    <div className="intel-empty-analysis">
      <span><BrainCircuit size={20} /></span>
      <div>
        <strong>No real analysis response is available yet</strong>
        <p>Open Incidents and request an analysis. The returned response will appear here without a second API call.</p>
      </div>
      <Link to="/incidents">Go to incidents <ArrowRight size={14} /></Link>
    </div>
  );
}

export default AiIntelligencePage;
