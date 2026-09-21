'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { sessionsApi, reportsApi } from '@/lib/api';
import { formatExerciseName, formatDate, formatDuration } from '@/lib/use-dashboard-data';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ButtonLink } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { EmptyState, ErrorState } from '@/components/ui/state-panel';
import { ScoreValue } from '@/components/ui/score';
import { StatStrip } from '@/components/ui/stat-strip';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';

function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading workout" className="space-y-8">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="grid grid-cols-2 gap-px border-y border-rule bg-rule lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 bg-canvas py-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </LoadingRegion>
  );
}

function WorkoutDetailContent() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;

  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionsApi.getSessionDetail(sessionId as string),
    enabled: Boolean(sessionId),
    retry: false,
  });

  // Does an AI report exist for this session? The backend resolves by session id too.
  const { data: report } = useQuery({
    queryKey: ['report', 'by-session', sessionId],
    queryFn: () => reportsApi.getReportById(sessionId as string),
    enabled: Boolean(sessionId) && Boolean(session),
    retry: false,
  });

  if (isLoading) return <DetailSkeleton />;

  if (isError) {
    const notFound = (error as AxiosError)?.response?.status === 404;
    return (
      <ErrorState
        title={notFound ? 'Workout not found' : 'Could not load this workout'}
        description={
          notFound
            ? 'This workout does not exist, or it does not belong to your account.'
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

  if (!session) return null;

  const metrics = session.metrics ?? [];

  return (
    <div className="space-y-8 pb-10">
      <Breadcrumb items={[{ label: 'History', href: '/history' }, { label: formatExerciseName(session.exercise) }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{formatExerciseName(session.exercise)}</h1>
          <p className="mt-1 text-ink-2">
            {formatDate(session.started_at)}
            {session.ended_at ? ` to ${formatDate(session.ended_at)}` : ''}
          </p>
        </div>
        <Badge variant={session.status === 'completed' ? 'neutral' : 'caution'}>
          {session.status === 'completed' ? 'Completed' : 'In progress'}
        </Badge>
      </div>

      <StatStrip
        items={[
          { label: 'Reps', value: session.total_reps },
          { label: 'Duration', value: formatDuration(session.duration_seconds || 0) },
          { label: 'Form score', value: <ScoreValue score={session.average_form_score} figure /> },
          { label: 'Recorded reps', value: metrics.length },
        ]}
      />

      {report && (
        <div className="flex flex-col gap-3 border-b border-rule pb-6 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium">A coaching report is ready for this session.</span>{' '}
            <span className="text-ink-2">It covers strengths, mistakes and what to work on next.</span>
          </p>
          <ButtonLink href={`/reports/${report.id}`} variant="secondary" className="shrink-0">
            Read report
          </ButtonLink>
        </div>
      )}

      <Section title="Per-rep results">
        {metrics.length === 0 ? (
          <EmptyState title="No per-rep results" description="No individual reps were recorded for this session." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Results for each recorded rep</caption>
              <thead>
                <tr className="border-b border-rule text-ink-2">
                  <th scope="col" className="pb-2 pr-4 font-normal">Rep</th>
                  <th scope="col" className="px-4 pb-2 text-right font-normal">Score</th>
                  <th scope="col" className="pb-2 pl-4 font-normal">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {metrics.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-4 tabular-nums">{m.rep_number ?? 'n/a'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <ScoreValue score={m.form_score} />
                    </td>
                    <td className="py-2.5 pl-4 text-ink-2">{m.correction_message ?? 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

export default function WorkoutDetailPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <WorkoutDetailContent />
      </AppShell>
    </ProtectedRoute>
  );
}
