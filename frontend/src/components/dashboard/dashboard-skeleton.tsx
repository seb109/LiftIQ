'use client';

import React from 'react';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';

/** Mirrors the dashboard layout so nothing moves when the data arrives. */
export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading dashboard" className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-12 w-36" />
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-rule bg-rule lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 bg-canvas py-5 pr-4 lg:px-6 lg:first:pl-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-10">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}
