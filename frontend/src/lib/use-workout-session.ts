'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StartSessionResponse,
  StopSessionResponse,
  WorkoutStats,
  getStoredAccessToken,
  getWorkoutStats,
  startWorkoutSession,
  stopWorkoutSession,
} from './api';
import { WorkoutPerfMeter, createWorkoutPerfMeter } from './workout-perf';

// ── Constants ────────────────────────────────────────────────────────────────

/** Stats poll interval in ms. */
export const STATS_POLL_INTERVAL_MS = 800;

/** JPEG quality for frames sent to backend (0–1). */
export const FRAME_JPEG_QUALITY = 0.7;

/** Minimum gap between consecutive frame sends in ms (rate-limit to ~15 fps max). */
const FRAME_INTERVAL_MS = 66;

/**
 * Frames allowed on the wire awaiting their annotated response. 1 would make every
 * frame pay a full network round trip + server time serially (measured ~2 fps over a
 * 120 ms RTT link); 2 overlaps upload/download of one frame with server processing of
 * the other while keeping the server-side queue bounded to a single waiting frame.
 */
const MAX_IN_FLIGHT = 2;

/** Frames are downscaled to at most this width before JPEG encoding (the CV engine is validated at ~640 px). */
const CAPTURE_MAX_WIDTH = 640;

/** If the oldest in-flight frame has had no response for this long, assume it was lost and resume sending. */
const RESPONSE_TIMEOUT_MS = 4000;

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

/** Decode a JPEG off the main thread where supported (createImageBitmap), else via <img>. */
function decodeJpeg(buf: ArrayBuffer): Promise<CanvasImageSource & { width: number; height: number; close?: () => void }> {
  const blob = new Blob([buf], { type: 'image/jpeg' });
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('frame decode failed')); };
    img.src = url;
  });
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
  const stoppingRef          = useRef(false);
  const reconnectTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const frameLoopActiveRef   = useRef(false);
  // Frame-pipeline bookkeeping (refs only — frames must never cause React renders)
  const pumpRef              = useRef<() => void>(() => {});
  const openWsRef            = useRef<(sid: string) => void>(() => {});   // self-reference for reconnects
  const inFlightRef          = useRef<number[]>([]);   // send timestamps of frames awaiting a response (FIFO)
  const captureBusyRef       = useRef(false);
  const lastSendAtRef        = useRef(0);
  const rxSeqRef             = useRef(0);              // sequence of the latest received response
  const paintedSeqRef        = useRef(0);              // sequence of the latest painted response
  const videoElRef           = useRef<HTMLVideoElement | null>(null);
  const statsInFlightRef     = useRef(false);
  const perfRef              = useRef<WorkoutPerfMeter | null>(null);

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
    videoElRef.current = null;
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
      // Ask for VGA-class video (ideal, not exact — never fails with OverconstrainedError).
      // Unconstrained `video: true` can hand back 720p/1080p on some cameras, which
      // multiplies capture, upload, decode and annotated-download cost per frame.
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: CAPTURE_MAX_WIDTH }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
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

  // ── Frame capture loop (rate-limited setTimeout, NOT RAF) ─────────────────────
  //
  // Exactly ONE pending timer exists at any time (schedulePump always clears the
  // previous one), so loops can never multiply. Up to MAX_IN_FLIGHT frames may be
  // outstanding; a response frees a slot and re-arms the timer immediately.

  const schedulePump = useCallback((delayMs: number) => {
    if (!frameLoopActiveRef.current) return;
    if (frameTimerRef.current !== null) clearTimeout(frameTimerRef.current);
    frameTimerRef.current = setTimeout(() => {
      frameTimerRef.current = null;
      pumpRef.current();
    }, Math.max(0, delayMs));
  }, []);

  const captureAndSend = useCallback((ws: WebSocket, videoEl: HTMLVideoElement) => {
    const capCanvas = captureCanvasRef.current;
    if (!capCanvas) return;

    // Downscale to CAPTURE_MAX_WIDTH; only touch canvas size when it changes
    // (assigning width/height reallocates and clears the backing store).
    const scale = Math.min(1, CAPTURE_MAX_WIDTH / videoEl.videoWidth);
    const w = Math.round(videoEl.videoWidth * scale);
    const h = Math.round(videoEl.videoHeight * scale);
    if (capCanvas.width  !== w) capCanvas.width  = w;
    if (capCanvas.height !== h) capCanvas.height = h;
    const ctx = capCanvas.getContext('2d');
    if (!ctx) return;

    const t0 = performance.now();
    ctx.drawImage(videoEl, 0, 0, w, h);
    captureBusyRef.current = true;
    capCanvas.toBlob(
      (blob) => {
        captureBusyRef.current = false;
        const sock = wsRef.current;
        if (!blob || !sock || sock !== ws || sock.readyState !== WebSocket.OPEN || !frameLoopActiveRef.current) return;
        const now = performance.now();
        lastSendAtRef.current = now;
        inFlightRef.current.push(now);
        perfRef.current?.sent(blob.size, w, h, now - t0);
        sock.send(blob);
      },
      'image/jpeg',
      FRAME_JPEG_QUALITY,
    );
  }, []);

  const pump = useCallback(() => {
    if (!frameLoopActiveRef.current) return;
    const now = performance.now();

    // Watchdog: the server answers every frame, so a response overdue by seconds
    // means it was lost. Free the window instead of stalling the stream forever.
    const oldest = inFlightRef.current[0];
    if (oldest !== undefined && now - oldest > RESPONSE_TIMEOUT_MS) {
      inFlightRef.current = [];
      perfRef.current?.stall();
    }

    const ws = wsRef.current;
    if (!videoElRef.current || !videoElRef.current.isConnected) {
      videoElRef.current = document.getElementById('workout-video') as HTMLVideoElement | null;
    }
    const videoEl = videoElRef.current;

    if (
      ws &&
      ws.readyState === WebSocket.OPEN &&
      videoEl &&
      videoEl.videoWidth > 0 &&
      videoEl.videoHeight > 0 &&
      !pausedRef.current &&
      !captureBusyRef.current &&
      inFlightRef.current.length < MAX_IN_FLIGHT &&
      now - lastSendAtRef.current >= FRAME_INTERVAL_MS - 2
    ) {
      captureAndSend(ws, videoEl);
    }
    // Fallback poll; a received response re-arms sooner (see ws.onmessage).
    schedulePump(FRAME_INTERVAL_MS);
  }, [captureAndSend, schedulePump]);

  useEffect(() => { pumpRef.current = pump; }, [pump]);

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
    const accessToken = getStoredAccessToken();
    const url = `${WS_BASE}/ws/webcam?session_id=${sid}&token=${encodeURIComponent(accessToken || '')}`;
    // Never log `url`: it carries the access token as a query param.
    console.log('[Workout] connecting websocket:', `${WS_BASE}/ws/webcam`);
    setConnectionState('CONNECTING');

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      inFlightRef.current          = [];
      captureBusyRef.current       = false;
      frameLoopActiveRef.current   = true;
      setConnectionState('LIVE');
      console.log('[Workout] websocket opened');
      schedulePump(0);
    };

    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      // One response per frame, in order. Free a window slot and re-arm the send timer.
      const sentAt = inFlightRef.current.shift();
      const seq = ++rxSeqRef.current;
      schedulePump(FRAME_INTERVAL_MS - (performance.now() - lastSendAtRef.current));

      const buf = event.data;
      if (buf.byteLength === 0) return; // server skipped this frame — nothing to draw

      const canvas = annotatedCanvasRef.current;
      if (!canvas) return;

      const decodeStart = performance.now();
      decodeJpeg(buf).then((img) => {
        // Decodes can finish out of order; never paint an older frame over a newer one.
        if (seq < paintedSeqRef.current) { img.close?.(); return; }
        paintedSeqRef.current = seq;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width  !== img.width)  canvas.width  = img.width;
          if (canvas.height !== img.height) canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }
        img.close?.();
        const done = performance.now();
        perfRef.current?.received(buf.byteLength, sentAt === undefined ? 0 : done - sentAt, done - decodeStart);
      }).catch(() => { /* undecodable frame — the next one replaces it */ });
    };

    ws.onclose = (ev) => {
      console.log('[Workout] websocket closed (code=%d, reason=%s)', ev.code, ev.reason);
      frameLoopActiveRef.current = false;
      if (frameTimerRef.current !== null) {
        clearTimeout(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      inFlightRef.current = [];
      if (stoppingRef.current) return;
      if (reconnectAttemptsRef.current < 3) {
        reconnectAttemptsRef.current += 1;
        setConnectionState('RECONNECTING');
        console.log('[Workout] reconnect attempt', reconnectAttemptsRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (sessionRef.current && !stoppingRef.current) openWsRef.current(sessionRef.current.sessionId);
        }, 2000);
      } else {
        setConnectionState('ERROR');
      }
    };

    ws.onerror = (ev) => {
      console.error('[Workout] websocket error:', ev);
      ws.close();
    };
  }, [closeWs, schedulePump]);

  useEffect(() => { openWsRef.current = openWs; }, [openWs]);

  // ── Stats polling ─────────────────────────────────────────────────────────────

  const startStatsPolling = useCallback((sid: string) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      // Skip while a previous poll is still outstanding: overlapping requests pile up
      // when the backend is slow and can resolve out of order (older stats over newer).
      if (pausedRef.current || stoppingRef.current || statsInFlightRef.current) return;
      statsInFlightRef.current = true;
      const t0 = performance.now();
      try {
        const s = await getWorkoutStats(sid);
        perfRef.current?.statsPoll(performance.now() - t0);
        if (!stoppingRef.current) setStats(s);
      } catch {
        // silently swallow poll errors
      } finally {
        statsInFlightRef.current = false;
      }
    }, STATS_POLL_INTERVAL_MS);
  }, []);

  const stopStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    statsInFlightRef.current = false;
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

    // STEP 4: Start background services (WS, stats, timer). No artificial delay
    // needed: the frame loop looks up the <video> element lazily on every tick, so it
    // simply waits until LiveWorkoutView has rendered and the stream is playing.
    perfRef.current?.stop();
    perfRef.current = createWorkoutPerfMeter();
    inFlightRef.current = [];
    rxSeqRef.current = 0;
    paintedSeqRef.current = 0;
    openWs(sessionData.session_id);
    startStatsPolling(sessionData.session_id);
    startTimer(new Date(sessionData.started_at));
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
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    stopStatsPolling();
    stopTimer();
    closeWs();
    stopCamera();
    perfRef.current?.stop();
    perfRef.current = null;

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
      perfRef.current?.stop();
      perfRef.current = null;
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
