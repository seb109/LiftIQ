'use client';

import React from 'react';
import { ExerciseDistribution } from '@/lib/use-dashboard-data';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/state-panel';

interface ExerciseBreakdownProps {
  distribution: ExerciseDistribution[];
}

export function ExerciseBreakdown({ distribution }: ExerciseBreakdownProps) {
  if (!distribution || distribution.length === 0) {
    return (
      <Section title="Exercises trained">
        <EmptyState title="Nothing to show yet" description="Your sessions are grouped by exercise here." />
      </Section>
    );
  }

  return (
    <Section title="Exercises trained" meta={`${distribution.length} ${distribution.length === 1 ? 'type' : 'types'}`}>
      <ul className="space-y-4">
        {distribution.map((item) => (
          <li key={item.exercise}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium">{item.displayName}</span>
              <span className="tabular-nums text-ink-2">
                {item.count} {item.count === 1 ? 'session' : 'sessions'}, {item.percentage}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-control bg-sunken" role="presentation">
              <div className="h-full min-w-0.5 rounded-control bg-brand" style={{ width: `${item.percentage}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
