import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { SiteFooter } from '@/components/site-footer';

/** Full-page message for 404 and unexpected errors. Works signed in or out. */
export function StatusPage({
  label,
  title,
  description,
  children,
}: {
  label?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/" aria-label="LiftIQ home">
          <Logo size="md" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-xl">
          {label && <p className="text-sm text-ink-2">{label}</p>}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-lg text-ink-2">{description}</p>
          {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
