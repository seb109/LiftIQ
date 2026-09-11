# TECH_DEBT.md

Ranked by severity, matching the convention already established in `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` §3 (Blocker > High > Medium > Low > Informational), extended here with debt items that document doesn't cover.

## Blocker

### 1. Live webcam capture cannot function on a remote host
`webcam_stream()` (`main.py:125-143`) calls `cv2.VideoCapture(0, cv2.CAP_DSHOW)` on the server process. There is no camera device `0` on a headless remote host, and even where one exists it belongs to the server, not the visitor. Confirmed still unfixed. See `docs/10` §3.1/§4 for the full architectural analysis and the recommended fix (`getUserMedia` + WebSocket, Option A).

### 2. No multi-tenancy — one global session for the whole process
`gym_trainer.state`, `gym_trainer.session` (`gym_trainer.py:402-438`), and `main.uploaded_video_path` (`main.py:23`) are plain module-level containers. Two concurrent visitors silently overwrite each other's workout. Confirmed still unfixed. See `docs/10` §3.2.

## High

### 3. Synchronous, blocking streaming generators
`webcam_stream()`/`video_stream()` are non-`async` generators passed to `StreamingResponse`; Starlette runs them in its threadpool, and each holds a worker thread for its lifetime while sleeping via `time.sleep()`. Concurrency ceiling is capped by threadpool size, not real async I/O, and per-frame MediaPipe inference is CPU-bound. Confirmed still unfixed. See `docs/10` §3.3 and `PERFORMANCE_REVIEW.md`.

### 4. App dependency manifest exists but is unverified
`requirements.txt` was added (uncommitted) but, per `docs/11`'s own session log, has not yet been `pip install`-ed into `.venv` or smoke-tested. The committed `.venv` still only has the CV stack. Until this is verified, "the app runs from a clean checkout" is an unconfirmed claim, not a fact.

### 5. No persistence of any kind
Every workout, rep, form score, and AI response disappears on process restart. No history, no dashboard data source. See `DATABASE_REVIEW.md`.

### 6. No authentication or access control
All endpoints open (`API_REVIEW.md` §1). Combined with #2 above, any visitor can watch or interfere with another visitor's session, and combined with #7 below, anyone can trigger unmetered Groq spend.

### 7. ~~Unhandled Groq failures propagate as unhandled 500s~~ — Fixed 2026-08-07 (uncommitted)
`trigger_set_feedback()` in `main.py` now wraps both `ai.get_set_feedback(...)` and `ai.get_session_summary(...)` in independent try/except blocks, logs on failure, and falls back to a static message; set/session completion bookkeeping is no longer gated on Groq succeeding. See `ROADMAP.md` Phase 1.2.

## Medium

### 8. Insecure/unbounded upload handling
`upload_video()` (`main.py:190-198`) trusts the client-supplied filename's extension for the temp-file suffix, enforces no size limit, and does no content-type/MIME validation. See `docs/10` §3.7 and `API_REVIEW.md` §3.

### 9. No containerization or deployment configuration
No `Dockerfile`, `docker-compose.yml`, or `.dockerignore` despite `docs/09` mandating Docker for the Render target. See `docs/10` §3.8.

### 10. Regression coverage is incomplete, in two different ways
- `shoulder_press` has no local canonical video (`tools/regression_baseline.py:28`, `CANONICAL_VIDEOS["shoulder_press"] = None`) — zero regression coverage for one of six configured exercises.
- The `squat` and `lunge` baseline videos are short enough (192 and 418 frames respectively) that the committed baseline records `"reps": 0` for squat — the rep-*counting* state machine (not just the form-check computation) is effectively unverified by the committed baseline for at least squat. Anyone touching the up/down/rest state machine in `process_frame()` should be aware the regression suite may not catch a squat-specific rep-counting regression today.

### 11. Groq calls are unmetered and unauthenticated
`get_set_feedback()`/`get_session_summary()` are reachable from open, unauthenticated, unrate-limited endpoints. See `docs/10` §3.9 and `SECURITY_REVIEW.md`.

### 12. No health/readiness depth, and a near-tautological `/health` check
`/health` (`main.py:34-41`) checks only `gt.pose is not None`, which is true unconditionally after import. Doesn't check `GROQ_API_KEY` presence, camera availability, or exercise Pose's actual inference path. See `BACKEND_REVIEW.md` §5.

## Low

### 13. Two byte-identical legacy files
`beff.py` and `befgemgym_trainer.py` (721 lines each) are byte-identical to each other and predate `gym_trainer.py`'s current form-checking/scoring system by roughly a 900-line diff, per `CLAUDE.md`'s own note. Classified Legacy in `ARCHITECTURE_REVIEW.md` §4 — not deleted by this audit; removal requires explicit user confirmation.

### 14. Unused scratch/empty artifacts
`try.py` (17-line standalone webcam test script, not imported anywhere), `New folder/` (empty), `.agents/` (empty). Low-risk cleanup candidates, not touched by this audit.

### 15. Unused `assets/` directory
`assets/{demo,icons,logo,screenshots}` exists but is not mounted as static files or referenced by `main.py`/`templates/index.html`. Irrelevant until a landing page (Phase 9) exists to use it.

### 16. `.env.example` is empty
0 bytes. Doesn't document even the one secret (`GROQ_API_KEY`) the app currently requires, let alone the future `DATABASE_URL`/`JWT_SECRET`/etc. `docs/02` §20 and `CODEX.md` both mandate "a complete `.env.example` file must be maintained." See `DOCUMENTATION_GAP_ANALYSIS.md`.

### 17. Dead import
`main.py:3` imports `BackgroundTasks` from FastAPI but never uses it anywhere in the file.

### 18. `README.md` is a heading-only stub
19 lines, 8 headings ("Overview", "Features", "Tech Stack", etc.), zero body content under any of them. Fails `docs/09` §18's documentation requirement outright. See `DOCUMENTATION_GAP_ANALYSIS.md`.

## Informational

### 19. `gym_trainer.py` exceeds the file-size guideline, for a defensible reason
~1,099 lines against `docs/07`'s 500-line hard maximum. This is the single most regression-sensitive file in the repo; splitting it is legitimate future work but must be a pure structural move verified byte-for-byte against the regression baseline, never bundled with feature work. Not treated as urgent debt because the file's *internal* organization (config-driven, dispatcher-based, one metrics function per exercise) is already good — see `ARCHITECTURE_REVIEW.md` §4.

### 20. The `docs/01`-`09`/`CODEX.md` target architecture doesn't exist yet, by design
Not debt — this is the expected, currently-accurate state of an MVP prototype ahead of its planned build-out. Listed here only to distinguish it from genuine debt items above, per `docs/10` §3.12's own framing.
