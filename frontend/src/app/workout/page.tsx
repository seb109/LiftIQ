'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { useWorkoutSession } from '@/lib/use-workout-session';
import { WorkoutSetup } from '@/components/workout/workout-setup';
import { LiveWorkoutView } from '@/components/workout/live-workout-view';
import { WorkoutCompleteView } from '@/components/workout/workout-complete-view';
import { CameraPermissionError } from '@/components/workout/camera-permission-error';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { InlineAlert } from '@/components/ui/state-panel';

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

  // ── Completion screen ──────────────────────────────────────────────────────
  if (isDone && completionData) {
    return (
      <AppShell>
        <WorkoutCompleteView data={completionData} onNewWorkout={clearErrors} />
      </AppShell>
    );
  }

  // ── Stopping state ─────────────────────────────────────────────────────────
  if (connectionState === 'STOPPING') {
    return (
      <div className="stage flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-6 text-ink">
        <LoadingSpinner size="lg" label="Finishing your workout" />
        <div className="space-y-1 text-center">
          <p className="text-xl font-semibold">Finishing your workout</p>
          <p className="text-ink-2">Saving your session and writing your coaching report. This can take a few seconds.</p>
        </div>
      </div>
    );
  }

  // ── Camera permission / hardware error ─────────────────────────────────────
  if (isCameraError) {
    return (
      <AppShell>
        <CameraPermissionError onRetry={clearErrors} errorReason={cameraErrorReason} startError={startError} />
      </AppShell>
    );
  }

  // ── Live workout ───────────────────────────────────────────────────────────
  if (isLive && session) {
    return (
      <>
        {stopError && (
          <div className="stage fixed inset-x-0 top-0 z-50 p-4">
            <InlineAlert title="Could not finish the workout" className="mx-auto max-w-xl bg-surface">
              {stopError}
            </InlineAlert>
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
    <AppShell>
      <WorkoutSetup onStart={startSession} isLoading={isStarting} error={isCameraError ? null : startError} />
    </AppShell>
  );
}

export default function WorkoutPage() {
  return (
    <ProtectedRoute>
      <WorkoutPageContent />
    </ProtectedRoute>
  );
}
