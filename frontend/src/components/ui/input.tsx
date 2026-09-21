import React, { useId, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Renders a Show/Hide control and switches between password and text. */
  isPassword?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, isPassword = false, type = 'text', className, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const autoId = useId();
    const inputId = id ?? autoId;
    const messageId = `${inputId}-message`;
    const hasMessage = Boolean(error || helperText);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div className="relative flex w-full items-center">
          <input
            id={inputId}
            ref={ref}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={hasMessage ? messageId : undefined}
            className={twMerge(
              clsx(
                'h-11 w-full rounded-control border bg-surface px-3 text-base text-ink transition-colors',
                'placeholder:text-ink-2 hover:border-ink-2 focus-visible:border-brand',
                'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-2',
                error ? 'border-fail hover:border-fail focus-visible:border-fail' : 'border-rule-strong',
                isPassword && 'pr-16',
                className,
              ),
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="absolute right-1 h-9 rounded-control px-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        {hasMessage && (
          <p id={messageId} className={clsx('text-sm', error ? 'text-fail' : 'text-ink-2')}>
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
