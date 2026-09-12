import React from 'react';

export function Table({ children, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto rounded-lg border border-outline-variant/30 ${className}`}>
      <table className="w-full text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }) {
  return (
    <thead className="bg-surface-container border-b border-outline-variant/30 font-bold text-on-surface">
      {children}
    </thead>
  );
}

export function TableBody({ children }) {
  return <tbody className="divide-y divide-outline-variant/20">{children}</tbody>;
}

export function TableRow({ children, className = '', hover = true }) {
  const hoverStyles = hover ? 'hover:bg-surface-container-high/50 transition-colors' : '';
  return <tr className={`${hoverStyles} ${className}`}>{children}</tr>;
}

export function TableCell({ children, className = '', isHeader = false }) {
  const Tag = isHeader ? 'th' : 'td';
  const baseStyles = 'px-4 py-3 align-middle';
  const headerStyles = isHeader ? 'font-mono text-xs tracking-wider text-secondary uppercase' : 'text-on-surface';
  
  return <Tag className={`${baseStyles} ${headerStyles} ${className}`}>{children}</Tag>;
}
