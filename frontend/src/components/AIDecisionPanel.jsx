import { AlertTriangle, Check, Cpu, Info, RefreshCw, Truck } from 'lucide-react';

const STATUS_STYLES = {
  PENDING: 'bg-amber-950/70 text-amber-300 border-amber-700/60',
  EXECUTED: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60',
  APPROVED: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60',
  CANCELLED: 'bg-surface-container text-outline border-outline-variant/40',
};

const ACTION_LABELS = {
  MONITOR: 'Monitor',
  PREPARE: 'Prepare',
  PRE_POSITION: 'Pre-position',
  DISPATCH: 'Dispatch',
  IMMEDIATE_DISPATCH: 'Immediate dispatch',
};

function statusStyle(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.CANCELLED;
}

function Metric({ label, value, tone = 'default' }) {
  const toneClass = tone === 'warn' ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-on-surface';
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-outline">{label}</p>
      <p className={`mt-1 text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function AIDecisionPanel({ plan, onApprove, onReject, isLoading = false }) {
  if (!plan) return null;

  const details = plan.details ?? {};
  const analysis = details.aiAnalysis ?? null;
  const isPending = plan.status === 'PENDING';
  const isFallback = details.source && details.source !== 'AI';
  const action = analysis?.recommended_action ?? 'OPERATIONAL DISPATCH';
  const assignmentCount = details.recommendedResources?.length ?? 0;
  const warnings = analysis?.warnings ?? [];

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-secondary/40 bg-secondary-container/10">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-secondary-container/20 text-secondary">
            <Cpu className="h-4 w-4" />
          </span>
          <div>
            <p className="font-label-action text-sm font-bold text-on-surface">Master Coordinator decision</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-outline">
              {isFallback ? 'Fallback plan' : 'AI consensus'} · plan {plan.id?.slice(0, 8)}
            </p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${statusStyle(plan.status)}`}>
          {plan.status}
        </span>
      </header>

      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-secondary/40 bg-surface-container-lowest p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-outline">Single recommendation</p>
          <p className="mt-1 text-xl font-bold text-secondary">{ACTION_LABELS[action] ?? action}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {analysis?.human_approval_required === false
              ? 'Automated execution permitted.'
              : 'Human authorisation required before any resource is dispatched.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Units assigned" value={assignmentCount} tone={assignmentCount ? 'ok' : 'warn'} />
          <Metric label="Receiving hospital" value={details.recommendedHospitalId ? 'Selected' : 'None'} tone={details.recommendedHospitalId ? 'default' : 'warn'} />
          <Metric label="Pipeline warnings" value={warnings.length} tone={warnings.length ? 'warn' : 'ok'} />
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-2">
            {warnings.map((warning) => (
              <li key={`${warning.source}-${warning.code}`} className="flex items-start gap-2 rounded-lg border border-amber-700/40 bg-amber-950/30 p-2.5 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="text-amber-100">
                  <strong className="font-mono text-[10px] uppercase tracking-wide text-amber-300">{warning.source}</strong>
                  <span className="ml-1.5 text-on-surface-variant">{warning.message}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {details.notes && (
          <details className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <summary className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-wider text-outline">
              Full agent reasoning
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-on-surface-variant">
              {details.notes}
            </pre>
          </details>
        )}

        {isFallback && (
          <p className="flex items-start gap-2 rounded-lg border border-error/40 bg-error-container/20 p-2.5 text-xs text-on-error-container">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
            The AI service was unreachable, so this is an operational fallback plan. Review carefully before approving.
          </p>
        )}

        {isPending ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={onApprove}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Approve & dispatch
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onReject}
              className="inline-flex items-center gap-2 rounded-lg border border-error px-4 py-2 text-sm font-bold text-error transition-colors hover:bg-error-container/20 disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              Reject plan
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-outline">
            {plan.status === 'EXECUTED' ? <Truck className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4" />}
            This plan is {String(plan.status).toLowerCase()} — no further action is available.
          </p>
        )}
      </div>
    </section>
  );
}
