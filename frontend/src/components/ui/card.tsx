import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `overlay` is the only variant that casts a shadow: use it for things that sit above the page. */
  variant?: 'default' | 'overlay';
}

/** A ruled surface. Structure comes from the 1px border, not from elevation. */
export const Card: React.FC<CardProps> = ({ children, variant = 'default', className, ...props }) => (
  <div
    className={twMerge(
      clsx(
        'rounded-surface border border-rule bg-surface',
        variant === 'overlay' && 'shadow-overlay',
        className,
      ),
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx('flex flex-col gap-1 p-6 pb-4', className))} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className, ...props }) => (
  <h2 className={twMerge(clsx('text-xl font-semibold tracking-tight text-ink', className))} {...props}>
    {children}
  </h2>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className, ...props }) => (
  <p className={twMerge(clsx('text-sm text-ink-2', className))} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx('p-6 pt-0', className))} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx('flex items-center p-6 pt-0', className))} {...props}>
    {children}
  </div>
);
