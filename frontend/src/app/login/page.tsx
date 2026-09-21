'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthLayout, AuthFormSkeleton } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/state-panel';

export default function LoginPage() {
  const { login, status, error: globalError, clearError } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email) {
      errors.email = 'Enter your email address.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Enter your password.';
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
      await login({ email, password });
      router.replace('/');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error && err.message ? err.message : 'Check your email and password and try again.');
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
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

      {formError && <InlineAlert title="Could not sign in" className="mt-6">{formError}</InlineAlert>}

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
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
          autoComplete="current-password"
          disabled={isLoading}
        />

        <Button type="submit" size="lg" isLoading={isLoading} className="mt-1 w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-2">
        New to LiftIQ?{' '}
        <Link href="/register" className="font-medium text-brand underline underline-offset-4 hover:text-brand-hover">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
