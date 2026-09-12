'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { RecentWorkout } from '@/components/dashboard/recent-workout';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { ExerciseBreakdown } from '@/components/dashboard/exercise-breakdown';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { CoachInsight } from '@/components/dashboard/coach-insight';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

function DashboardContent() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useDashboardData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="p-6 bg-zinc-900 border border-rose-900/50 rounded-xl space-y-4 text-center max-w-xl mx-auto my-8">
        <div className="p-3 bg-rose-950/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-rose-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-100">Failed to load dashboard data</h3>
          <p className="text-xs text-zinc-400">
            {error?.message || 'An unexpected error occurred while communicating with the server.'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-lg transition-colors border border-zinc-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const handleStartWorkout = () => {
    // Workout studio flow will be integrated in Milestone 6C
    alert('Start Workout feature will launch in the upcoming Workout Studio milestone!');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header / Welcome */}
      <DashboardHeader user={user} onStartWorkout={handleStartWorkout} />

      {/* KPI Metrics Grid */}
      <DashboardStats kpis={data.kpis} />

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          <RecentWorkout session={data.recentWorkout} onStartWorkout={handleStartWorkout} />
          <PerformanceChart points={data.trendPoints} />
          <RecentActivity sessions={data.recentActivity} />
        </div>

        {/* Right 1 Column */}
        <div className="space-y-6">
          <CoachInsight report={data.latestReport} />
          <ExerciseBreakdown distribution={data.exerciseDistribution} />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}
