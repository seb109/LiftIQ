'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { useDashboardData, formatExerciseName, formatDate } from '@/lib/use-dashboard-data';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { RecentWorkout } from '@/components/dashboard/recent-workout';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { ExerciseBreakdown } from '@/components/dashboard/exercise-breakdown';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { CoachInsight } from '@/components/dashboard/coach-insight';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ErrorState } from '@/components/ui/state-panel';

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useDashboardData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load your dashboard"
        description={error?.message || 'The server did not respond as expected. Check your connection and try again.'}
        onRetry={() => refetch()}
        className="mx-auto max-w-xl"
      />
    );
  }

  const handleStartWorkout = () => {
    router.push('/workout');
  };

  const last = data.recentWorkout;
  const summary = last
    ? `Last session: ${formatExerciseName(last.exercise)}, ${formatDate(last.ended_at || last.started_at)}.`
    : 'No sessions recorded yet.';

  return (
    <div className="space-y-8 pb-10">
      <DashboardHeader user={user} summary={summary} onStartWorkout={handleStartWorkout} />

      <DashboardStats kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <RecentWorkout session={data.recentWorkout} onStartWorkout={handleStartWorkout} />
          <PerformanceChart points={data.trendPoints} />
          <RecentActivity sessions={data.recentActivity} />
        </div>

        <div className="space-y-10">
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
