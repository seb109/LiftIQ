import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'pass' | 'caution' | 'fail';
  size?: 'sm' | 'md';
}

const variants = {
  neutral: 'border-rule-strong bg-transparent text-ink-2',
  pass: 'border-transparent bg-brand-tint text-pass',
  caution: 'border-transparent bg-caution-tint text-caution',
  fail: 'border-transparent bg-fail-tint text-fail',
};

const sizes = {
  sm: 'px-1.5 py-px text-xs',
  md: 'px-2 py-0.5 text-sm',
};

/** A status tag. Always carries a word; colour only reinforces it. */
export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'md', className, ...props }) => (
  <span
    className={twMerge(
      clsx('inline-flex items-center rounded-control border font-medium', variants[variant], sizes[size], className),
    )}
    {...props}
  >
    {children}
  </span>
);
