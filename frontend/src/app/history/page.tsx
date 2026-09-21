'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { sessionsApi } from '@/lib/api';
import { formatExerciseName, formatDate, formatDuration } from '@/lib/use-dashboard-data';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/state-panel';
import { ScoreValue } from '@/components/ui/score';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';

function HistorySkeleton() {
  return (
    <LoadingRegion label="Loading workout history" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="border-t border-rule">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-6 border-b border-rule py-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="ml-auto h-5 w-16" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

function HistoryContent() {
  const { data: sessions, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sessions', 'history'],
    queryFn: () => sessionsApi.getSessions(100),
    staleTime: 30000,
  });

  if (isLoading) return <HistorySkeleton />;

  if (isError) {
    return (
      <ErrorState
        title="Could not load your workout history"
        description={(error as Error)?.message || 'The server did not respond as expected. Check your connection and try again.'}
        onRetry={() => refetch()}
        className="mx-auto max-w-xl"
      />
    );
  }

  const items = sessions || [];

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Workout history</h1>
        <p className="mt-1 text-ink-2">
          {items.length} recorded session{items.length === 1 ? '' : 's'}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No workouts recorded yet" description="Finished workouts are listed here, newest first.">
          <ButtonLink href="/workout">Start a workout</ButtonLink>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recorded workout sessions</caption>
            <thead>
              <tr className="border-b border-rule text-ink-2">
                <th scope="col" className="pb-2 pr-4 font-normal">Exercise</th>
                <th scope="col" className="px-4 pb-2 font-normal">Date</th>
                <th scope="col" className="px-4 pb-2 text-right font-normal">Reps</th>
                <th scope="col" className="px-4 pb-2 text-right font-normal">Form score</th>
                <th scope="col" className="hidden px-4 pb-2 text-right font-normal sm:table-cell">Duration</th>
                <th scope="col" className="hidden pb-2 pl-4 font-normal sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {items.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-sunken">
                  <td className="py-3.5 pr-4 font-medium">
                    <Link href={`/history/${s.id}`} className="underline-offset-4 hover:text-brand hover:underline">
                      {formatExerciseName(s.exercise)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-ink-2">{formatDate(s.ended_at || s.started_at)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{s.total_reps}</td>
                  <td className="px-4 py-3.5 text-right">
                    <ScoreValue score={s.average_form_score} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3.5 text-right text-ink-2 sm:table-cell">
                    {formatDuration(s.duration_seconds || 0)}
                  </td>
                  <td className="hidden py-3.5 pl-4 sm:table-cell">
                    <Badge variant={s.status === 'completed' ? 'neutral' : 'caution'} size="sm">
                      {s.status === 'completed' ? 'Completed' : 'In progress'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <HistoryContent />
      </AppShell>
    </ProtectedRoute>
  );
}
