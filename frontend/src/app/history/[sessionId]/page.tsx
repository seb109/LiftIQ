'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { sessionsApi, reportsApi } from '@/lib/api';
import { formatExerciseName, formatDate, formatDuration } from '@/lib/use-dashboard-data';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertCircle, FileQuestion, Sparkles } from 'lucide-react';

function WorkoutDetailContent() {
  const router = useRouter();
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

  // Optional: does a real AI report exist for this session? Backend resolves by session_id too.
  const { data: report } = useQuery({
    queryKey: ['report', 'by-session', sessionId],
    queryFn: () => reportsApi.getReportById(sessionId as string),
    enabled: Boolean(sessionId) && Boolean(session),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-zinc-500">Loading workout…</p>
      </div>
    );
  }

  if (isError) {
    const status = (error as AxiosError)?.response?.status;
    const notFound = status === 404;

    return (
      <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 text-center max-w-xl mx-auto my-8">
        <div className={`p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto ${notFound ? 'bg-zinc-800 text-zinc-400' : 'bg-rose-950/50 text-rose-400'}`}>
          {notFound ? <FileQuestion className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-100">
            {notFound ? 'Workout not found' : 'Failed to load workout'}
          </h3>
          <p className="text-xs text-zinc-400">
            {notFound
              ? "This workout doesn't exist, or it doesn't belong to your account."
              : (error as Error)?.message || 'An unexpected error occurred while communicating with the server.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {!notFound && (
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-lg transition-colors border border-zinc-700"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => router.push('/history')}
            className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const exName = formatExerciseName(session.exercise);
  const scoreColor =
    session.average_form_score !== null && session.average_form_score !== undefined
      ? session.average_form_score >= 85
        ? 'text-lime-400'
        : session.average_form_score >= 70
          ? 'text-amber-400'
          : 'text-rose-400'
      : 'text-zinc-400';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <button
        onClick={() => router.push('/history')}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to History
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{exName}</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {formatDate(session.started_at)}
            {session.ended_at ? ` – ${formatDate(session.ended_at)}` : ''}
          </p>
        </div>
        <Badge variant={session.status === 'completed' ? 'lime' : 'neutral'}>
          {session.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-2xl font-extrabold text-white tabular-nums">{session.total_reps}</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">Total Reps</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-2xl font-extrabold text-white tabular-nums">
            {formatDuration(session.duration_seconds || 0)}
          </p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">Duration</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className={`text-2xl font-extrabold tabular-nums ${scoreColor}`}>
            {session.average_form_score !== null && session.average_form_score !== undefined
              ? `${Math.round(session.average_form_score)}%`
              : 'N/A'}
          </p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">Form Score</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-2xl font-extrabold text-white tabular-nums">{session.metrics?.length ?? 0}</p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">Recorded Metrics</p>
        </div>
      </div>

      {report && (
        <div className="p-5 bg-gradient-to-r from-lime-950/40 to-zinc-900 border border-lime-900/50 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-lime-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">AI coaching report is ready</p>
              <p className="text-xs text-zinc-500">View strengths, mistakes, and next-session focus.</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/reports/${report.id}`)}
            className="shrink-0 px-4 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors"
          >
            View Report
          </button>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Exercise Metrics</h3>
        </div>
        {!session.metrics || session.metrics.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No per-rep metrics were recorded for this session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                  <th className="py-2.5 pl-5 pr-4">Rep</th>
                  <th className="py-2.5 px-4">Stage</th>
                  <th className="py-2.5 px-4 text-right">Form Score</th>
                  <th className="py-2.5 pr-5 pl-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {session.metrics.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pl-5 pr-4 text-zinc-200 font-mono">{m.rep_number ?? '—'}</td>
                    <td className="py-2.5 px-4 text-zinc-400">{m.stage ?? '—'}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-zinc-200">
                      {m.form_score !== null && m.form_score !== undefined ? `${m.form_score.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-5 pl-4 text-zinc-500">{m.correction_message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
