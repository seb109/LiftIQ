'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { reportsApi } from '@/lib/api';
import { formatDate } from '@/lib/use-dashboard-data';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  ArrowLeft,
  AlertCircle,
  FileQuestion,
  Sparkles,
  ThumbsUp,
  AlertTriangle,
  TrendingUp,
  Target,
  Flame,
} from 'lucide-react';

function ScoreRing({ label, score }: { label: string; score: number | null }) {
  const value = score ?? 0;
  const color = value >= 85 ? 'text-lime-400' : value >= 70 ? 'text-amber-400' : 'text-rose-400';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="7" fill="none" className="text-zinc-800" />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="7"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={score === null ? circumference : offset}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-extrabold tabular-nums ${color}`}>
            {score !== null ? Math.round(score) : 'N/A'}
          </span>
        </div>
      </div>
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function ReportSection({
  icon,
  title,
  items,
  iconColor,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  iconColor: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className={iconColor}>{icon}</span>
        <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-zinc-300 leading-relaxed flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-zinc-600 mt-2 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportContent() {
  const router = useRouter();
  const params = useParams<{ reportId: string }>();
  const reportId = params?.reportId;

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => reportsApi.getReportById(reportId as string),
    enabled: Boolean(reportId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-zinc-500">Loading AI report…</p>
      </div>
    );
  }

  if (isError) {
    const status = (error as AxiosError)?.response?.status;
    const notFound = status === 404;

    return (
      <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 text-center max-w-xl mx-auto my-8">
        <div className={`p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto ${notFound ? 'bg-zinc-800 text-zinc-400' : 'bg-rose-950/50 text-rose-400'}`}>
          {notFound ? <FileQuestion className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-100">
            {notFound ? 'Report not available' : 'Failed to load report'}
          </h3>
          <p className="text-xs text-zinc-400">
            {notFound
              ? "This AI report doesn't exist, hasn't been generated yet, or doesn't belong to your account."
              : (error as Error)?.message || 'An unexpected error occurred while communicating with the server.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {!notFound && (
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-lg transition-colors border border-zinc-700"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => router.push('/history')}
            className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <button
        onClick={() => router.push('/history')}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to History
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-lime-400 uppercase tracking-widest">AI Coaching Report</p>
          <p className="text-xs text-zinc-500">
            {report.created_at ? formatDate(report.created_at) : 'Recent'}
            {report.model_name ? ` · ${report.model_name}` : ''}
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-around gap-6">
        <ScoreRing label="Overall Score" score={report.overall_score} />
        <ScoreRing label="Form Score" score={report.form_score} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
        <h3 className="text-sm font-bold text-zinc-100">Coach Summary</h3>
        <p className="text-sm text-zinc-300 leading-relaxed">{report.coach_summary || 'No summary available.'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReportSection
          icon={<ThumbsUp className="w-4 h-4" />}
          iconColor="text-lime-400"
          title="Strengths"
          items={report.strengths || []}
        />
        <ReportSection
          icon={<AlertTriangle className="w-4 h-4" />}
          iconColor="text-amber-400"
          title="Mistakes"
          items={report.mistakes || []}
        />
      </div>

      <ReportSection
        icon={<TrendingUp className="w-4 h-4" />}
        iconColor="text-sky-400"
        title="Improvements"
        items={report.improvements || []}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-zinc-100">Next Session Focus</h3>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {report.next_session_focus || 'Keep building on your current technique.'}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-zinc-100">Motivation</h3>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {report.motivation || 'Keep up the consistent work!'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReportDetailPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <ReportContent />
      </AppShell>
    </ProtectedRoute>
  );
}
