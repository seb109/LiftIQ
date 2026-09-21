'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthLayout, AuthFormSkeleton } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/state-panel';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export default function RegisterPage() {
  const { register, status, error: globalError, clearError } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  // What the password still needs, stated as one sentence rather than a checklist.
  const missing: string[] = [];
  if (password.length < 8) missing.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) missing.push('an uppercase letter');
  if (!/[a-z]/.test(password)) missing.push('a lowercase letter');
  if (!/[0-9]/.test(password)) missing.push('a number');
  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) missing.push('a special character');
  const isPasswordValid = missing.length === 0;

  const passwordHelp = !password
    ? 'At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character.'
    : isPasswordValid
      ? 'Meets all requirements.'
      : `Still needed: ${joinList(missing)}.`;

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!name.trim()) errors.name = 'Enter your name.';

    if (!email) {
      errors.email = 'Enter your email address.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Choose a password.';
    } else if (!isPasswordValid) {
      errors.password = `Your password still needs ${joinList(missing)}.`;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Re-enter your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'The passwords do not match.';
    }

    if (!acceptTerms) {
      errors.terms = 'Accept the Terms of Service and Privacy Policy to create an account.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      await register({ name, email, password, accept_terms: true });
      router.replace('/');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error && err.message ? err.message : 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <AuthLayout>
        <AuthFormSkeleton />
      </AuthLayout>
    );
  }

  const formError = submitError || globalError;

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>

      {formError && <InlineAlert title="Could not create your account" className="mt-6">{formError}</InlineAlert>}

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
        <Input
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          autoComplete="name"
          disabled={isLoading}
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
          disabled={isLoading}
        />

        <Input
          label="Password"
          isPassword
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          helperText={passwordHelp}
          autoComplete="new-password"
          disabled={isLoading}
        />

        <Input
          label="Confirm password"
          isPassword
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          disabled={isLoading}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3">
            <input
              id="accept-terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              disabled={isLoading}
              aria-invalid={fieldErrors.terms ? true : undefined}
              aria-describedby={fieldErrors.terms ? 'accept-terms-message' : undefined}
              className="mt-0.5 size-5 shrink-0 rounded-control border border-rule-strong accent-[var(--brand)]"
            />
            <label htmlFor="accept-terms" className="text-sm text-ink">
              I have read and agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener"
                className="font-medium text-brand underline underline-offset-4 hover:text-brand-hover"
              >
                Terms of Service
              </Link>{' '}
              and the{' '}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener"
                className="font-medium text-brand underline underline-offset-4 hover:text-brand-hover"
              >
                Privacy Policy
              </Link>
              .
            </label>
          </div>
          {fieldErrors.terms && (
            <p id="accept-terms-message" className="text-sm text-fail">
              {fieldErrors.terms}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" isLoading={isLoading} className="mt-1 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-2">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand underline underline-offset-4 hover:text-brand-hover">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
