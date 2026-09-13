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

/** Delay between consecutive frame sends in ms (rate-limit to ~10 fps max). */
const FRAME_INTERVAL_MS = 100;

/** WebSocket base URL derived from the API URL env var (ws:// not http://). */
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  .replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'));

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionState =
  | 'IDLE'
  | 'CONNECTING'
  | 'READY'       // camera ready, WS not yet open
  | 'LIVE'        // WS open, frames flowing
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

/** Specific camera error types. */
export type CameraErrorReason =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'SecurityError'
  | 'UnsupportedBrowser'
  | 'Unknown';

export interface UseWorkoutSessionReturn {
  session: WorkoutSession | null;
  connectionState: ConnectionState;
  stats: WorkoutStats | null;
  elapsedSeconds: number;
  completionData: StopSessionResponse | null;
  startError: string | null;
  cameraErrorReason: CameraErrorReason | null;
  stopError: string | null;
  stream: MediaStream | null;                                // exposed so LiveWorkoutView can attach it
  startSession: (exercise: string, targetReps: number, targetSets: number) => Promise<void>;
  endSession: () => Promise<void>;
  togglePause: () => void;
  clearErrors: () => void;
  annotatedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyDOMException(err: unknown): CameraErrorReason {
  if (typeof window === 'undefined') return 'UnsupportedBrowser';
  if (!(err instanceof DOMException)) return 'Unknown';
  switch (err.name) {
    case 'NotAllowedError':       return 'NotAllowedError';
    case 'NotFoundError':         return 'NotFoundError';
    case 'NotReadableError':      return 'NotReadableError';
    case 'OverconstrainedError':  return 'OverconstrainedError';
    case 'SecurityError':         return 'SecurityError';
    default:                      return 'Unknown';
  }
}

function cameraErrorMessage(reason: CameraErrorReason): string {
  switch (reason) {
    case 'NotAllowedError':      return 'Camera permission denied. Please allow camera access in your browser and try again.';
    case 'NotFoundError':        return 'No camera was found. Please connect a webcam and try again.';
    case 'NotReadableError':     return 'Camera is already in use by another application. Please close it and try again.';
    case 'OverconstrainedError': return 'Camera does not meet the required constraints. Try a different camera.';
    case 'SecurityError':        return 'Camera access is blocked by your browser security policy. Ensure you are on localhost or HTTPS.';
    case 'UnsupportedBrowser':   return 'Your browser does not support camera access. Please use Chrome, Firefox, or Edge.';
    default:                     return 'Failed to access camera. Please check your camera and browser permissions.';
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkoutSession(): UseWorkoutSessionReturn {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completionData, setCompletionData] = useState<StopSessionResponse | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [cameraErrorReason, setCameraErrorReason] = useState<CameraErrorReason | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  // Exposed MediaStream so LiveWorkoutView can attach it to the <video> element itself
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Annotated canvas ref (populated by LiveWorkoutView)
  const annotatedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Internal refs — never trigger re-renders
  const wsRef                = useRef<WebSocket | null>(null);
  const streamRef            = useRef<MediaStream | null>(null);
  const captureCanvasRef     = useRef<HTMLCanvasElement | null>(null);
  const statsIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef           = useRef<WorkoutSession | null>(null);
  const pausedRef            = useRef(false);
  const awaitingFrameRef     = useRef(false);
  const stoppingRef          = useRef(false);
  const reconnectTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const frameLoopActiveRef   = useRef(false);

  // Keep sessionRef in sync
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Camera ───────────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    console.log('[Workout] stopping camera');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    frameLoopActiveRef.current = false;
    if (frameTimerRef.current !== null) {
      clearTimeout(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }, []);

  /** Request camera. Does NOT attach stream to any element — LiveWorkoutView does that via useEffect. */
  const acquireCamera = useCallback(async (): Promise<boolean> => {
    console.log('[Workout] requesting camera');

    if (!navigator?.mediaDevices?.getUserMedia) {
      const reason: CameraErrorReason = 'UnsupportedBrowser';
      setCameraErrorReason(reason);
      setStartError(cameraErrorMessage(reason));
      console.error('[Workout] getUserMedia not available in this environment');
      return false;
    }

    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = ms;
      setStream(ms); // triggers LiveWorkoutView's useEffect to attach it

      const tracks = ms.getVideoTracks();
      console.log('[Workout] camera granted — tracks:', tracks.map((t) => `${t.label} (${t.readyState})`).join(', '));

      // Create off-screen capture canvas once
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
      }
      return true;
    } catch (err: unknown) {
      const reason = classifyDOMException(err);
      const msg    = cameraErrorMessage(reason);
      setCameraErrorReason(reason);
      setStartError(msg);
      console.error('[Workout] camera error:', reason, err);
      return false;
    }
  }, []);

  // ── Frame capture loop (rate-limited, NOT RAF) ────────────────────────────────

  const scheduleNextFrame = useCallback(() => {
    if (!frameLoopActiveRef.current) return;
    frameTimerRef.current = setTimeout(() => {
      sendFrame();
    }, FRAME_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendFrame = useCallback(() => {
    if (!frameLoopActiveRef.current) return;

    const ws        = wsRef.current;
    const capCanvas = captureCanvasRef.current;

    // Find the live <video> element through the exposed stream tracks
    // We locate it by querying the document for a video with our stream's id
    const videoEl = document.getElementById('workout-video') as HTMLVideoElement | null;

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !videoEl ||
      !capCanvas ||
      pausedRef.current ||
      awaitingFrameRef.current
    ) {
      scheduleNextFrame();
      return;
    }

    // Guard: video must have valid dimensions (stream is playing)
    if (!videoEl.videoWidth || !videoEl.videoHeight) {
      scheduleNextFrame();
      return;
    }

    capCanvas.width  = videoEl.videoWidth;
    capCanvas.height = videoEl.videoHeight;
    const ctx = capCanvas.getContext('2d');
    if (!ctx) { scheduleNextFrame(); return; }

    ctx.drawImage(videoEl, 0, 0, capCanvas.width, capCanvas.height);
    capCanvas.toBlob(
      (blob) => {
        if (!blob) { scheduleNextFrame(); return; }
        awaitingFrameRef.current = true;
        blob.arrayBuffer().then((buf) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(buf);
          } else {
            awaitingFrameRef.current = false;
            scheduleNextFrame();
          }
        });
      },
      'image/jpeg',
      FRAME_JPEG_QUALITY,
    );
    // Note: scheduleNextFrame() is called from onmessage (after ACK) to enforce ping-pong
  }, [scheduleNextFrame]);

  // ── WebSocket ────────────────────────────────────────────────────────────────

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose   = null;
      wsRef.current.onerror   = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
      console.log('[Workout] websocket closed');
    }
  }, []);

  const openWs = useCallback((sid: string) => {
    closeWs();
    const url = `${WS_BASE}/ws/webcam?session_id=${sid}`;
    console.log('[Workout] connecting websocket:', url);
    setConnectionState('CONNECTING');

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      awaitingFrameRef.current     = false;
      frameLoopActiveRef.current   = true;
      setConnectionState('LIVE');
      console.log('[Workout] websocket opened');
      scheduleNextFrame();
    };

    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      // Received annotated JPEG — unblock next frame
      awaitingFrameRef.current = false;
      console.log('[Workout] websocket message: annotated frame', event.data.byteLength, 'bytes');

      const blob = new Blob([event.data], { type: 'image/jpeg' });
      const url  = URL.createObjectURL(blob);
      const canvas = annotatedCanvasRef.current;
      if (!canvas) { URL.revokeObjectURL(url); scheduleNextFrame(); return; }

      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width  = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }
        URL.revokeObjectURL(url);
        scheduleNextFrame(); // only schedule next frame after receiving this one (ping-pong)
      };
      img.onerror = () => { URL.revokeObjectURL(url); scheduleNextFrame(); };
      img.src = url;
    };

    ws.onclose = (ev) => {
      console.log('[Workout] websocket closed (code=%d, reason=%s)', ev.code, ev.reason);
      frameLoopActiveRef.current = false;
      if (stoppingRef.current) return;
      if (reconnectAttemptsRef.current < 3) {
        reconnectAttemptsRef.current += 1;
        setConnectionState('RECONNECTING');
        console.log('[Workout] reconnect attempt', reconnectAttemptsRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (sessionRef.current) openWs(sessionRef.current.sessionId);
        }, 2000);
      } else {
        setConnectionState('ERROR');
      }
    };

    ws.onerror = (ev) => {
      console.error('[Workout] websocket error:', ev);
      ws.close();
    };
  }, [closeWs, scheduleNextFrame]);

  // ── Stats polling ─────────────────────────────────────────────────────────────

  const startStatsPolling = useCallback((sid: string) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (pausedRef.current || stoppingRef.current) return;
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

  /**
   * Lifecycle order:
   * 1. Acquire camera (getUserMedia) → exposes stream via setStream()
   * 2. Create backend session
   * 3. setSession() → page re-renders LiveWorkoutView which attaches stream via useEffect
   * 4. openWs() → WS opens → frame loop starts
   */
  const startSession = useCallback(async (
    exercise: string,
    targetReps: number,
    targetSets: number,
  ) => {
    setStartError(null);
    setCameraErrorReason(null);
    setConnectionState('CONNECTING');
    console.log('[Workout] starting session — exercise:', exercise);

    // STEP 1: Request camera (before rendering live view so we fail fast)
    const cameraOk = await acquireCamera();
    if (!cameraOk) {
      setConnectionState('ERROR');
      return;
    }
    setConnectionState('READY');

    // STEP 2: Create authenticated backend session
    let sessionData: StartSessionResponse;
    try {
      sessionData = await startWorkoutSession(exercise, targetReps, targetSets);
      console.log('[Workout] session id:', sessionData.session_id);
    } catch (err: unknown) {
      stopCamera();
      setConnectionState('ERROR');
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      setStartError(msg);
      return;
    }

    const ws: WorkoutSession = {
      sessionId: sessionData.session_id,
      exercise:  sessionData.exercise,
      targetReps,
      targetSets,
      startedAt: sessionData.started_at,
    };

    stoppingRef.current          = false;
    reconnectAttemptsRef.current = 0;
    pausedRef.current            = false;

    // STEP 3: Commit session to state — this triggers re-render of LiveWorkoutView.
    // LiveWorkoutView's useEffect will attach streamRef.current to its <video> element.
    setSession(ws);
    sessionRef.current = ws;

    // STEP 4: Start background services (WS, stats, timer).
    // Small timeout lets React flush the LiveWorkoutView render so its <video> ref exists.
    setTimeout(() => {
      openWs(sessionData.session_id);
      startStatsPolling(sessionData.session_id);
      startTimer(new Date(sessionData.started_at));
    }, 150);
  }, [acquireCamera, stopCamera, openWs, startStatsPolling, startTimer]);

  const endSession = useCallback(async () => {
    const sid = sessionRef.current?.sessionId;
    if (!sid || stoppingRef.current) return;

    stoppingRef.current        = true;
    frameLoopActiveRef.current = false;
    setConnectionState('STOPPING');
    setStopError(null);
    console.log('[Workout] stopping session:', sid);

    if (frameTimerRef.current) { clearTimeout(frameTimerRef.current); frameTimerRef.current = null; }
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
    setCameraErrorReason(null);
    setStopError(null);
    setConnectionState('IDLE');
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stoppingRef.current        = true;
      frameLoopActiveRef.current = false;
      if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
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
    cameraErrorReason,
    stopError,
    stream,
    startSession,
    endSession,
    togglePause,
    clearErrors,
    annotatedCanvasRef,
  };
}
