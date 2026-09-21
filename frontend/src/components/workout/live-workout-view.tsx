'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WorkoutSession } from '@/lib/use-workout-session';
import { WorkoutStats } from '@/lib/api';
import { ConnectionState } from '@/lib/use-workout-session';
import { ConnectionStatus } from './connection-status';
import { StatsPanel } from './stats-panel';
import { CoachingBar } from './coaching-bar';
import { EndWorkoutDialog } from './end-workout-dialog';
import { markLiveViewRender } from '@/lib/workout-perf';

function formatExercise(ex: string): string {
  return ex.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface LiveWorkoutViewProps {
  session: WorkoutSession;
  stats: WorkoutStats | null;
  elapsedSeconds: number;
  connectionState: ConnectionState;
  /** The live MediaStream from getUserMedia. LiveWorkoutView owns attachment to the <video>. */
  stream: MediaStream | null;
  annotatedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onEnd: () => Promise<void>;
  onTogglePause: () => void;
}

export function LiveWorkoutView({
  session,
  stats,
  elapsedSeconds,
  connectionState,
  stream,
  annotatedCanvasRef,
  onEnd,
  onTogglePause,
}: LiveWorkoutViewProps) {
  markLiveViewRender();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isStopping = connectionState === 'STOPPING';
  const isPaused   = connectionState === 'PAUSED';

  /**
   * Attach the MediaStream to the <video> element once both are available.
   * This runs whenever `stream` changes (including initial mount when stream is set).
   * Using autoPlay attribute + srcObject assignment is the correct cross-browser pattern.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    console.log('[Workout] attaching stream to <video> element');
    video.srcObject = stream;

    // autoPlay may not trigger in all browsers without an explicit .play() call,
    // but .play() returns a promise — we must handle the rejection gracefully.
    video.play().then(() => {
      console.log('[Workout] video.play() succeeded');
    }).catch((err) => {
      // AbortError is harmless (play() interrupted by a later call)
      if (err?.name !== 'AbortError') {
        console.warn('[Workout] video.play() rejected:', err?.name, err?.message);
      }
    });

    return () => {
      // Detach stream when component unmounts or stream changes
      video.srcObject = null;
    };
  }, [stream]);

  // Log when video metadata is loaded (dimensions available)
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      console.log('[Workout] video metadata loaded — dimensions:', video.videoWidth, 'x', video.videoHeight);
    }
  };

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
          <div className="relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden min-h-[300px]">

            {/*
              Live camera preview — always visible so the user sees themselves.
              The annotated canvas is drawn on top via absolute positioning once frames arrive.
              video is NOT hidden: stream.videoWidth/Height must be > 0 for frame capture.
            */}
            <video
              ref={videoRef}
              id="workout-video"
              autoPlay
              muted
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full h-full object-cover max-h-[calc(100vh-120px)]"
              aria-label="Live camera preview"
            />

            {/*
              Annotated canvas — drawn on top of raw video feed once frames return from backend.
              Starts transparent; fills in as annotated JPEG frames arrive.
            */}
            <canvas
              ref={annotatedCanvasRef}
              id="annotated-canvas"
              className="absolute inset-0 w-full h-full object-contain"
              aria-label="Live pose detection overlay"
            />

            {/* Connecting overlay (before WS is open) */}
            {(connectionState === 'CONNECTING' || connectionState === 'RECONNECTING' || connectionState === 'READY') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/60 gap-4">
                <span className="w-10 h-10 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin" />
                <p className="text-sm text-slate-300 font-medium">
                  {connectionState === 'RECONNECTING' ? 'Reconnecting…' : 'Starting camera…'}
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

            {/* Mobile quick-stats overlay */}
            <div className="absolute bottom-3 left-3 lg:hidden flex items-center gap-2 z-10">
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm">
                <span id="mobile-rep-count" className="text-xl font-extrabold text-white tabular-nums">{stats?.counter ?? 0}</span>
                <span className="text-xs text-slate-400 ml-1">reps</span>
              </div>
              {stats?.form_score !== null && stats?.form_score !== undefined && (
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg px-3 py-1.5 backdrop-blur-sm">
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
          <CoachingBar stats={stats} />

          <div className="flex items-center justify-between gap-3">
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
