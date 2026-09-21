import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** A flat placeholder block. Size it with className to match the content it stands in for. */
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div aria-hidden="true" className={twMerge(clsx('skeleton h-4 w-full', className))} {...props} />
);

/** Announces the loading state once to assistive tech; wrap a screen's skeleton layout in it. */
export const LoadingRegion: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({
  label,
  className,
  children,
}) => (
  <div role="status" aria-live="polite" aria-busy="true" className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);
