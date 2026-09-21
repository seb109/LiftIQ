'use client';

import React from 'react';
import Link from 'next/link';
import { WorkoutSessionItem } from '@/lib/api';
import { formatExerciseName, formatDate, formatDuration } from '@/lib/use-dashboard-data';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/state-panel';
import { Button } from '@/components/ui/button';
import { ScoreValue } from '@/components/ui/score';

interface RecentWorkoutProps {
  session: WorkoutSessionItem | null;
  onStartWorkout?: () => void;
}

export function RecentWorkout({ session, onStartWorkout }: RecentWorkoutProps) {
  if (!session) {
    return (
      <Section title="Most recent session">
        <EmptyState
          title="No workouts yet"
          description="Your first session will appear here once you finish a workout."
        >
          <Button onClick={onStartWorkout}>Start your first workout</Button>
        </EmptyState>
      </Section>
    );
  }

  return (
    <Section
      title="Most recent session"
      meta={
        <Link href={`/history/${session.id}`} className="font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline">
          Open session
        </Link>
      }
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-2xl font-semibold tracking-tight">{formatExerciseName(session.exercise)}</h3>
        <p className="text-sm text-ink-2">{formatDate(session.ended_at || session.started_at)}</p>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-6">
        <div>
          <dt className="text-sm text-ink-2">Reps</dt>
          <dd className="font-display text-3xl tabular-nums">{session.total_reps}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-2">Duration</dt>
          <dd className="font-display text-3xl tabular-nums">{formatDuration(session.duration_seconds || 0)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-2">Form score</dt>
          <dd className="text-2xl">
            <ScoreValue score={session.average_form_score} showLabel className="text-base" />
          </dd>
        </div>
      </dl>
    </Section>
  );
}
