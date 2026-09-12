'use client';

import React from 'react';
import { FormTrendPoint } from '@/lib/use-dashboard-data';

interface PerformanceChartProps {
  points: FormTrendPoint[];
}

export function PerformanceChart({ points }: PerformanceChartProps) {
  if (!points || points.length < 2) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Form Score Trend
        </h3>
        <div className="flex flex-col items-center justify-center min-h-[160px] text-center p-4 border border-dashed border-zinc-800 rounded-lg">
          <svg className="w-8 h-8 text-zinc-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p className="text-sm font-medium text-zinc-300">Not enough data for trend analysis</p>
          <p className="text-xs text-zinc-500 max-w-xs mt-1">
            Complete at least 2 sessions with form ratings to visualize your progress over time.
          </p>
        </div>
      </div>
    );
  }

  const svgWidth = 500;
  const svgHeight = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const pointCoords = points.map((p, index) => {
    const x = paddingLeft + (index / (points.length - 1)) * chartWidth;
    const clampedScore = Math.max(0, Math.min(100, p.score));
    const y = paddingTop + (1 - clampedScore / 100) * chartHeight;
    return { ...p, x, y };
  });

  const polylinePoints = pointCoords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Gradient area path
  const firstPoint = pointCoords[0];
  const lastPoint = pointCoords[pointCoords.length - 1];
  const areaPath = `M ${firstPoint.x.toFixed(1)} ${svgHeight - paddingBottom} ` +
    pointCoords.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ` L ${lastPoint.x.toFixed(1)} ${svgHeight - paddingBottom} Z`;

  const yTicks = [100, 75, 50, 25, 0];

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Form Score Trend
        </h3>
        <span className="text-xs text-zinc-500 font-mono">
          Last {points.length} sessions
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[320px] overflow-visible"
        >
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A3E635" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#A3E635" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {yTicks.map((val) => {
            const y = paddingTop + (1 - val / 100) * chartHeight;
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#27272A"
                  strokeWidth="1"
                  strokeDasharray={val === 0 || val === 100 ? undefined : '3 3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#71717A"
                  fontSize="10"
                  fontFamily="sans-serif"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#scoreGradient)" />

          {/* Trend line */}
          <polyline
            fill="none"
            stroke="#A3E635"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {/* Points & X-axis labels */}
          {pointCoords.map((pt, i) => (
            <g key={pt.sessionId || i} className="group cursor-pointer">
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4"
                fill="#09090B"
                stroke="#A3E635"
                strokeWidth="2"
                className="transition-all duration-150 group-hover:r-6 group-hover:fill-lime-400"
              />
              <title>{`${pt.exercise}: ${pt.score}% on ${pt.fullDate}`}</title>
              <text
                x={pt.x}
                y={svgHeight - 10}
                textAnchor="middle"
                fill="#A1A1AA"
                fontSize="10"
                fontFamily="sans-serif"
              >
                {pt.dateLabel}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
