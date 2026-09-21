/**
 * Opt-in diagnostics for the live-workout frame pipeline.
 *
 * Silent unless enabled from the browser console:
 *
 *   localStorage.setItem('liftiq_perf', '1')   // then start a workout
 *   localStorage.removeItem('liftiq_perf')     // turn off
 *
 * When on, prints ONE summary line per second (never per frame) with:
 *   sent/recv fps, avg payload sizes, frame dimensions, capture+encode cost,
 *   round-trip (send -> annotated frame painted), stats poll latency,
 *   React commits of the live view, and main-thread long tasks.
 * No tokens, URLs or user data are logged.
 */

const FLAG_KEY = 'liftiq_perf';
const REPORT_INTERVAL_MS = 1000;

export interface WorkoutPerfMeter {
  enabled: boolean;
  sent(bytes: number, width: number, height: number, captureMs: number): void;
  received(bytes: number, roundTripMs: number, decodeMs: number): void;
  statsPoll(latencyMs: number): void;
  stall(): void;
  render(): void;
  stop(): void;
}

const NOOP: WorkoutPerfMeter = {
  enabled: false,
  sent() {},
  received() {},
  statsPoll() {},
  stall() {},
  render() {},
  stop() {},
};

let active: WorkoutPerfMeter | null = null;

/** Called from the live view's render body; a no-op unless diagnostics are enabled. */
export function markLiveViewRender(): void {
  active?.render();
}

function isEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function fresh() {
  return {
    sent: 0, sentBytes: 0, captureMs: 0, width: 0, height: 0,
    recv: 0, recvBytes: 0, rttMs: 0, rttMax: 0, decodeMs: 0,
    polls: 0, pollMs: 0, pollMax: 0,
    stalls: 0, renders: 0,
    longTasks: 0, longTaskMs: 0,
  };
}

export function createWorkoutPerfMeter(): WorkoutPerfMeter {
  if (!isEnabled()) return NOOP;

  let w = fresh();
  let windowStart = performance.now();

  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        w.longTasks += 1;
        w.longTaskMs += entry.duration;
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch {
    observer = null; // longtask API not supported (Safari/Firefox) — everything else still works
  }

  const timer = setInterval(() => {
    const now = performance.now();
    const secs = (now - windowStart) / 1000;
    const avg = (sum: number, n: number) => (n ? sum / n : 0);
    console.log(
      `[LiftIQ perf] send ${(w.sent / secs).toFixed(1)}fps ${w.width}x${w.height} ` +
      `${(avg(w.sentBytes, w.sent) / 1024).toFixed(0)}KB cap+enc ${avg(w.captureMs, w.sent).toFixed(0)}ms | ` +
      `recv ${(w.recv / secs).toFixed(1)}fps ${(avg(w.recvBytes, w.recv) / 1024).toFixed(0)}KB ` +
      `decode ${avg(w.decodeMs, w.recv).toFixed(0)}ms | ` +
      `round-trip avg ${avg(w.rttMs, w.recv).toFixed(0)}ms max ${w.rttMax.toFixed(0)}ms | ` +
      `/stats ${w.polls}x avg ${avg(w.pollMs, w.polls).toFixed(0)}ms max ${w.pollMax.toFixed(0)}ms | ` +
      `renders ${w.renders} | longtasks ${w.longTasks} (${w.longTaskMs.toFixed(0)}ms) | stalls ${w.stalls}`,
    );
    w = fresh();
    windowStart = now;
  }, REPORT_INTERVAL_MS);

  const meter: WorkoutPerfMeter = {
    enabled: true,
    sent(bytes, width, height, captureMs) {
      w.sent += 1; w.sentBytes += bytes; w.width = width; w.height = height; w.captureMs += captureMs;
    },
    received(bytes, roundTripMs, decodeMs) {
      w.recv += 1; w.recvBytes += bytes; w.rttMs += roundTripMs; w.decodeMs += decodeMs;
      if (roundTripMs > w.rttMax) w.rttMax = roundTripMs;
    },
    statsPoll(latencyMs) {
      w.polls += 1; w.pollMs += latencyMs;
      if (latencyMs > w.pollMax) w.pollMax = latencyMs;
    },
    stall() { w.stalls += 1; },
    render() { w.renders += 1; },
    stop() {
      clearInterval(timer);
      observer?.disconnect();
      if (active === meter) active = null;
    },
  };
  active = meter;
  return meter;
}
