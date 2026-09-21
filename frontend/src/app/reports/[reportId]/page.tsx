'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { reportsApi } from '@/lib/api';
import { formatDate } from '@/lib/use-dashboard-data';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ButtonLink } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { ErrorState } from '@/components/ui/state-panel';
import { ScoreValue } from '@/components/ui/score';
import { StatStrip } from '@/components/ui/stat-strip';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';

/** One finding per row, separated by rules. No icons: the heading says what the list is. */
function ReportList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <Section title={title} flush>
      <ul className="divide-y divide-rule border-b border-rule">
        {items.map((item, i) => (
          <li key={i} className="py-3">
            {item}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ReportSkeleton() {
  return (
    <LoadingRegion label="Loading coaching report" className="mx-auto max-w-3xl space-y-8">
      <Skeleton className="h-5 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-56" />
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </LoadingRegion>
  );
}

function ReportContent() {
  const params = useParams<{ reportId: string }>();
  const reportId = params?.reportId;

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => reportsApi.getReportById(reportId as string),
    enabled: Boolean(reportId),
    retry: false,
  });

  if (isLoading) return <ReportSkeleton />;

  if (isError) {
    const notFound = (error as AxiosError)?.response?.status === 404;
    return (
      <ErrorState
        title={notFound ? 'Report not available' : 'Could not load this report'}
        description={
          notFound
            ? 'This report does not exist, has not been generated yet, or does not belong to your account.'
            : (error as Error)?.message || 'The server did not respond as expected. Check your connection and try again.'
        }
        onRetry={notFound ? undefined : () => refetch()}
        className="mx-auto max-w-xl"
      >
        <ButtonLink href="/history" variant={notFound ? 'primary' : 'secondary'}>
          Back to history
        </ButtonLink>
      </ErrorState>
    );
  }

  if (!report) return null;

  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-10">
      <Breadcrumb
        items={[
          { label: 'History', href: '/history' },
          ...(report.session_id ? [{ label: 'Session', href: `/history/${report.session_id}` }] : []),
          { label: 'Coaching report' },
        ]}
      />

      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Coaching report</h1>
        <p className="mt-1 text-ink-2">
          {report.created_at ? formatDate(report.created_at) : 'Recent'}. Written by AI from your session data
          {report.model_name ? ` (${report.model_name})` : ''}.
        </p>
      </header>

      <StatStrip
        items={[
          { label: 'Overall score', value: <ScoreValue score={report.overall_score} figure />, note: undefined },
          { label: 'Form score', value: <ScoreValue score={report.form_score} figure />, note: undefined },
        ]}
      />

      <Section title="Summary">
        <p className="font-serif text-xl leading-8">{report.coach_summary || 'No summary was written for this session.'}</p>
      </Section>

      <ReportList title="Strengths" items={report.strengths || []} />
      <ReportList title="Mistakes" items={report.mistakes || []} />
      <ReportList title="Improvements" items={report.improvements || []} />

      <Section title="Next session focus">
        <p>{report.next_session_focus || 'Keep building on your current technique.'}</p>
      </Section>

      {report.motivation && (
        <Section title="Note from your coach">
          <p className="font-serif text-lg leading-7">{report.motivation}</p>
        </Section>
      )}
    </article>
  );
}

export default function ReportDetailPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <ReportContent />
      </AppShell>
    </ProtectedRoute>
  );
}
