'use client';

import React from 'react';
import { DashboardKPIs } from '@/lib/use-dashboard-data';

interface DashboardStatsProps {
  kpis: DashboardKPIs;
}

export function DashboardStats({ kpis }: DashboardStatsProps) {
  const statCards = [
    {
      label: 'Total Workouts',
      value: kpis.totalWorkouts.toLocaleString(),
      subtext: kpis.totalWorkouts === 1 ? '1 completed session' : `${kpis.totalWorkouts} completed sessions`,
      icon: (
        <svg className="w-5 h-5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: 'Total Reps',
      value: kpis.totalReps.toLocaleString(),
      subtext: 'Reps completed',
      icon: (
        <svg className="w-5 h-5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Average Form Score',
      value: kpis.avgFormScore !== null ? `${kpis.avgFormScore}%` : 'N/A',
      subtext: kpis.avgFormScore !== null ? (kpis.avgFormScore >= 80 ? 'Excellent technique' : 'Targeting improvement') : 'No scored sessions',
      icon: (
        <svg className="w-5 h-5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Training Time',
      value: kpis.formattedDuration,
      subtext: 'Time active in sessions',
      icon: (
        <svg className="w-5 h-5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card) => (
        <div
          key={card.label}
          className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {card.label}
            </span>
            <div className="p-1.5 bg-zinc-800/80 rounded-lg shrink-0">{card.icon}</div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-50 tracking-tight">
              {card.value}
            </div>
            <p className="text-xs text-zinc-500 font-normal truncate">{card.subtext}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
