'use client';

import React, { useState } from 'react';
import { WorkoutSession } from '@/lib/use-workout-session';
import { WorkoutStats } from '@/lib/api';
import { ConnectionState } from '@/lib/use-workout-session';
import { ConnectionStatus } from './connection-status';
import { StatsPanel } from './stats-panel';
import { CoachingBar } from './coaching-bar';
import { EndWorkoutDialog } from './end-workout-dialog';

function formatExercise(ex: string): string {
  return ex.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface LiveWorkoutViewProps {
  session: WorkoutSession;
  stats: WorkoutStats | null;
  elapsedSeconds: number;
  connectionState: ConnectionState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  annotatedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onEnd: () => Promise<void>;
  onTogglePause: () => void;
}

export function LiveWorkoutView({
  session,
  stats,
  elapsedSeconds,
  connectionState,
  videoRef,
  annotatedCanvasRef,
  onEnd,
  onTogglePause,
}: LiveWorkoutViewProps) {
  const [showEndDialog, setShowEndDialog] = useState(false);
  const isStopping = connectionState === 'STOPPING';
  const isPaused   = connectionState === 'PAUSED';

  const handleEndConfirm = async () => {
    setShowEndDialog(false);
    await onEnd();
  };

  return (
    <>
      <EndWorkoutDialog
        isOpen={showEndDialog}
        isStopping={isStopping}
        onConfirm={handleEndConfirm}
        onCancel={() => setShowEndDialog(false)}
      />

      <div className="min-h-screen bg-[#09090B] flex flex-col">
        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-sm font-semibold text-slate-200">
              {formatExercise(session.exercise)}
            </span>
          </div>
          <ConnectionStatus state={connectionState} />
        </header>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">

          {/* Camera area (hero) */}
          <div className="relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden">
            {/* Hidden video element (MediaStream source) */}
            <video
              ref={videoRef}
              id="workout-video"
              muted
              playsInline
              className="hidden"
              aria-hidden="true"
            />

            {/* Annotated canvas — shows processed frames from backend */}
            <canvas
              ref={annotatedCanvasRef}
              id="annotated-canvas"
              className="w-full h-full object-contain max-h-[calc(100vh-120px)]"
              aria-label="Live pose detection view"
            />

            {/* Connecting overlay */}
            {(connectionState === 'CONNECTING' || connectionState === 'RECONNECTING') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/70 gap-4">
                <span className="w-10 h-10 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin" />
                <p className="text-sm text-slate-400">
                  {connectionState === 'RECONNECTING' ? 'Reconnecting…' : 'Connecting to camera…'}
                </p>
              </div>
            )}

            {/* Paused overlay */}
            {isPaused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/60">
                <p className="text-2xl font-bold text-white">Paused</p>
                <p className="text-sm text-slate-400 mt-1">Press Resume to continue</p>
              </div>
            )}

            {/* Mobile quick-stats overlay (bottom-left of camera) */}
            <div className="absolute bottom-3 left-3 lg:hidden flex items-center gap-2">
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg px-3 py-1.5 text-center">
                <span id="mobile-rep-count" className="text-xl font-extrabold text-white tabular-nums">{stats?.counter ?? 0}</span>
                <span className="text-xs text-slate-400 ml-1">reps</span>
              </div>
              {stats?.form_score !== null && stats?.form_score !== undefined && (
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg px-3 py-1.5">
                  <span className="text-xl font-bold text-lime-400 tabular-nums">{Math.round(stats.form_score)}</span>
                  <span className="text-xs text-slate-400 ml-1">form</span>
                </div>
              )}
            </div>
          </div>

          {/* Desktop stats sidebar */}
          <div className="hidden lg:flex flex-col w-56 xl:w-64 border-l border-zinc-800/60 bg-zinc-950/60 p-4 gap-4 overflow-y-auto">
            <StatsPanel
              stats={stats}
              elapsedSeconds={elapsedSeconds}
              targetReps={session.targetReps}
              targetSets={session.targetSets}
            />
          </div>
        </div>

        {/* ── Bottom bar ───────────────────────────────────────────────────── */}
        <div className="border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 py-3 space-y-3">
          {/* Coaching message */}
          <CoachingBar stats={stats} />

          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            {/* Mobile stats pill */}
            <div className="flex lg:hidden items-center gap-2 text-xs text-slate-400">
              <span>Set {stats?.current_set ?? 1}/{session.targetSets}</span>
              <span className="text-zinc-700">•</span>
              <span className="font-mono">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
                {String(elapsedSeconds % 60).padStart(2, '0')}
              </span>
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                id="pause-workout-btn"
                onClick={onTogglePause}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-slate-300 hover:bg-zinc-800 text-sm font-semibold transition-colors"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                id="end-workout-btn"
                onClick={() => setShowEndDialog(true)}
                disabled={isStopping}
                className="px-4 py-2 rounded-xl bg-red-900/60 hover:bg-red-800/80 border border-red-800/50 text-red-300 text-sm font-bold transition-colors disabled:opacity-50"
              >
                End Workout
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
