'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, UserCheck, Cpu, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Welcome Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="lime">Authenticated Shell</Badge>
                <Badge variant="neutral">Milestone 6A</Badge>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">
                Welcome, {user?.name || 'Athlete'}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Your authenticated session is active and token telemetry is synced with the LiftIQ backend engine.
              </p>
            </div>
          </div>

          {/* Infrastructure Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="elevated" className="border-zinc-800 bg-zinc-900/80">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2.5 rounded-xl bg-lime-400/10 border border-lime-400/20 text-lime-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Identity & Session State</CardTitle>
                  <CardDescription>JWT Access & Refresh Token System</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-slate-400">User ID:</span>
                  <span className="font-mono text-xs text-slate-200 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">{user?.id || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-slate-400">Account Email:</span>
                  <span className="font-mono text-xs text-slate-200">{user?.email || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400">Auth Token Rotation:</span>
                  <Badge variant="success">Active</Badge>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="border-zinc-800 bg-zinc-900/80">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Backend Integration</CardTitle>
                  <CardDescription>FastAPI REST Engine Status</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-slate-400">Backend API URL:</span>
                  <span className="font-mono text-xs text-slate-200">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-slate-400">REST Endpoints:</span>
                  <span className="font-mono text-xs text-slate-200">/api/v1/auth & /api/v1/users</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400">State Guard:</span>
                  <Badge variant="lime">Enforced</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Milestone Note */}
          <Card variant="bordered" className="border-zinc-800 bg-zinc-950/60 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-lime-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Milestone 6A Foundation Complete
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Next.js App Router, Tailwind CSS design system, JWT token lifecycle management, protected routing, and authentication UI (Login/Register) are fully operational.
                </p>
                <div className="pt-2 text-xs font-mono text-slate-400 flex items-center gap-1">
                  <span>Upcoming: Milestone 6B — Interactive Dashboard & Real-Time Workout Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 text-lime-400 ml-1 inline" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
