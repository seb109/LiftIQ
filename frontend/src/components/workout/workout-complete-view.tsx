'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { StopSessionResponse } from '@/lib/api';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatExercise(ex: string): string {
  return ex.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface WorkoutCompleteViewProps {
  data: StopSessionResponse;
}

export function WorkoutCompleteView({ data }: WorkoutCompleteViewProps) {
  const router = useRouter();
  const formScore = data.average_form_score;

  return (
    <div
      id="workout-complete-view"
      className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-6 text-center space-y-8"
    >
      {/* Trophy icon */}
      <div className="w-20 h-20 rounded-full bg-lime-950/60 border border-lime-800/60 flex items-center justify-center text-4xl">
        🏆
      </div>

      {/* Title */}
      <div className="space-y-2">
        <p className="text-lime-400 text-sm font-semibold tracking-widest uppercase">Workout Complete</p>
        <h1 className="text-3xl font-extrabold text-white">{formatExercise(data.exercise)}</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p id="completion-reps" className="text-4xl font-extrabold text-white tabular-nums">{data.total_reps}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Total Reps</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p id="completion-duration" className="text-4xl font-extrabold text-white tabular-nums">
            {formatDuration(data.duration_seconds)}
          </p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Duration</p>
        </div>

        {formScore !== null ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 col-span-2 sm:col-span-1">
            <p id="completion-form-score" className={`text-4xl font-extrabold tabular-nums ${
              formScore >= 80 ? 'text-lime-400' : formScore >= 60 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {Math.round(formScore)}
            </p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Form Score</p>
          </div>
        ) : null}
      </div>

      {/* Report notice */}
      {data.report_id ? (
        <p className="text-sm text-slate-400">
          ✦ AI coaching report generated
        </p>
      ) : (
        <p className="text-xs text-slate-600">AI report generation is in progress</p>
      )}

      {/* View links */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          id="view-in-history-btn"
          onClick={() => router.push(`/history/${data.session_id}`)}
          className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-slate-300 hover:bg-zinc-800 font-semibold text-xs transition-colors"
        >
          View in History
        </button>
        {data.report_id && (
          <button
            id="view-ai-report-btn"
            onClick={() => router.push(`/reports/${data.report_id}`)}
            className="flex-1 py-2.5 rounded-xl border border-lime-800/60 text-lime-400 hover:bg-lime-950/40 font-semibold text-xs transition-colors"
          >
            View AI Report
          </button>
        )}
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          id="back-to-dashboard-btn"
          onClick={() => router.push('/')}
          className="flex-1 py-3 rounded-xl bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold text-sm transition-colors"
        >
          Back to Dashboard
        </button>
        <button
          id="new-workout-btn"
          onClick={() => router.refresh()}
          className="flex-1 py-3 rounded-xl border border-zinc-700 text-slate-300 hover:bg-zinc-800 font-semibold text-sm transition-colors"
        >
          New Workout
        </button>
      </div>
    </div>
  );
}
