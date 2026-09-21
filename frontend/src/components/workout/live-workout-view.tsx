'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WorkoutSession } from '@/lib/use-workout-session';
import { WorkoutStats } from '@/lib/api';
import { ConnectionState } from '@/lib/use-workout-session';
import { ConnectionStatus } from './connection-status';
import { StatsPanel } from './stats-panel';
import { CoachingBar } from './coaching-bar';
import { EndWorkoutDialog } from './end-workout-dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ScoreValue } from '@/components/ui/score';
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

/**
 * The workout stage. Rendered on the dark `stage` surface: the camera feed is the
 * content, and the counters are sized to be read from a few metres away.
 */
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
    // but .play() returns a promise, so its rejection must be handled.
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
      console.log('[Workout] video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
    }
  };

  const handleEndConfirm = async () => {
    setShowEndDialog(false);
    await onEnd();
  };

  const isConnecting =
    connectionState === 'CONNECTING' || connectionState === 'RECONNECTING' || connectionState === 'READY';

  return (
    <div className="stage flex min-h-screen flex-col bg-canvas text-ink">
      <EndWorkoutDialog
        isOpen={showEndDialog}
        isStopping={isStopping}
        onConfirm={handleEndConfirm}
        onCancel={() => setShowEndDialog(false)}
      />

      <header className="flex items-center justify-between border-b border-rule px-4 py-3 sm:px-6">
        <h1 className="text-base font-semibold">{formatExercise(session.exercise)}</h1>
        <ConnectionStatus state={connectionState} />
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Camera. The raw video and the annotated canvas fill the same box and share
            object-contain, so the overlay lines up with the picture on any screen shape. */}
        <div className="relative min-h-[50vh] flex-1 overflow-hidden bg-sunken lg:min-h-0">
          {/*
            Live camera preview, always in the DOM so the user sees themselves and so
            videoWidth/videoHeight are available for frame capture (it must not be hidden).
            The annotated canvas is drawn on top once frames return from the backend.
          */}
          <video
            ref={videoRef}
            id="workout-video"
            autoPlay
            muted
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            className="absolute inset-0 h-full w-full object-contain"
            aria-label="Live camera preview"
          />

          <canvas
            ref={annotatedCanvasRef}
            id="annotated-canvas"
            className="absolute inset-0 h-full w-full object-contain"
            aria-label="Live pose detection overlay"
          />

          {isConnecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-overlay">
              <LoadingSpinner size="lg" label="Connecting" />
              <p className="text-lg font-medium">
                {connectionState === 'RECONNECTING' ? 'Reconnecting' : 'Starting camera'}
              </p>
            </div>
          )}

          {isPaused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-overlay">
              <p className="font-display text-3xl">Paused</p>
              <p className="mt-1 text-ink-2">Select Resume to continue.</p>
            </div>
          )}

          {/* Compact figures for narrow screens, where the sidebar is hidden. */}
          <dl className="absolute bottom-3 left-3 flex items-end gap-5 rounded-surface border border-rule bg-canvas px-4 py-2 lg:hidden">
            <div>
              <dt className="text-xs text-ink-2">Reps</dt>
              <dd id="mobile-rep-count" className="font-display text-3xl tabular-nums leading-none">
                {stats?.counter ?? 0}
              </dd>
            </div>
            {stats?.form_score !== null && stats?.form_score !== undefined && (
              <div>
                <dt className="text-xs text-ink-2">Form</dt>
                <dd className="text-lg leading-none">
                  <ScoreValue score={stats.form_score} />
                </dd>
              </div>
            )}
          </dl>
        </div>

        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-rule p-6 lg:block xl:w-80">
          <StatsPanel
            stats={stats}
            elapsedSeconds={elapsedSeconds}
            targetReps={session.targetReps}
            targetSets={session.targetSets}
          />
        </aside>
      </div>

      <div className="space-y-3 border-t border-rule px-4 py-3 sm:px-6">
        <CoachingBar stats={stats} />

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-2 tabular-nums lg:hidden">
            Set {stats?.current_set ?? 1} of {session.targetSets},{' '}
            {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
          </p>

          <div className="ml-auto flex gap-2">
            <Button id="pause-workout-btn" variant="secondary" onClick={onTogglePause}>
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              id="end-workout-btn"
              variant="danger"
              onClick={() => setShowEndDialog(true)}
              disabled={isStopping}
            >
              End workout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
