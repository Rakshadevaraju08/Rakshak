import React from 'react';

export function PriorityBadge({ level }) {
  const normalizedLevel = level?.toUpperCase();
  
  const styles = {
    P5: 'bg-[var(--color-priority-p5-container)] text-[var(--color-priority-p5)] border-[var(--color-priority-p5)]',
    P4: 'bg-[var(--color-priority-p4-container)] text-[var(--color-priority-p4)] border-[var(--color-priority-p4)]',
    P3: 'bg-[var(--color-priority-p3-container)] text-[var(--color-priority-p3)] border-[var(--color-priority-p3)]',
    P2: 'bg-[var(--color-priority-p2-container)] text-[var(--color-priority-p2)] border-[var(--color-priority-p2)]',
    P1: 'bg-[var(--color-priority-p1-container)] text-[var(--color-priority-p1)] border-[var(--color-priority-p1)]',
  };

  const currentStyle = styles[normalizedLevel] || styles['P1'];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold font-mono ${currentStyle}`}>
      {normalizedLevel || 'P1'}
    </span>
  );
}

export function StatusBadge({ status }) {
  const normalizedStatus = status?.toUpperCase().replace(' ', '_');
  
  const styles = {
    NEW: 'bg-[var(--color-status-new-container)] text-[var(--color-status-new)]',
    ANALYZING: 'bg-[var(--color-status-analyzing-container)] text-[var(--color-status-analyzing)]',
    ASSIGNED: 'bg-[var(--color-status-assigned-container)] text-[var(--color-status-assigned)]',
    APPROVED: 'bg-[var(--color-status-approved-container)] text-[var(--color-status-approved)]',
    DISPATCHED: 'bg-[var(--color-status-dispatched-container)] text-[var(--color-status-dispatched)]',
    EN_ROUTE: 'bg-[var(--color-status-en-route-container)] text-[var(--color-status-en-route)]',
    RESOLVED: 'bg-[var(--color-status-resolved-container)] text-[var(--color-status-resolved)]',
    REJECTED: 'bg-[var(--color-status-rejected-container)] text-[var(--color-status-rejected)]',
  };

  const currentStyle = styles[normalizedStatus] || 'bg-surface-container-high text-on-surface-variant';
  const displayLabel = status?.replace('_', ' ') || 'UNKNOWN';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider font-mono ${currentStyle}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {displayLabel}
    </span>
  );
}
