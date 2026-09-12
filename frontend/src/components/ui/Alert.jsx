import React from 'react';

export function Alert({ title, children, variant = 'info', className = '' }) {
  const variants = {
    info: 'bg-secondary-container/10 border-secondary/30 text-secondary',
    error: 'bg-error-container/20 border-error/40 text-error',
    warning: 'bg-tertiary/10 border-tertiary/30 text-tertiary',
    success: 'bg-[var(--color-status-resolved)]/10 border-[var(--color-status-resolved)]/30 text-[var(--color-status-resolved)]',
  };

  return (
    <div className={`rounded-lg border p-4 ${variants[variant]} ${className}`}>
      {title && <h4 className="mb-1 font-bold">{title}</h4>}
      <div className="text-sm opacity-90">{children}</div>
    </div>
  );
}
