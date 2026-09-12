'use client';

import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading Dashboard">
      {/* Header skeleton */}
      <div className="h-28 bg-zinc-900 border border-zinc-800 rounded-xl p-6" />

      {/* KPI stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-4" />
        ))}
      </div>

      {/* Main grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-56 bg-zinc-900 border border-zinc-800 rounded-xl" />
          <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-xl" />
        </div>
        <div className="space-y-6">
          <div className="h-56 bg-zinc-900 border border-zinc-800 rounded-xl" />
          <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
