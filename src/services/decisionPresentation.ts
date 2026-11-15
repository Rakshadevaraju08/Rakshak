export type DecisionStatusTone = 'pending' | 'approved' | 'executed' | 'cancelled' | 'unknown';

export interface DecisionStatusPresentation {
  label: string;
  tone: DecisionStatusTone;
}

const decisionStatuses: Record<string, DecisionStatusPresentation> = {
  PENDING: { label: 'Pending operator review', tone: 'pending' },
  APPROVED: { label: 'Approved', tone: 'approved' },
  EXECUTED: { label: 'Execution recorded', tone: 'executed' },
  CANCELLED: { label: 'Cancelled', tone: 'cancelled' },
};

export function presentDecisionStatus(status: unknown): DecisionStatusPresentation {
  if (typeof status !== 'string' || !status.trim()) {
    return { label: 'Status unavailable', tone: 'unknown' };
  }

  const normalized = status.trim().toUpperCase();
  return decisionStatuses[normalized] ?? {
    label: status.trim(),
    tone: 'unknown',
  };
}
