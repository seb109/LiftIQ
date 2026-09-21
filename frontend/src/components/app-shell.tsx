'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import { SiteFooter } from '@/components/site-footer';

const NAV = [
  { href: '/', label: 'Dashboard', match: (p: string) => p === '/' },
  { href: '/history', label: 'History', match: (p: string) => p.startsWith('/history') || p.startsWith('/reports') },
] as const;

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const pathname = usePathname() ?? '/';

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="border-b border-rule bg-canvas">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-8 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="LiftIQ dashboard" className="order-1 py-4">
            <Logo size="md" />
          </Link>

          <nav aria-label="Primary" className="order-3 -mb-px flex w-full gap-6 sm:order-2 sm:w-auto">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`border-b-2 py-3 text-sm font-medium transition-colors sm:py-4 ${
                    active
                      ? 'border-brand text-ink'
                      : 'border-transparent text-ink-2 hover:border-rule-strong hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="order-2 ml-auto flex items-center gap-4 sm:order-3">
            {user && <span className="hidden text-sm text-ink-2 sm:inline">{user.name || user.email}</span>}
            <Button variant="secondary" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>

      <SiteFooter />
    </div>
  );
};

/** Stands in for the shell while the session is being verified, so the page does not jump on load. */
export const AppShellSkeleton: React.FC = () => (
  <LoadingRegion label="Loading" className="flex min-h-screen flex-col bg-canvas">
    <div className="border-b border-rule">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  </LoadingRegion>
);
