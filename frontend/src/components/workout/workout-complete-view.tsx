'use client';

import React from 'react';
import { StopSessionResponse } from '@/lib/api';
import { Button, ButtonLink } from '@/components/ui/button';
import { ScoreValue } from '@/components/ui/score';
import { StatStrip } from '@/components/ui/stat-strip';

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
  /** Return to the setup screen to start another session. */
  onNewWorkout: () => void;
}

export function WorkoutCompleteView({ data, onNewWorkout }: WorkoutCompleteViewProps) {
  return (
    <div id="workout-complete-view" className="mx-auto max-w-3xl space-y-8 pb-10">
      <header>
        <p className="text-sm text-ink-2">Workout complete</p>
        <h1 className="text-3xl font-semibold tracking-tight">{formatExercise(data.exercise)}</h1>
      </header>

      <StatStrip
        items={[
          { label: 'Reps', value: <span id="completion-reps">{data.total_reps}</span> },
          { label: 'Duration', value: <span id="completion-duration">{formatDuration(data.duration_seconds)}</span> },
          {
            label: 'Form score',
            value: (
              <span id="completion-form-score">
                <ScoreValue score={data.average_form_score} figure />
              </span>
            ),
          },
        ]}
      />

      {data.report_id ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium">Your coaching report is ready.</span>{' '}
            <span className="text-ink-2">Written by AI from this session.</span>
          </p>
          <ButtonLink id="view-ai-report-btn" href={`/reports/${data.report_id}`} variant="secondary" className="shrink-0">
            Read report
          </ButtonLink>
        </div>
      ) : (
        <p className="text-ink-2">
          No coaching report could be written for this session. Your workout is saved and appears in your history.
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row">
        <Button id="new-workout-btn" onClick={onNewWorkout}>
          New workout
        </Button>
        <ButtonLink id="view-in-history-btn" href={`/history/${data.session_id}`} variant="secondary">
          View in history
        </ButtonLink>
        <ButtonLink id="back-to-dashboard-btn" href="/" variant="ghost">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
