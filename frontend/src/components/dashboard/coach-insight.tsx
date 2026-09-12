'use client';

import React from 'react';
import { AIReportItem } from '@/lib/api';
import { formatDate } from '@/lib/use-dashboard-data';

interface CoachInsightProps {
  report: AIReportItem | null;
}

export function CoachInsight({ report }: CoachInsightProps) {
  if (!report) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            AI Coach&apos;s Insight
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 border border-dashed border-zinc-800 rounded-lg">
          <svg className="w-7 h-7 text-zinc-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm font-medium text-zinc-300">No AI reports generated yet</p>
          <p className="text-xs text-zinc-500 max-w-xs mt-1">
            Complete a workout to receive your first AI coaching report with tailored technique analysis.
          </p>
        </div>
      </div>
    );
  }

  const overallScore = report.overall_score !== null ? Math.round(report.overall_score) : null;
  const createdAtFormatted = formatDate(report.created_at);

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-lime-400/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-lime-400" />
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            AI Coach&apos;s Insight
          </h3>
        </div>
        <span className="text-xs text-zinc-500 font-mono">{createdAtFormatted}</span>
      </div>

      {/* Main summary paragraph */}
      {report.coach_summary && (
        <p className="text-sm text-zinc-200 leading-relaxed font-normal">
          &ldquo;{report.coach_summary}&rdquo;
        </p>
      )}

      {/* Structured insights grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {report.next_session_focus && (
          <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1">
            <span className="text-xs font-semibold text-lime-400 uppercase tracking-wide block">
              Next Session Focus
            </span>
            <p className="text-xs text-zinc-300 font-medium leading-normal">
              {report.next_session_focus}
            </p>
          </div>
        )}

        {overallScore !== null && (
          <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Overall Score
            </span>
            <span className="text-xl font-bold text-lime-400 font-mono">
              {overallScore}/100
            </span>
          </div>
        )}
      </div>

      {report.motivation && (
        <p className="text-xs text-zinc-400 italic pt-1 border-t border-zinc-800/60">
          {report.motivation}
        </p>
      )}
    </div>
  );
}
