import React from 'react';
import { Button } from './button';
import { FailGlyph } from './icons';

interface StatePanelProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

const shell = 'rounded-surface border border-rule bg-surface p-6 sm:p-8';

/** Nothing here yet. Says what will appear and offers the one action that produces it. */
export const EmptyState: React.FC<StatePanelProps> = ({ title, description, children, className = '' }) => (
  <div className={`${shell} ${className}`}>
    <h2 className="text-lg font-semibold text-ink">{title}</h2>
    {description && <p className="mt-1 max-w-prose text-sm text-ink-2">{description}</p>}
    {children && <div className="mt-4 flex flex-wrap gap-3">{children}</div>}
  </div>
);

/** A request failed. Gives the reason when the server supplied one and always a way to retry or leave. */
export const ErrorState: React.FC<StatePanelProps & { onRetry?: () => void; retryLabel?: string }> = ({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  children,
  className = '',
}) => (
  <div role="alert" className={`${shell} ${className}`}>
    <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
      <FailGlyph className="size-5 shrink-0 text-fail" />
      {title}
    </h2>
    {description && <p className="mt-1 max-w-prose text-sm text-ink-2">{description}</p>}
    {(onRetry || children) && (
      <div className="mt-4 flex flex-wrap gap-3">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {children}
      </div>
    )}
  </div>
);

/** A form-level error shown above the fields it relates to. */
export const InlineAlert: React.FC<{ title: string; children?: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = '',
}) => (
  <div role="alert" className={`rounded-surface border border-fail bg-fail-tint p-4 ${className}`}>
    <p className="flex items-center gap-2 text-sm font-medium text-fail">
      <FailGlyph className="size-4 shrink-0" />
      {title}
    </p>
    {children && <p className="mt-1 text-sm text-ink">{children}</p>}
  </div>
);
