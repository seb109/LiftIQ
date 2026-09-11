# PERFORMANCE_REVIEW.md

## 1. Where the actual cost is

This app's performance profile is dominated by one thing: **per-frame MediaPipe pose inference is CPU-bound and runs synchronously inside the request-handling path.** Every other performance question in this repo is secondary to that fact.

## 2. The concurrency ceiling

`webcam_stream()` and `video_stream()` (`main.py:125-187`) are plain (non-`async`) generator functions passed to `StreamingResponse`. Starlette executes non-async generators in its threadpool rather than on the event loop. Each active stream therefore:

- Occupies one worker thread for its entire lifetime.
- Sleeps inside that thread via `time.sleep()` (`video_stream`'s frame-pacing logic, `main.py:180-183`) rather than yielding the event loop.
- Runs a full `gym_trainer.process_frame()` call — MediaPipe inference plus OpenCV drawing — synchronously inside that same thread, once per frame.

Net effect: concurrent-stream capacity is capped by the ASGI server's threadpool size, not by real async I/O concurrency, and each concurrent stream adds real CPU load (MediaPipe inference), not just an idle waiting connection. `docs/10` §3.3 already identifies this; this review confirms it's still true and adds one clarification — **the ceiling is compounded, not just capped**, because unlike a typical I/O-bound thread (which mostly waits), each of these threads is doing continuous CPU work, so raising the threadpool size doesn't scale capacity the way it would for a typical blocking-I/O workload — it just contends more threads for the same finite CPU.

## 3. What's not measured

No load test, benchmark, or profiling output exists anywhere in the repository. Every performance target in `docs/02` §31, `docs/09` §13, and `CODEX.md`'s Performance Targets section (`<100ms` auth, `<1s` dashboard, `<2s` workout init, `<5s` AI report, `<200ms` average API) is aspirational — none has been measured against this codebase, and most (auth, dashboard) don't have corresponding features built yet to measure. The one target that *is* measurable today — AI report generation `<5s` — has no instrumentation recording actual Groq response latency anywhere in `ai_trainer.py` or `main.py`.

## 4. Concrete, measurable questions before any hosting/scaling decision

`docs/10` §7 open decision #3 already poses this correctly: hosting target and expected concurrent users determines instance sizing, and CPU-bound MediaPipe inference is the real constraint, not typical web request volume. This review adds the specific measurements needed to answer it, none of which currently exist:

1. **Per-frame `process_frame()` latency**, isolated from network/streaming overhead — easy to measure using the existing `tools/regression_baseline.py` harness (it already drives `process_frame()` in a tight loop; adding a timer around that call would produce this number with no new infrastructure).
2. **Real concurrent-stream capacity per CPU core**, under the actual planned deployment's instance size — not measurable until Track 1 Phase 2/3 (capture pipeline rework + session isolation) exist, since today's architecture can only ever serve one session at a time regardless of CPU headroom (see `SCALABILITY_REVIEW.md`).
3. **Groq round-trip latency**, both typical and worst-case (Groq is generally fast, but there is currently zero instrumentation to confirm the `<5s` target is met or to catch regressions if Groq's own latency changes).

## 5. Frontend performance

Not yet a meaningful topic — `templates/index.html` has no build step, no bundle size to speak of, and no client-side computation beyond a 1-second polling loop (`setInterval(updateStats, 1000)`, `templates/index.html:503`) and simple DOM updates. `docs/02` §31/`docs/08` §29's Lighthouse-score and re-render targets apply to the future Next.js rebuild, not to this prototype, and aren't meaningfully evaluable against a server-rendered static page with no JS framework.

## 6. Recommendation

Before any hosting decision is finalized (Track 1 Phase 5 in `docs/10`), run the cheap, already-available measurement in §4.1 above using the existing regression harness. It requires no new code beyond a timer, doesn't touch `gym_trainer.py`'s logic at all, and directly informs whether the CPU-bound ceiling this review describes is a minor constraint or the dominant one for the target hosting budget.
