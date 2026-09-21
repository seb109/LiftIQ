import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  /** React 19 passes ref as an ordinary prop to function components. */
  ref?: React.Ref<HTMLButtonElement>;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium select-none whitespace-nowrap ' +
  'transition-colors disabled:cursor-not-allowed';

// Every state changes colour, so the state is readable without any motion.
const variants = {
  primary:
    'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-press ' +
    'disabled:bg-sunken disabled:text-ink-2',
  secondary:
    'border border-rule-strong bg-surface text-ink hover:bg-sunken active:bg-rule ' +
    'disabled:border-rule disabled:text-ink-2 disabled:hover:bg-surface',
  ghost:
    'text-ink-2 hover:bg-sunken hover:text-ink active:bg-rule disabled:text-ink-2/60 disabled:hover:bg-transparent',
  danger:
    'bg-fail text-on-fail hover:bg-fail-hover active:bg-fail disabled:bg-sunken disabled:text-ink-2',
};

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={twMerge(clsx(base, variants[variant], sizes[size], className))}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    {...props}
  >
    {isLoading && (
      <svg className="size-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )}
    {children}
  </button>
);

type ButtonStyleOptions = { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string };

/** Button styling for elements that are not <button>, such as links that navigate. */
export function buttonStyles({ variant = 'primary', size = 'md', className }: ButtonStyleOptions = {}) {
  return twMerge(clsx(base, variants[variant], sizes[size], className));
}

/** A link that looks like a button. Use it for navigation; use Button for actions. */
export const ButtonLink: React.FC<React.ComponentProps<typeof Link> & ButtonStyleOptions> = ({
  variant,
  size,
  className,
  ...props
}) => <Link className={buttonStyles({ variant, size, className })} {...props} />;
