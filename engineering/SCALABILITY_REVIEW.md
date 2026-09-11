# SCALABILITY_REVIEW.md

## 1. The headline fact

LiftIQ can serve **exactly one active workout, for the entire process, at any given moment.** This isn't a "scales poorly" finding — it's a hard ceiling of one, below which no amount of infrastructure (more CPU, more instances, a CDN, a bigger database) changes the number. Scaling work cannot begin until this is fixed; it is a correctness gate, not a performance-tuning target.

## 2. Root cause

Three module-level, process-wide containers hold all live application state:

- `gym_trainer.state` (`gym_trainer.py:402-417`)
- `gym_trainer.session` (`gym_trainer.py:420-438`)
- `main.uploaded_video_path` (`main.py:23`)

Every request that touches workout state (`/start_session`, `/stats`, `/get_set_feedback`, `/webcam_feed`, `/upload_video`, `/uploaded_feed`) reads or writes these same three containers regardless of which client is asking. A second visitor calling `/start_session` while a first visitor's workout is active doesn't get a second, independent workout — it silently resets and takes over the first visitor's session, mid-workout, with no error, no warning, and no isolation of any kind.

## 3. Why this blocks every other scaling lever

- **Horizontal scaling (multiple server instances) doesn't help.** Even with N instances behind a load balancer, each instance still only supports one session — you'd get N independent single-user demos, not N-times capacity for a shared user base, and a given visitor could bounce between instances mid-session (no sticky routing exists) and lose their state entirely.
- **Vertical scaling (bigger instance) doesn't help either**, because the limit isn't CPU or memory headroom — it's that the *data structure* has no concept of "whose session is this."
- **Any load-testing work done before this is fixed (see `PERFORMANCE_REVIEW.md` §4.2) is measuring the wrong thing** — you'd be benchmarking how fast one session runs, not how many concurrent sessions the system can hold, because it structurally cannot hold more than one regardless of speed.

## 4. The fix is already scoped, just not started

`docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` Track 1 Phase 3 specifies exactly this fix: replace the module-level dicts with an in-memory, keyed store (session-id → state), with uploaded-video temp files and future WebSocket connections scoped to the same key. No database is required for this — it's explicitly scoped as a plain in-process dict, deferring real persistence to `docs/03` Phase 3/4. Confirmed via code inspection: **not started.** No session-key concept exists anywhere in `main.py` or `gym_trainer.py` today.

## 5. Interaction with the regression harness

`tools/regression_baseline.py` currently drives `gym_trainer.process_frame()` against the *same* global `state`/`session` objects the live app uses (`analyze_video()` calls `trainer.start_session(...)` then loops `trainer.process_frame(frame)` directly against module state — `tools/regression_baseline.py:60-72`). `docs/10` §5 Phase 3 already flags this explicitly: whoever implements the session-isolation refactor must either preserve the exact single-session call shape the regression tool currently exercises, or update the regression harness itself to call through the new keyed-store API — otherwise the harness silently stops testing the code path the live app actually uses. This is a real trap: a session-isolation refactor that "still passes regression" could pass by accident (testing the old global path) rather than by design (testing the new per-session path), if the harness isn't updated in lockstep.

## 6. What "scale" will actually mean once the blocker is fixed

Once per-session isolation exists, the real scaling question becomes the CPU-bound MediaPipe inference ceiling covered in `PERFORMANCE_REVIEW.md` — how many concurrent `process_frame()` calls a given instance size can sustain. That's a legitimate, measurable capacity-planning question. Today, it isn't yet the right question to be asking, because the answer is "1" regardless of CPU, and no amount of performance tuning changes that number.

## 7. Recommendation

Sequence `docs/10` Track 1 Phase 3 before any capacity planning, load testing, or infrastructure sizing decision — not because it's the most urgent *user-facing* fix (Phase 2's webcam-capture rework arguably is, since without it there's no remote-hosting story at all), but because it's the prerequisite for every subsequent scaling conversation to even be meaningful. See `ROADMAP.md` for exact sequencing.
