'use client';

import React from 'react';
import { WorkoutStats } from '@/lib/api';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function FormScoreRing({ score }: { score: number }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#a3e635' : pct >= 60 ? '#fbbf24' : '#f87171';

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="block">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#27272a" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 36 36)"
        className="transition-all duration-300"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{pct}</text>
    </svg>
  );
}

interface StatsPanelProps {
  stats: WorkoutStats | null;
  elapsedSeconds: number;
  targetReps: number;
  targetSets: number;
}

export function StatsPanel({ stats, elapsedSeconds, targetReps, targetSets }: StatsPanelProps) {
  const reps        = stats?.counter ?? 0;
  const currentSet  = stats?.current_set ?? 1;
  const formScore   = stats?.form_score ?? null;
  const isResting   = stats?.is_resting ?? false;
  const restRemain  = stats?.rest_remaining ?? 0;

  return (
    <div id="stats-panel" className="flex flex-col gap-4">
      {/* Reps */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Reps</p>
        <p id="rep-count" className="text-5xl font-extrabold text-white tabular-nums leading-none">{reps}</p>
        <p className="text-sm text-slate-400 mt-1 tabular-nums">/ {targetReps}</p>
      </div>

      {/* Sets */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Set</p>
        <p id="set-count" className="text-3xl font-bold text-white tabular-nums leading-none">
          {currentSet} <span className="text-slate-500 text-xl">/ {targetSets}</span>
        </p>
        {isResting && (
          <p className="text-xs text-amber-400 mt-1 font-semibold animate-pulse">
            Rest — {restRemain}s
          </p>
        )}
      </div>

      {/* Form Score */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Form Score</p>
        {formScore !== null ? (
          <>
            <FormScoreRing score={formScore} />
            <p id="form-score-label" className="text-xs text-slate-400 mt-1">/ 100</p>
          </>
        ) : (
          <p id="form-score-label" className="text-sm text-slate-500 py-2">—</p>
        )}
      </div>

      {/* Timer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Duration</p>
        <p id="workout-timer" className="text-2xl font-bold text-white tabular-nums font-mono">
          {formatTime(elapsedSeconds)}
        </p>
      </div>
    </div>
  );
}
