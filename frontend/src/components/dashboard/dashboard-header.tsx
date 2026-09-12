'use client';

import React from 'react';
import { UserProfile } from '@/lib/api';

interface DashboardHeaderProps {
  user: UserProfile | null;
  onStartWorkout?: () => void;
}

export function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader({ user, onStartWorkout }: DashboardHeaderProps) {
  const greeting = getGreetingTime();
  const userName = user?.name ? user.name.split(' ')[0] : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl backdrop-blur-sm">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50" suppressHydrationWarning>
          {userName ? `${greeting}, ${userName}` : `${greeting}`}
        </h1>
        <p className="text-sm text-zinc-400">
          Ready to train? Pick an exercise and track your performance with AI precision.
        </p>
      </div>

      <div className="shrink-0">
        <button
          onClick={onStartWorkout}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-semibold text-sm rounded-lg shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400"
          aria-label="Start Workout"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start Workout
        </button>
      </div>
    </div>
  );
}
