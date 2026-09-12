import React from 'react';

export function Button({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary text-on-surface hover:bg-primary/90',
    secondary: 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
    ghost: 'hover:bg-surface-container-high text-secondary',
    danger: 'bg-error text-error-container hover:bg-error/90',
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
