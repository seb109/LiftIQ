'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StartSessionResponse,
  StopSessionResponse,
  WorkoutStats,
  getWorkoutStats,
  startWorkoutSession,
  stopWorkoutSession,
} from './api';

// ── Constants ────────────────────────────────────────────────────────────────

/** Stats poll interval in ms. */
export const STATS_POLL_INTERVAL_MS = 800;

/** JPEG quality for frames sent to backend (0–1). */
export const FRAME_JPEG_QUALITY = 0.7;

/** WebSocket base URL (ws:// not http://). */
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws');

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionState =
  | 'IDLE'
  | 'CONNECTING'
  | 'READY'
  | 'LIVE'
  | 'PAUSED'
  | 'RECONNECTING'
  | 'STOPPING'
  | 'COMPLETED'
  | 'ERROR';

export interface WorkoutSession {
  sessionId: string;
  exercise: string;
  targetReps: number;
  targetSets: number;
  startedAt: string;
}

export interface UseWorkoutSessionReturn {
  // Session
  session: WorkoutSession | null;
  connectionState: ConnectionState;
  // Live CV stats
  stats: WorkoutStats | null;
  elapsedSeconds: number;
  // Completion data
  completionData: StopSessionResponse | null;
  // Errors
  startError: string | null;
  stopError: string | null;
  // Actions
  startSession: (exercise: string, targetReps: number, targetSets: number) => Promise<void>;
  endSession: () => Promise<void>;
  togglePause: () => void;
  clearErrors: () => void;
  // Refs for camera
  videoRef: React.RefObject<HTMLVideoElement | null>;
  annotatedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkoutSession(): UseWorkoutSessionReturn {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completionData, setCompletionData] = useState<StopSessionResponse | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  // Camera / canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const annotatedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Internal refs (not causing re-renders)
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const pausedRef = useRef(false);
  const awaitingFrameRef = useRef(false); // ping-pong frame control
  const startedAtRef = useRef<Date | null>(null);
  const stoppingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Keep sessionRef in sync
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Camera ──────────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Create off-screen capture canvas once
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Frame capture loop (ping-pong) ───────────────────────────────────────────

  const captureAndSend = useCallback(() => {
    const ws = wsRef.current;
    const video = videoRef.current;
    const capCanvas = captureCanvasRef.current;

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !video ||
      !capCanvas ||
      pausedRef.current ||
      awaitingFrameRef.current
    ) {
      rafRef.current = requestAnimationFrame(captureAndSend);
      return;
    }

    capCanvas.width = video.videoWidth || 640;
    capCanvas.height = video.videoHeight || 480;
    const ctx = capCanvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(captureAndSend);
      return;
    }

    ctx.drawImage(video, 0, 0, capCanvas.width, capCanvas.height);
    capCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        awaitingFrameRef.current = true;
        blob.arrayBuffer().then((buf) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(buf);
          }
        });
      },
      'image/jpeg',
      FRAME_JPEG_QUALITY,
    );

    rafRef.current = requestAnimationFrame(captureAndSend);
  }, []);

  // ── WebSocket ────────────────────────────────────────────────────────────────

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const openWs = useCallback((sid: string) => {
    closeWs();
    setConnectionState('CONNECTING');
    const ws = new WebSocket(`${WS_BASE}/ws/webcam?session_id=${sid}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionState('LIVE');
      awaitingFrameRef.current = false;
      rafRef.current = requestAnimationFrame(captureAndSend);
    };

    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      // Received annotated JPEG frame
      awaitingFrameRef.current = false;
      const blob = new Blob([event.data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const canvas = annotatedCanvasRef.current;
      if (!canvas) { URL.revokeObjectURL(url); return; }
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    };

    ws.onclose = () => {
      if (stoppingRef.current) return;
      if (reconnectAttemptsRef.current < 3) {
        reconnectAttemptsRef.current += 1;
        setConnectionState('RECONNECTING');
        reconnectTimerRef.current = setTimeout(() => {
          if (sessionRef.current) openWs(sessionRef.current.sessionId);
        }, 2000);
      } else {
        setConnectionState('ERROR');
      }
    };

    ws.onerror = () => { ws.close(); };
  }, [captureAndSend, closeWs]);

  // ── Stats polling ─────────────────────────────────────────────────────────────

  const startStatsPolling = useCallback((sid: string) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (pausedRef.current) return;
      try {
        const s = await getWorkoutStats(sid);
        setStats(s);
      } catch {
        // silently swallow poll errors
      }
    }, STATS_POLL_INTERVAL_MS);
  }, []);

  const stopStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  // ── Elapsed timer ─────────────────────────────────────────────────────────────

  const startTimer = useCallback((startedAt: Date) => {
    startedAtRef.current = startedAt;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // ── Public actions ────────────────────────────────────────────────────────────

  const startSession = useCallback(async (
    exercise: string,
    targetReps: number,
    targetSets: number,
  ) => {
    setStartError(null);
    setConnectionState('CONNECTING');

    // 1. Request camera first — fail fast before hitting the API
    const cameraOk = await startCamera();
    if (!cameraOk) {
      setConnectionState('ERROR');
      setStartError('Camera access was denied. Please allow camera access and try again.');
      return;
    }

    // 2. Create authenticated backend session
    let sessionData: StartSessionResponse;
    try {
      sessionData = await startWorkoutSession(exercise, targetReps, targetSets);
    } catch (err: unknown) {
      stopCamera();
      setConnectionState('ERROR');
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      setStartError(msg);
      return;
    }

    const ws: WorkoutSession = {
      sessionId: sessionData.session_id,
      exercise: sessionData.exercise,
      targetReps,
      targetSets,
      startedAt: sessionData.started_at,
    };
    setSession(ws);
    sessionRef.current = ws;
    stoppingRef.current = false;

    // 3. Open WebSocket and start stats/timer
    openWs(sessionData.session_id);
    startStatsPolling(sessionData.session_id);
    startTimer(new Date(sessionData.started_at));
    setConnectionState('LIVE');
  }, [startCamera, stopCamera, openWs, startStatsPolling, startTimer]);

  const endSession = useCallback(async () => {
    const sid = sessionRef.current?.sessionId;
    if (!sid || stoppingRef.current) return;

    stoppingRef.current = true;
    setConnectionState('STOPPING');
    setStopError(null);

    // Stop frame loop and stats before making the stop call
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    stopStatsPolling();
    stopTimer();
    closeWs();
    stopCamera();

    try {
      const result = await stopWorkoutSession(sid);
      setCompletionData(result);
      setConnectionState('COMPLETED');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stop session';
      setStopError(msg);
      setConnectionState('ERROR');
    }
  }, [closeWs, stopCamera, stopStatsPolling, stopTimer]);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setConnectionState(pausedRef.current ? 'PAUSED' : 'LIVE');
  }, []);

  const clearErrors = useCallback(() => {
    setStartError(null);
    setStopError(null);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stopStatsPolling();
      stopTimer();
      closeWs();
      stopCamera();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [closeWs, stopCamera, stopStatsPolling, stopTimer]);

  return {
    session,
    connectionState,
    stats,
    elapsedSeconds,
    completionData,
    startError,
    stopError,
    startSession,
    endSession,
    togglePause,
    clearErrors,
    videoRef,
    annotatedCanvasRef,
  };
}
