'use client';

import React from 'react';
import { WorkoutStats } from '@/lib/api';
import { ScoreValue } from '@/components/ui/score';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface StatsPanelProps {
  stats: WorkoutStats | null;
  elapsedSeconds: number;
  targetReps: number;
  targetSets: number;
}

/** Live numbers, sized to be read from a few metres away. Ruled rows, no boxes. */
export function StatsPanel({ stats, elapsedSeconds, targetReps, targetSets }: StatsPanelProps) {
  const reps       = stats?.counter ?? 0;
  const currentSet = stats?.current_set ?? 1;
  const formScore  = stats?.form_score ?? null;
  const isResting  = stats?.is_resting ?? false;
  const restRemain = stats?.rest_remaining ?? 0;

  return (
    <div id="stats-panel" className="flex flex-col divide-y divide-rule">
      <div className="pb-5">
        <p className="text-sm text-ink-2">Reps</p>
        <p id="rep-count" className="font-display text-counter tabular-nums">{reps}</p>
        <p className="text-lg text-ink-2 tabular-nums">of {targetReps}</p>
      </div>

      <div className="py-5">
        <p className="text-sm text-ink-2">Set</p>
        <p id="set-count" className="font-display text-3xl tabular-nums">
          {currentSet} <span className="text-ink-2">of {targetSets}</span>
        </p>
        {isResting && <p className="mt-1 font-medium text-caution">Rest: {restRemain}s</p>}
      </div>

      <div className="py-5">
        <p className="text-sm text-ink-2">Form score</p>
        <div id="form-score-label" className="mt-1">
          <ScoreValue score={formScore} figure />
        </div>
      </div>

      <div className="pt-5">
        <p className="text-sm text-ink-2">Duration</p>
        <p id="workout-timer" className="font-display text-3xl tabular-nums">{formatTime(elapsedSeconds)}</p>
      </div>
    </div>
  );
}
