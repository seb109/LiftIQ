'use client'; // Error boundaries must be Client Components

import './globals.css';
import { buttonStyles } from '@/components/ui/button';

/**
 * Last-resort fallback when the root layout itself fails. It replaces the layout, so it
 * defines its own <html> and <body>, and uses plain elements: no providers, no router.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas font-sans text-ink antialiased">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
          <p className="text-sm text-ink-2">Something went wrong</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">LiftIQ could not be loaded</h1>
          <p className="mt-3 text-lg text-ink-2">
            An unexpected error stopped the app from starting. Try again in a moment.
            {error.digest ? ` Reference for support: ${error.digest}.` : ''}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => retry()} className={buttonStyles({})}>
              Try again
            </button>
            {/* A full page load is the point here: the router may be what failed, so next/link is unavailable. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className={buttonStyles({ variant: 'secondary' })}>
              Reload LiftIQ
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
