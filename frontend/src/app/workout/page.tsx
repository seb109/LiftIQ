'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useWorkoutSession } from '@/lib/use-workout-session';
import { WorkoutSetup } from '@/components/workout/workout-setup';
import { LiveWorkoutView } from '@/components/workout/live-workout-view';
import { WorkoutCompleteView } from '@/components/workout/workout-complete-view';
import { CameraPermissionError } from '@/components/workout/camera-permission-error';

function WorkoutPageContent() {
  const {
    session,
    connectionState,
    stats,
    elapsedSeconds,
    completionData,
    startError,
    cameraErrorReason,
    stopError,
    stream,
    startSession,
    endSession,
    togglePause,
    clearErrors,
    annotatedCanvasRef,
  } = useWorkoutSession();

  const isStarting = (connectionState === 'CONNECTING' || connectionState === 'READY') && !session;
  const isLive     = session !== null && connectionState !== 'COMPLETED' && connectionState !== 'IDLE';
  const isDone     = connectionState === 'COMPLETED' && completionData !== null;

  // Camera error: permission denied, not found, etc.
  const isCameraError = connectionState === 'ERROR' && !session && cameraErrorReason !== null;

  const handleRetry = () => {
    clearErrors();
  };

  // ── Completion screen ──────────────────────────────────────────────────────
  if (isDone && completionData) {
    return <WorkoutCompleteView data={completionData} />;
  }

  // ── Stopping state ─────────────────────────────────────────────────────────
  if (connectionState === 'STOPPING') {
    return (
      <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center gap-6 p-6">
        <span className="w-12 h-12 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-white">Finishing your workout…</p>
          <p className="text-sm text-slate-400">Saving your session and generating your AI report.</p>
        </div>
      </div>
    );
  }

  // ── Camera permission / hardware error ─────────────────────────────────────
  if (isCameraError) {
    return <CameraPermissionError onRetry={handleRetry} errorReason={cameraErrorReason} startError={startError} />;
  }

  // ── Live workout ───────────────────────────────────────────────────────────
  if (isLive && session) {
    return (
      <>
        {stopError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-800 rounded-xl px-5 py-3 text-sm text-red-300 shadow-xl">
            {stopError}
          </div>
        )}
        <LiveWorkoutView
          session={session}
          stats={stats}
          elapsedSeconds={elapsedSeconds}
          connectionState={connectionState}
          stream={stream}
          annotatedCanvasRef={annotatedCanvasRef}
          onEnd={endSession}
          onTogglePause={togglePause}
        />
      </>
    );
  }

  // ── Setup screen ───────────────────────────────────────────────────────────
  return (
    <WorkoutSetup
      onStart={startSession}
      isLoading={isStarting}
      error={isCameraError ? null : startError}
    />
  );
}

export default function WorkoutPage() {
  return (
    <ProtectedRoute>
      <WorkoutPageContent />
    </ProtectedRoute>
  );
}
