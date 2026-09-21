'use client';

import React from 'react';
import { DashboardKPIs } from '@/lib/use-dashboard-data';
import { ScoreValue, scoreBand } from '@/components/ui/score';
import { StatStrip } from '@/components/ui/stat-strip';

interface DashboardStatsProps {
  kpis: DashboardKPIs;
}

export function DashboardStats({ kpis }: DashboardStatsProps) {
  return (
    <StatStrip
      items={[
        {
          label: 'Workouts',
          value: kpis.totalWorkouts.toLocaleString(),
          note: kpis.totalWorkouts === 1 ? '1 completed session' : `${kpis.totalWorkouts} completed sessions`,
        },
        { label: 'Reps', value: kpis.totalReps.toLocaleString(), note: 'Across all sessions' },
        {
          label: 'Average form score',
          value: <ScoreValue score={kpis.avgFormScore} figure />,
          note: kpis.avgFormScore !== null ? scoreBand(kpis.avgFormScore).label : 'No scored sessions yet',
        },
        { label: 'Training time', value: kpis.formattedDuration, note: 'In completed sessions' },
      ]}
    />
  );
}
