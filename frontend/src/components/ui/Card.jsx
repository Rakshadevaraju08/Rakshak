import React from 'react';

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-outline-variant/40 bg-surface-container-low p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Panel({ children, title, action, className = '' }) {
  return (
    <section className={`rounded-xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-outline-variant/30 bg-surface-container-low px-4 py-3">
          {title && <h3 className="font-bold text-lg">{title}</h3>}
          {action && <div>{action}</div>}
        </header>
      )}
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}
