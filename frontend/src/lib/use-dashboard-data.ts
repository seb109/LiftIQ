import { useQuery } from '@tanstack/react-query';
import { sessionsApi, reportsApi, WorkoutSessionItem, AIReportItem } from './api';

export interface FormTrendPoint {
  sessionId: string;
  dateLabel: string;
  fullDate: string;
  score: number;
  exercise: string;
}

export interface ExerciseDistribution {
  exercise: string;
  displayName: string;
  count: number;
  percentage: number;
}

export interface DashboardKPIs {
  totalWorkouts: number;
  totalReps: number;
  avgFormScore: number | null;
  totalDurationSeconds: number;
  formattedDuration: string;
}

export interface ProcessedDashboardData {
  kpis: DashboardKPIs;
  recentWorkout: WorkoutSessionItem | null;
  recentActivity: WorkoutSessionItem[];
  trendPoints: FormTrendPoint[];
  exerciseDistribution: ExerciseDistribution[];
  latestReport: AIReportItem | null;
  hasWorkouts: boolean;
}

export function formatExerciseName(name: string): string {
  if (!name) return 'Workout';
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes} min`;
  }
  return `${seconds} sec`;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Recent';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Recent';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recent';
  }
}

export function formatShortDate(dateString: string | null): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function processDashboardData(
  sessions: WorkoutSessionItem[],
  reports: AIReportItem[]
): ProcessedDashboardData {
  // Only include completed/valid sessions
  const completedSessions = (sessions || []).filter(
    (s) => s.status === 'completed' || Boolean(s.ended_at)
  );

  // Sort completed sessions descending by date (most recent first)
  const sortedSessions = [...completedSessions].sort((a, b) => {
    const timeA = new Date(a.ended_at || a.started_at || 0).getTime();
    const timeB = new Date(b.ended_at || b.started_at || 0).getTime();
    return timeB - timeA;
  });

  const totalWorkouts = sortedSessions.length;
  const totalReps = sortedSessions.reduce((acc, s) => acc + (s.total_reps || 0), 0);

  const scoredSessions = sortedSessions.filter((s) => typeof s.average_form_score === 'number' && s.average_form_score !== null);
  const avgFormScore =
    scoredSessions.length > 0
      ? Math.round(
          (scoredSessions.reduce((acc, s) => acc + (s.average_form_score || 0), 0) / scoredSessions.length) * 10
        ) / 10
      : null;

  const totalDurationSeconds = sortedSessions.reduce(
    (acc, s) => acc + (s.duration_seconds || 0),
    0
  );

  const kpis: DashboardKPIs = {
    totalWorkouts,
    totalReps,
    avgFormScore,
    totalDurationSeconds,
    formattedDuration: formatDuration(totalDurationSeconds),
  };

  const recentWorkout = sortedSessions.length > 0 ? sortedSessions[0] : null;
  const recentActivity = sortedSessions.slice(0, 10);

  // Performance Trend: chronological order (oldest to newest) for chart plotting
  const trendSessions = [...scoredSessions]
    .slice(0, 10)
    .reverse();

  const trendPoints: FormTrendPoint[] = trendSessions.map((s) => ({
    sessionId: s.id,
    dateLabel: formatShortDate(s.ended_at || s.started_at),
    fullDate: formatDate(s.ended_at || s.started_at),
    score: Math.round((s.average_form_score || 0) * 10) / 10,
    exercise: formatExerciseName(s.exercise),
  }));

  // Exercise Breakdown
  const countsMap: Record<string, number> = {};
  sortedSessions.forEach((s) => {
    const ex = s.exercise || 'unknown';
    countsMap[ex] = (countsMap[ex] || 0) + 1;
  });

  const exerciseDistribution: ExerciseDistribution[] = Object.entries(countsMap)
    .map(([ex, count]) => ({
      exercise: ex,
      displayName: formatExerciseName(ex),
      count,
      percentage: totalWorkouts > 0 ? Math.round((count / totalWorkouts) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const latestReport = reports && reports.length > 0 ? reports[0] : null;

  return {
    kpis,
    recentWorkout,
    recentActivity,
    trendPoints,
    exerciseDistribution,
    latestReport,
    hasWorkouts: totalWorkouts > 0,
  };
}

export function useDashboardData() {
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.getSessions(50),
    staleTime: 30000,
  });

  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.getReports(10),
    staleTime: 30000,
  });

  const isLoading = sessionsQuery.isLoading || reportsQuery.isLoading;
  const isError = sessionsQuery.isError || reportsQuery.isError;
  const error = (sessionsQuery.error || reportsQuery.error) as Error | null;

  const data = processDashboardData(
    sessionsQuery.data || [],
    reportsQuery.data || []
  );

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: () => {
      sessionsQuery.refetch();
      reportsQuery.refetch();
    },
  };
}
