'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { sessionsApi } from '@/lib/api';
import { formatExerciseName, formatDate, formatDuration } from '@/lib/use-dashboard-data';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, History as HistoryIcon, ChevronRight } from 'lucide-react';

function HistoryContent() {
  const router = useRouter();

  const { data: sessions, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sessions', 'history'],
    queryFn: () => sessionsApi.getSessions(100),
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-zinc-500">Loading workout history…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-zinc-900 border border-rose-900/50 rounded-xl space-y-4 text-center max-w-xl mx-auto my-8">
        <div className="p-3 bg-rose-950/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-100">Failed to load workout history</h3>
          <p className="text-xs text-zinc-400">
            {(error as Error)?.message || 'An unexpected error occurred while communicating with the server.'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-lg transition-colors border border-zinc-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const items = sessions || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lime-400">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Workout History</h1>
            <p className="text-xs text-zinc-500">{items.length} recorded session{items.length === 1 ? '' : 's'}</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-10 bg-zinc-900 border border-zinc-800 rounded-xl text-center space-y-3">
          <p className="text-sm text-zinc-300 font-semibold">No workouts recorded yet</p>
          <p className="text-xs text-zinc-500">Complete a workout to see it appear here.</p>
          <button
            onClick={() => router.push('/workout')}
            className="mt-2 px-4 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors"
          >
            Start a Workout
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-medium uppercase tracking-wider">
                  <th className="py-3 pl-5 pr-4">Exercise</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4 text-right">Reps</th>
                  <th className="py-3 px-4 text-right">Form Score</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 pr-5 pl-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {items.map((s) => {
                  const exName = formatExerciseName(s.exercise);
                  const dateStr = formatDate(s.ended_at || s.started_at);
                  const durStr = formatDuration(s.duration_seconds || 0);

                  let scoreColor = 'text-zinc-400';
                  if (s.average_form_score !== null && s.average_form_score !== undefined) {
                    if (s.average_form_score >= 85) scoreColor = 'text-lime-400 font-semibold';
                    else if (s.average_form_score >= 70) scoreColor = 'text-amber-400 font-semibold';
                    else scoreColor = 'text-rose-400 font-semibold';
                  }

                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/history/${s.id}`)}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 pl-5 pr-4 font-semibold text-zinc-100">{exName}</td>
                      <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap">{dateStr}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-200">{s.total_reps}</td>
                      <td className={`py-3.5 px-4 text-right font-mono ${scoreColor}`}>
                        {s.average_form_score !== null && s.average_form_score !== undefined
                          ? `${s.average_form_score}%`
                          : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-400 whitespace-nowrap">{durStr}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={s.status === 'completed' ? 'lime' : 'neutral'} size="sm">
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 pr-5 pl-4 text-right">
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-lime-400 transition-colors inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
