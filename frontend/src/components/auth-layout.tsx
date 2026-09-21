import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import { SiteFooter } from '@/components/site-footer';

const STEPS = [
  'Choose an exercise, and how many reps and sets you want.',
  'Set your camera side-on, about two metres away, with your whole body in frame.',
  'Lift. Rep counts and form cues update on screen as you go.',
  'End the session to save it and get a written coaching report.',
];

/**
 * Signed-out pages: the form comes first, with a short factual description of the
 * product beside it (below it on narrow screens).
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Logo size="md" />
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-24 lg:px-8 lg:py-16">
        <div className="order-1 lg:order-2">{children}</div>

        <section aria-labelledby="about-heading" className="order-2 max-w-xl lg:order-1">
          <h2 id="about-heading" className="text-3xl font-semibold tracking-tight">
            Get form feedback while you lift
          </h2>
          <p className="mt-4 text-lg text-ink-2">
            LiftIQ uses your device&apos;s camera to track your joints, count your reps and flag form
            problems as they happen. After each session it saves your results and writes a coaching
            report using AI.
          </p>

          <h3 className="mt-10 text-sm font-medium text-ink-2">How a session works</h3>
          <ol className="mt-3 divide-y divide-rule border-y border-rule">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-4 py-3">
                <span className="w-5 shrink-0 font-display text-lg leading-6 text-brand tabular-nums">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {/* TODO(product-demo): show a real annotated session capture here once footage with clear
              rights and participant consent exists. Deliberately omitted until then. */}

          <p className="mt-8 text-sm text-ink-2">
            Supported exercises: squat, push-up, bicep curl, shoulder press, lunge and deadlift. Your
            video is analysed on our server to find your pose and is not recorded or stored. See the{' '}
            <Link href="/privacy" className="text-brand underline underline-offset-4 hover:text-brand-hover">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Placeholder for the form column while the session state is being checked. */
export function AuthFormSkeleton() {
  return (
    <LoadingRegion label="Loading" className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-12 w-full" />
    </LoadingRegion>
  );
}
