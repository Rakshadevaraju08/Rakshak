// Derives the six-agent pipeline view model from the AI service's FullResponsePlan.
// Keeping this in one place means the operator dashboard always renders exactly what
// the Master Coordinator returned, rather than a hard-coded placeholder.

export const PIPELINE_STAGES = [
  { name: 'Situation Agent', question: 'What is happening?' },
  { name: 'Risk Agent', question: 'How urgent is it?' },
  { name: 'Resource Agent', question: 'Who should respond?' },
  { name: 'Route Agent', question: 'How do we reach them?' },
  { name: 'Predictive Agent', question: 'What happens next?' },
  { name: 'Master Coordinator', question: 'What should we do?' },
];

export const INITIAL_AGENT_STATES = PIPELINE_STAGES.map((stage) => ({ ...stage, status: 'idle' }));

// All six specialists work the request together, so they share a processing state.
export const processingAgentStates = () =>
  PIPELINE_STAGES.map((stage) => ({ ...stage, status: 'processing' }));

// Collapse multi-line, bullet-prefixed explainability strings into one readable line.
function firstLine(text) {
  if (!text || typeof text !== 'string') return '';
  const line = text.split('\n').find((entry) => entry.trim().length > 0) ?? '';
  return line.replace(/^[-•*]\s*/, '').trim();
}

function describeSituation(analysis) {
  const situation = analysis.situation;
  if (!situation) return null;
  const confidence = typeof situation.confidence_score === 'number'
    ? ` Confidence ${Math.round(situation.confidence_score * 100)}%.`
    : '';
  const missing = situation.missing_information?.length
    ? ` Missing: ${situation.missing_information.join(', ')}.`
    : '';
  return `${situation.summary ?? 'Situation assessed.'}${confidence}${missing}`;
}

function describeRisk(analysis) {
  const risk = analysis.risk;
  if (!risk) return null;
  return `${risk.risk_level} risk · priority P${risk.priority} · score ${risk.score}. ${firstLine(risk.reasons?.[0])}`;
}

function describeResources(analysis) {
  const assignments = analysis.assignments ?? [];
  if (!assignments.length) {
    return 'No compatible available resource could be allocated — manual dispatch required.';
  }
  const units = assignments.map((assignment) => assignment.resource_id).filter(Boolean);
  return `${units.length} unit${units.length > 1 ? 's' : ''} allocated: ${units.join(', ')}.`;
}

function describeRoute(analysis) {
  const route = analysis.assignments?.[0]?.route;
  if (!route) return null;
  const eta = typeof route.estimated_time_mins === 'number' ? `${route.estimated_time_mins} min` : 'unknown ETA';
  const distance = typeof route.distance_km === 'number' ? `${route.distance_km} km` : 'unknown distance';
  const status = route.route_status === 'OPEN' ? 'road route verified' : 'road route unavailable — straight-line estimate';
  return `Primary unit ${eta} away (${distance}); ${status}.`;
}

function describePrediction(analysis) {
  const prediction = analysis.prediction;
  if (!prediction) return null;
  const horizon = prediction.forecast?.[prediction.forecast.length - 1];
  const trajectory = prediction.escalation_detected
    ? `Escalation detected — trending toward ${horizon?.risk_level ?? 'CRITICAL'} within ${horizon?.horizon_minutes ?? 60} min.`
    : `No escalation detected — holding at ${prediction.current_risk ?? 'current'} risk.`;
  return `${trajectory} ${firstLine(prediction.explanation?.[0])}`;
}

function describeDecision(analysis) {
  const action = analysis.recommended_action;
  if (!action) return null;
  const warningCount = analysis.warnings?.length ?? 0;
  const warningNote = warningCount
    ? ` ${warningCount} pipeline warning${warningCount > 1 ? 's' : ''} raised (${analysis.degraded ? 'degraded run' : 'nominal'}).`
    : analysis.degraded
      ? ' Run marked degraded.'
      : '';
  return `Final recommendation: ${action}. Awaiting human approval.${warningNote}`;
}

export function agentStatesFromAnalysis(analysis) {
  if (!analysis) return INITIAL_AGENT_STATES;

  const summaries = [
    describeSituation(analysis),
    describeRisk(analysis),
    describeResources(analysis),
    describeRoute(analysis),
    describePrediction(analysis),
    describeDecision(analysis),
  ];

  return PIPELINE_STAGES.map((stage, index) => ({
    ...stage,
    status: summaries[index] ? 'complete' : 'idle',
    summary: summaries[index] || undefined,
  }));
}

export function fallbackAgentStates(message) {
  return PIPELINE_STAGES.map((stage) => ({ ...stage, status: 'idle', summary: message }));
}
