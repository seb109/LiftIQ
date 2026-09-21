'use client';

import React from 'react';
import { UserProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  user: UserProfile | null;
  /** One factual line under the greeting, for example the last session. */
  summary?: string;
  onStartWorkout?: () => void;
}

export function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader({ user, summary, onStartWorkout }: DashboardHeaderProps) {
  const greeting = getGreetingTime();
  const firstName = user?.name ? user.name.split(' ')[0] : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" suppressHydrationWarning>
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
        {summary && <p className="mt-1 text-ink-2">{summary}</p>}
      </div>
      <Button size="lg" onClick={onStartWorkout} className="w-full sm:w-auto">
        Start workout
      </Button>
    </div>
  );
}
