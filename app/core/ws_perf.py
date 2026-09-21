"""Opt-in timing diagnostics for the /ws/webcam frame pipeline.

Disabled by default (zero overhead beyond a boolean check). Enable on the server with
the environment variable PERF_LOG=1; it then emits ONE summary log line per interval
per connection (never per frame). No tokens, URLs or image data are logged.

What the line tells you:
  decode / cv / encode  server-side cost of each stage per frame (cv = process_frame,
                        i.e. MediaPipe + form checks + OpenCV overlay drawing)
  gap                   time between sending a response and receiving the next frame.
                        This is browser capture/encode + network RTT + upload, i.e. the
                        part of each cycle the server is idle. If gap >> decode+cv+encode
                        the bottleneck is not the server CPU.
  loop_lag              how late the asyncio event loop wakes up from a 50 ms sleep.
                        Large values mean something is blocking the loop (sync CV work,
                        sync DB calls) and delaying every other request/websocket.
"""
import asyncio
import logging
import os
import time

logger = logging.getLogger("liftiq.ws_perf")

REPORT_INTERVAL_S = 5.0
LAG_PROBE_INTERVAL_S = 0.05

_lag_samples: list[float] = []
_lag_task: "asyncio.Task | None" = None


async def _lag_probe() -> None:
    while True:
        t0 = time.perf_counter()
        await asyncio.sleep(LAG_PROBE_INTERVAL_S)
        _lag_samples.append((time.perf_counter() - t0 - LAG_PROBE_INTERVAL_S) * 1000.0)


def ensure_lag_probe() -> None:
    """Start the (single, process-wide) event-loop lag probe on the running loop."""
    global _lag_task
    if _lag_task is None or _lag_task.done():
        _lag_task = asyncio.get_running_loop().create_task(_lag_probe())


def _cgroup_cpu_limit() -> str:
    """Best-effort container CPU quota (cgroup v2 then v1); 'unknown' when unavailable."""
    try:
        with open("/sys/fs/cgroup/cpu.max") as fh:
            quota, period = fh.read().split()
            return "unlimited" if quota == "max" else f"{int(quota) / int(period):.2f} cpu"
    except Exception:
        pass
    try:
        with open("/sys/fs/cgroup/cpu/cpu.cfs_quota_us") as fh:
            quota = int(fh.read())
        with open("/sys/fs/cgroup/cpu/cpu.cfs_period_us") as fh:
            period = int(fh.read())
        return "unlimited" if quota < 0 else f"{quota / period:.2f} cpu"
    except Exception:
        return "unknown"


class WsPerf:
    def __init__(self, session_id: str):
        self.tag = session_id[:8]
        self._reset()
        self._last_response_at: "float | None" = None
        logger.info(
            "ws-perf start sid=%s host_cpus=%s usable_cpus=%s container_quota=%s",
            self.tag, os.cpu_count(),
            len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else "n/a",
            _cgroup_cpu_limit(),
        )

    def _reset(self) -> None:
        self._start = time.perf_counter()
        self._n = 0
        self._decode = self._cv = self._encode = self._gap = 0.0
        self._in_bytes = self._out_bytes = 0
        self._dims = "?"

    def frame_received(self) -> None:
        if self._last_response_at is not None:
            self._gap += (time.perf_counter() - self._last_response_at) * 1000.0

    def frame_done(self, decode_ms: float, cv_ms: float, encode_ms: float,
                   in_bytes: int, out_bytes: int, dims: str) -> None:
        self._n += 1
        self._decode += decode_ms
        self._cv += cv_ms
        self._encode += encode_ms
        self._in_bytes += in_bytes
        self._out_bytes += out_bytes
        self._dims = dims
        self._last_response_at = time.perf_counter()
        elapsed = self._last_response_at - self._start
        if elapsed >= REPORT_INTERVAL_S:
            self._flush(elapsed)

    def _flush(self, elapsed: float) -> None:
        n = max(self._n, 1)
        lags = _lag_samples[:]
        _lag_samples.clear()
        lag_max = max(lags) if lags else 0.0
        lag_avg = sum(lags) / len(lags) if lags else 0.0
        logger.info(
            "ws-perf sid=%s %s fps=%.1f decode=%.0fms cv=%.0fms encode=%.0fms "
            "server_busy=%.0f%% gap=%.0fms in=%.0fKB out=%.0fKB loop_lag avg=%.0fms max=%.0fms",
            self.tag, self._dims, self._n / elapsed,
            self._decode / n, self._cv / n, self._encode / n,
            100.0 * (self._decode + self._cv + self._encode) / 1000.0 / elapsed,
            self._gap / n, self._in_bytes / n / 1024, self._out_bytes / n / 1024,
            lag_avg, lag_max,
        )
        self._reset()
