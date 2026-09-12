'use client';

import React from 'react';
import { WorkoutSessionItem } from '@/lib/api';
import { formatExerciseName, formatDate, formatDuration } from '@/lib/use-dashboard-data';

interface RecentActivityProps {
  sessions: WorkoutSessionItem[];
}

export function RecentActivity({ sessions }: RecentActivityProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Recent Activity
        </h3>
        <div className="flex items-center justify-center min-h-[100px] text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
          No workout history yet.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Recent Activity
        </h3>
        <span className="text-xs text-zinc-500 font-mono">
          Showing last {sessions.length} sessions
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
              <th className="pb-3 pr-4">Exercise</th>
              <th className="pb-3 px-4">Date & Time</th>
              <th className="pb-3 px-4 text-right">Reps</th>
              <th className="pb-3 px-4 text-right">Form Score</th>
              <th className="pb-3 pl-4 text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {sessions.map((s) => {
              const exName = formatExerciseName(s.exercise);
              const dateStr = formatDate(s.ended_at || s.started_at);
              const durStr = formatDuration(s.duration_seconds || 0);

              let scoreColor = 'text-zinc-400';
              if (s.average_form_score !== null && s.average_form_score !== undefined) {
                if (s.average_form_score >= 85) scoreColor = 'text-lime-400 font-medium';
                else if (s.average_form_score >= 70) scoreColor = 'text-amber-400 font-medium';
                else scoreColor = 'text-rose-400 font-medium';
              }

              return (
                <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 pr-4 font-semibold text-zinc-100">{exName}</td>
                  <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">{dateStr}</td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-200">{s.total_reps}</td>
                  <td className={`py-3 px-4 text-right font-mono ${scoreColor}`}>
                    {s.average_form_score !== null && s.average_form_score !== undefined
                      ? `${s.average_form_score}%`
                      : 'N/A'}
                  </td>
                  <td className="py-3 pl-4 text-right text-zinc-400 whitespace-nowrap">{durStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
