'use client';

import React from 'react';
import { WorkoutSessionItem } from '@/lib/api';
import { formatExerciseName, formatDate, formatDuration } from '@/lib/use-dashboard-data';

interface RecentWorkoutProps {
  session: WorkoutSessionItem | null;
  onStartWorkout?: () => void;
}

export function RecentWorkout({ session, onStartWorkout }: RecentWorkoutProps) {
  if (!session) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center min-h-[220px]">
        <div className="p-3 bg-zinc-800/80 rounded-full mb-3 text-zinc-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-zinc-100 mb-1">No workouts yet</h3>
        <p className="text-sm text-zinc-400 max-w-sm mb-4">
          Your first session will appear here once you complete a workout.
        </p>
        <button
          onClick={onStartWorkout}
          className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-semibold text-xs rounded-lg transition-colors"
          aria-label="Start your first workout"
        >
          Start your first workout
        </button>
      </div>
    );
  }

  const exerciseName = formatExerciseName(session.exercise);
  const formattedTime = formatDate(session.ended_at || session.started_at);
  const formattedDur = formatDuration(session.duration_seconds || 0);

  const formScore = session.average_form_score;
  let scoreBadgeBg = 'bg-zinc-800 text-zinc-300 border-zinc-700';
  if (typeof formScore === 'number') {
    if (formScore >= 85) {
      scoreBadgeBg = 'bg-lime-400/10 text-lime-400 border-lime-400/30';
    } else if (formScore >= 70) {
      scoreBadgeBg = 'bg-amber-400/10 text-amber-400 border-amber-400/30';
    } else {
      scoreBadgeBg = 'bg-rose-400/10 text-rose-400 border-rose-400/30';
    }
  }

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" />
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Most Recent Session
          </h2>
        </div>
        <span className="text-xs font-medium text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-700/50">
          Completed
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-1 border-t border-zinc-800/80">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-50">{exerciseName}</h3>
          <p className="text-xs text-zinc-400">{formattedTime}</p>
        </div>

        {formScore !== null && formScore !== undefined && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold ${scoreBadgeBg}`}>
            <span>Form Score:</span>
            <span>{formScore}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/60">
          <div className="text-xs text-zinc-500 font-medium">Total Reps</div>
          <div className="text-lg font-bold text-zinc-100 mt-0.5">{session.total_reps}</div>
        </div>

        <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/60">
          <div className="text-xs text-zinc-500 font-medium">Duration</div>
          <div className="text-lg font-bold text-zinc-100 mt-0.5">{formattedDur}</div>
        </div>

        <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/60">
          <div className="text-xs text-zinc-500 font-medium">Form Score</div>
          <div className="text-lg font-bold text-zinc-100 mt-0.5">
            {formScore !== null ? `${formScore}%` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
