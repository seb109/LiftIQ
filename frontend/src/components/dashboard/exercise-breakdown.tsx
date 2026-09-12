'use client';

import React from 'react';
import { ExerciseDistribution } from '@/lib/use-dashboard-data';

interface ExerciseBreakdownProps {
  distribution: ExerciseDistribution[];
}

export function ExerciseBreakdown({ distribution }: ExerciseBreakdownProps) {
  if (!distribution || distribution.length === 0) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Exercise Breakdown
        </h3>
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 border border-dashed border-zinc-800 rounded-lg">
          <p className="text-xs text-zinc-500">No exercise data available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Exercise Breakdown
        </h3>
        <span className="text-xs text-zinc-500 font-mono">
          {distribution.length} {distribution.length === 1 ? 'type' : 'types'} trained
        </span>
      </div>

      <div className="space-y-3">
        {distribution.map((item) => (
          <div key={item.exercise} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-200">{item.displayName}</span>
              <span className="text-zinc-400 font-mono">
                {item.count} {item.count === 1 ? 'session' : 'sessions'} ({item.percentage}%)
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
              <div
                className="h-full bg-lime-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(4, item.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
