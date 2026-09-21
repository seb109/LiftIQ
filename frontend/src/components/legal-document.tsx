import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { SiteFooter } from '@/components/site-footer';
import { LEGAL } from '@/lib/legal';

export interface LegalSection {
  id: string;
  heading: string;
  body: React.ReactNode;
}

/** Shared page for the Terms and the Privacy Policy. Public: no sign-in needed. */
export function LegalDocument({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/" aria-label="LiftIQ home">
          <Logo size="md" />
        </Link>
        <Link href="/login" className="text-sm font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline">
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <article className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-ink-2">Effective {LEGAL.effectiveDate}</p>

          {!LEGAL.reviewedByCounsel && (
            <p role="note" className="mt-6 rounded-surface border border-rule-strong bg-surface p-4 text-sm">
              This document has not yet been reviewed by legal counsel.
            </p>
          )}

          <div className="mt-8 space-y-3 leading-7">{intro}</div>

          <nav aria-label="Contents" className="mt-8 border-y border-rule py-4">
            <h2 className="text-sm font-medium text-ink-2">Contents</h2>
            <ol className="mt-2 columns-1 gap-8 text-sm sm:columns-2">
              {sections.map((s, i) => (
                <li key={s.id} className="py-0.5">
                  <a href={`#${s.id}`} className="underline-offset-4 hover:text-brand hover:underline">
                    {i + 1}. {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="scroll-mt-6">
                <h2 id={`${s.id}-heading`} className="text-xl font-semibold tracking-tight">
                  {i + 1}. {s.heading}
                </h2>
                <div className="mt-3 space-y-3 leading-7 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
