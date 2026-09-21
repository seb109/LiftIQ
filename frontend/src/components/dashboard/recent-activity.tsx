'use client';

import React from 'react';
import Link from 'next/link';
import { WorkoutSessionItem } from '@/lib/api';
import { formatExerciseName, formatShortDate, formatDuration } from '@/lib/use-dashboard-data';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/state-panel';
import { ScoreValue } from '@/components/ui/score';

interface RecentActivityProps {
  sessions: WorkoutSessionItem[];
}

export function RecentActivity({ sessions }: RecentActivityProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <Section title="Recent sessions">
        <EmptyState title="No sessions recorded" description="Finished workouts are listed here, newest first." />
      </Section>
    );
  }

  return (
    <Section
      title="Recent sessions"
      meta={
        <Link href="/history" className="font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline">
          View all
        </Link>
      }
    >
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rule text-ink-2">
              <th scope="col" className="pb-2 pr-4 font-normal">Exercise</th>
              <th scope="col" className="px-4 pb-2 font-normal">Date</th>
              <th scope="col" className="px-4 pb-2 text-right font-normal">Reps</th>
              <th scope="col" className="px-4 pb-2 text-right font-normal">Form score</th>
              <th scope="col" className="hidden pb-2 pl-4 text-right font-normal sm:table-cell">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {sessions.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-sunken">
                <td className="py-3 pr-4 font-medium">
                  <Link href={`/history/${s.id}`} className="underline-offset-4 hover:text-brand hover:underline">
                    {formatExerciseName(s.exercise)}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{formatShortDate(s.ended_at || s.started_at)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.total_reps}</td>
                <td className="px-4 py-3 text-right">
                  <ScoreValue score={s.average_form_score} />
                </td>
                <td className="hidden whitespace-nowrap py-3 pl-4 text-right text-ink-2 sm:table-cell">{formatDuration(s.duration_seconds || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
