'use client';

import React from 'react';
import { FormTrendPoint } from '@/lib/use-dashboard-data';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/state-panel';

interface PerformanceChartProps {
  points: FormTrendPoint[];
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD = { left: 36, right: 16, top: 24, bottom: 32 };
const STRONG_THRESHOLD = 85;

export function PerformanceChart({ points }: PerformanceChartProps) {
  if (!points || points.length < 2) {
    return (
      <Section title="Form score trend">
        <EmptyState
          title="Not enough data for a trend yet"
          description="Finish at least two scored sessions and your form score over time will be charted here."
        />
      </Section>
    );
  }

  const chartWidth = WIDTH - PAD.left - PAD.right;
  const chartHeight = HEIGHT - PAD.top - PAD.bottom;
  // Show the range the scores actually occupy (floored to a multiple of 10) instead of a mostly empty 0 to 100 axis.
  const lowest = Math.min(...points.map((p) => p.score), STRONG_THRESHOLD);
  const floor = Math.max(0, Math.floor((lowest - 10) / 10) * 10);
  const yFor = (score: number) => PAD.top + (1 - (Math.max(floor, Math.min(100, score)) - floor) / (100 - floor)) * chartHeight;
  const ticks = [floor, Math.round((floor + 100) / 2 / 5) * 5, 100].filter((v, i, a) => a.indexOf(v) === i);

  const coords = points.map((p, i) => ({
    ...p,
    x: PAD.left + (i / (points.length - 1)) * chartWidth,
    y: yFor(p.score),
  }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <Section title="Form score trend" meta={`Last ${points.length} sessions`}>
      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full min-w-[480px] overflow-visible" role="img" aria-label="Line chart of form score by session. The same data is listed in the table below.">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(v)} y2={yFor(v)} className="stroke-rule" strokeWidth="1" />
            <text x={PAD.left - 8} y={yFor(v) + 4} textAnchor="end" className="fill-ink-2 text-[11px]">
              {v}
            </text>
          </g>
        ))}

        {/* The threshold the score bands are built on, labelled directly on the chart. */}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={yFor(STRONG_THRESHOLD)}
          y2={yFor(STRONG_THRESHOLD)}
          className="stroke-rule-strong"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text x={PAD.left + 4} y={yFor(STRONG_THRESHOLD) - 6} textAnchor="start" className="fill-ink-2 text-[11px]">
          Strong from {STRONG_THRESHOLD}
        </text>

        <polyline points={line} fill="none" className="stroke-brand" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {coords.map((c, i) => (
          <g key={c.sessionId || i}>
            <circle cx={c.x} cy={c.y} r="4" className="fill-canvas stroke-brand" strokeWidth="2">
              <title>{`${c.exercise}: ${c.score}% on ${c.fullDate}`}</title>
            </circle>
            <text x={c.x} y={c.y - 10} textAnchor="middle" className="fill-ink stroke-canvas text-[11px] font-medium [paint-order:stroke]" strokeWidth="4">
              {Math.round(c.score)}
            </text>
            <text x={c.x} y={HEIGHT - 8} textAnchor="middle" className="fill-ink-2 text-[11px]">
              {c.dateLabel}
            </text>
          </g>
        ))}
      </svg>
      </div>

      <table className="sr-only">
        <caption>Form score by session</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Exercise</th>
            <th>Form score</th>
          </tr>
        </thead>
        <tbody>
          {coords.map((c, i) => (
            <tr key={c.sessionId || i}>
              <td>{c.fullDate}</td>
              <td>{c.exercise}</td>
              <td>{c.score}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
