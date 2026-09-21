import React from 'react';

/** For short in-place waits with no known layout (for example, a closing workout). Data views use Skeleton instead. */
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string; label?: string }> = ({
  size = 'md',
  className = '',
  label = 'Loading',
}) => {
  const sizeClasses = { sm: 'size-4', md: 'size-6', lg: 'size-8' };

  return (
    <span role="status" className={`inline-flex items-center justify-center ${className}`}>
      <svg className={`animate-spin text-brand ${sizeClasses[size]}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
};
