import React from 'react';

export function Label({ children, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-sm font-bold text-on-surface ${className}`}>
      {children}
    </label>
  );
}

export function Input({ className = '', error, ...props }) {
  const baseStyles = "w-full rounded-lg border bg-surface px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-shadow";
  const borderStyles = error ? "border-error focus:border-error" : "border-outline-variant focus:border-secondary";
  
  return (
    <div className="relative">
      <input className={`${baseStyles} ${borderStyles} ${className}`} {...props} />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select 
      className={`w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-shadow ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
