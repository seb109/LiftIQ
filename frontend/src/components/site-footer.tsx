import React from 'react';
import Link from 'next/link';

/** Shown on every page, signed in or not, so the legal documents are always one click away. */
export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} LiftIQ</p>
        <nav aria-label="Legal">
          <ul className="flex gap-6">
            <li>
              <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
