'use client';

import React from 'react';
import Link from 'next/link';
import { AIReportItem } from '@/lib/api';
import { formatDate } from '@/lib/use-dashboard-data';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/state-panel';
import { ScoreValue } from '@/components/ui/score';

interface CoachInsightProps {
  report: AIReportItem | null;
}

export function CoachInsight({ report }: CoachInsightProps) {
  if (!report) {
    return (
      <Section title="Latest coaching report">
        <EmptyState
          title="No reports yet"
          description="When you finish a workout, LiftIQ writes a short report on your technique. The latest one shows here."
        />
      </Section>
    );
  }

  return (
    <Section
      title="Latest coaching report"
      meta={
        <Link href={`/reports/${report.id}`} className="font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline">
          Read full report
        </Link>
      }
    >
      <p className="text-sm text-ink-2">
        {formatDate(report.created_at)}. Written by AI from your session data.
      </p>

      {report.coach_summary && (
        <p className="mt-4 font-serif text-lg leading-7 text-ink">{report.coach_summary}</p>
      )}

      <dl className="mt-5 space-y-4 border-t border-rule pt-4">
        {report.next_session_focus && (
          <div>
            <dt className="text-sm text-ink-2">Focus for next session</dt>
            <dd className="mt-0.5 font-medium">{report.next_session_focus}</dd>
          </div>
        )}
        {report.overall_score !== null && (
          <div>
            <dt className="text-sm text-ink-2">Overall score</dt>
            <dd className="mt-0.5">
              <ScoreValue score={report.overall_score} showLabel />
            </dd>
          </div>
        )}
      </dl>
    </Section>
  );
}
