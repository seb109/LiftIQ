# Live workout pipeline — performance notes

Pipeline: browser camera → canvas capture → JPEG → WebSocket `/ws/webcam` → `imdecode` →
`gym_trainer.process_frame` (MediaPipe + form checks + OpenCV overlay) → `imencode` →
WebSocket → `createImageBitmap` → canvas. Stats are polled separately from `GET /stats`.

## Diagnostics (opt-in, silent by default)

**Browser** — in the DevTools console, then start a workout:

    localStorage.setItem('liftiq_perf', '1')     // off: localStorage.removeItem('liftiq_perf')

One line per second: send/recv fps, payload KB, frame size, capture+encode ms, decode ms,
send→painted round-trip, `/stats` latency, React commits of the live view, main-thread
long tasks, stalled frames. (`frontend/src/lib/workout-perf.ts`)

**Server** — set `PERF_LOG=1` in the Render environment. One line per 5 s per connection:
`decode / cv / encode` ms per frame, `server_busy` %, `gap` (idle time between a response
and the next frame = client + network cost), payload sizes, `loop_lag` (event-loop
blocking) and, at connect, host CPUs vs container CPU quota. (`app/core/ws_perf.py`)

Reading it: `gap` ≫ `decode+cv+encode` → network/browser bound. `server_busy` near 100 % →
server CPU bound (upgrade the instance or lower per-frame cost). `loop_lag` high → something
is blocking the asyncio loop.

## Design rules that keep the pipeline smooth

- Frames never cause React renders; only the 800 ms stats poll and 1 s timer do.
- At most `MAX_IN_FLIGHT` (2) frames are on the wire; the server answers every frame
  exactly once, in order (an empty message acknowledges a skipped frame).
- CV work runs on a worker thread under the session's `lock`; never call
  `process_frame` inline in an `async def` handler, and never close/replace a session's
  `pose` without holding `sess.lock`.
- Capture is downscaled to ≤ 640 px wide (the size the CV engine is validated at).
- The `/ws/webcam` auth DB session is closed before the long-lived loop starts.
- The WS access token travels in the query string; uvicorn log lines are redacted
  (`_RedactTokenFilter` in `main.py`). Never log the WS URL.
