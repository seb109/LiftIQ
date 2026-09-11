# LiftIQ Web Hosting Implementation Plan

**Version:** 1.0
**Status:** Draft — supersedes nothing, supplements `docs/03_IMPLEMENTATION_PLAN.md`
**Basis:** Direct inspection of the repository as of this document's creation (`main.py`, `gym_trainer.py`, `ai_trainer.py`, `templates/index.html`, `tools/regression_baseline.py`, `.venv`, `.gitignore`). No assumptions are carried over from `docs/01-09` or `CODEX.md` where they describe unbuilt functionality — those are called out explicitly as aspirational below.

---

# 1. Purpose

This document plans what it actually takes to put the current LiftIQ prototype online as a website that people other than the developer, on their own machines, can use. It is written against the code as it exists today, not the target SaaS architecture in `docs/02_ENGINEERING_SPEC.md`. Where the two diverge, that's flagged explicitly, because the divergence changes what "Phase 1" even means.

The short version: **the single biggest blocker isn't missing infrastructure (auth, database, Docker) — it's that the live-webcam feature is architecturally built to run on the same machine as the browser, and cannot work at all, for anyone, the moment the server is not the visitor's own computer.** Everything else (auth, persistence, deployment) is standard SaaS work; this one is a rewrite of the core interaction model.

---

# 2. Current state — verified facts

| Area | Fact | Source |
|---|---|---|
| Backend | Single FastAPI app, one file (`main.py`, 171 lines), no routers/services/repositories | `main.py` |
| Frontend | One Jinja2-rendered HTML file with inline `<style>` and inline `<script>`, no build step, no framework | `templates/index.html` |
| Live video capture | Browser does **not** call `getUserMedia`. It sets `<img src="/webcam_feed">`. The server opens the camera itself: `cv2.VideoCapture(0, cv2.CAP_DSHOW)` | `main.py:102` |
| State | All rep/session state lives in two module-level dicts in `gym_trainer.py` (`state`, `session`) and one module-level variable in `main.py` (`uploaded_video_path`). Process-wide, not per-user, not per-connection | `gym_trainer.py:390-426`, `main.py:14` |
| Streaming transport | MJPEG (`multipart/x-mixed-replace`) via a **synchronous** Python generator that calls `time.sleep()` per frame | `main.py:99-150` |
| Persistence | None. No database, no ORM, nothing survives a process restart | repo-wide |
| Auth | None. Every route is open | `main.py` |
| Dependency manifest for the app itself | Does not exist. Only `requirements-regression.txt` is committed, and it only lists `mediapipe`, `opencv-contrib-python`, `numpy` — the packages the *offline regression tool* needs | `requirements-regression.txt` |
| Installed environment | The committed `.venv` has the CV stack installed but **not** `fastapi`, `uvicorn`, `groq`, `python-dotenv`, `jinja2`, or `python-multipart` — `main.py` cannot currently run from this environment without manual installs | `.venv/Lib/site-packages` inspection |
| Secrets | `GROQ_API_KEY` read from `.env` via `python-dotenv`; `.env` is gitignored, `.env.example` is present but empty | `ai_trainer.py:1-7`, `.env.example` |
| Containerization | No `Dockerfile`, no `docker-compose.yml`, no `.dockerignore` | repo-wide |
| Static assets | `assets/` (logo, icons, screenshots, demo) exists but is not mounted or referenced by `main.py`/`templates/index.html` — currently unused by the running app | `assets/`, `main.py`, `templates/index.html` |
| Tests | Only `tools/regression_baseline.py` + `tests/regression/baselines.json`, which validates `gym_trainer.py`'s CV output against six canonical local videos (`vids/`, gitignored, not committed). No API tests, no frontend tests, no CI | `tests/regression/`, `.gitignore` |
| Uploaded-video mode | Works today for a single user on a single machine: file is written to a temp path, streamed back frame-by-frame at the source FPS, then deleted | `main.py:124-161` |
| Multi-exercise coverage | Six exercises configured (`squat`, `pushup`, `bicep_curl`, `shoulder_press`, `lunge`, `deadlift`); regression baseline is missing a video for `shoulder_press` | `gym_trainer.py:22-65`, `tools/regression_baseline.py:22-29` |
| Target architecture per `docs/` | Next.js + TypeScript frontend, FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL backend, JWT auth, Vercel/Render/Supabase deployment — **none of this exists in the repository today** | `docs/02_ENGINEERING_SPEC.md`, `docs/09_DEPLOYMENT_AND_TESTING.md` |

---

# 3. Shortcomings, ranked by severity

## 3.1 Blocker — live webcam capture cannot work on a remote host

`webcam_feed()` calls `cv2.VideoCapture(0, ...)` **on the server process**. Camera index `0` refers to a camera device physically attached to whatever machine is running `main.py`. When that machine is a remote host (a Render/Fly/EC2 instance), there is no camera device `0` — the call will fail outright (headless server, no video hardware), and even if it somehow succeeded, it would be reading the *server's* camera, not the visitor's. This is not a scaling or hardening problem, it's a correctness problem: **the live-webcam feature has no path to working for a remote visitor without a rewrite of the capture pipeline.** The upload-video mode is unaffected by this specific issue (the file comes over HTTP already), but shares every other blocker below.

## 3.2 Blocker — no multi-tenancy; one global session for the whole process

`gym_trainer.state`, `gym_trainer.session`, and `main.uploaded_video_path` are plain module-level dicts/variables. There is exactly one rep counter, one set tracker, one uploaded-file pointer for the entire running process. Two visitors hitting the site at the same time will silently overwrite each other's workout state and stomp each other's uploaded video. This must be fixed before the app can serve more than one person at a time, regardless of whether "hosting" ends up meaning one demo user or thousands.

## 3.3 High — synchronous, blocking streaming generators

`webcam_stream()` and `video_stream()` are regular (non-`async`) generator functions passed to `StreamingResponse`. Starlette runs non-async generators in its threadpool. Each active stream therefore occupies one worker thread for its entire lifetime, sleeping inside that thread via `time.sleep()` to pace playback. Concurrency is capped by the ASGI server's threadpool size, not by real async I/O, and MediaPipe pose inference is CPU-bound per frame — meaning realistic concurrent-user capacity per server instance is small and needs to be measured, not assumed.

## 3.4 High — no dependency manifest for the running application

`requirements-regression.txt` covers the offline CV regression tool only. There is no `requirements.txt` (or `pyproject.toml`) pinning `fastapi`, `uvicorn`, `groq`, `python-dotenv`, `jinja2`, `python-multipart`, or the CV stack for the *actual served app*. Nothing about how `main.py` is meant to be run in production is captured anywhere in the repo (no `Procfile`, no `uvicorn` invocation documented, no ASGI server/worker configuration).

## 3.5 High — no persistence

Every workout, rep, form score, and AI report disappears the moment the process restarts. There's no user history, no dashboard data source, nothing to build the reports/dashboard features on. Hosting the current app "as-is" gives visitors a stateless single-session demo, not a product.

## 3.6 High — no authentication or access control

All endpoints are open. Combined with §3.2 (shared global state), a public deployment today would let any visitor watch/interfere with whatever the last visitor was doing, and would let anyone trigger unmetered Groq API calls (§3.9) against your key.

## 3.7 Medium — insecure/unbounded file upload handling

`upload_video()` accepts any `UploadFile`, trusts the client-supplied filename's extension for the temp-file suffix, and enforces no size limit, no MIME/content validation, and no per-user scoping (see §3.2 — the path is a single global). A remote deployment needs upload size limits, content-type validation, and isolated per-session storage at minimum.

## 3.8 Medium — no containerization or deployment configuration

No `Dockerfile`, `docker-compose.yml`, or `.dockerignore`, despite `docs/09_DEPLOYMENT_AND_TESTING.md` mandating Docker for the Render target. MediaPipe/OpenCV have non-trivial native/system dependencies (codecs, BLAS, etc.) that make "just `pip install` on the host" fragile compared to a pinned container image.

## 3.9 Medium — Groq calls are unmetered and unauthenticated

`get_set_feedback()` and `get_session_summary()` are called from open, unauthenticated endpoints with no rate limiting. On a public URL, this is a direct path to uncontrolled API spend against `GROQ_API_KEY`, independent of any other feature completeness.

## 3.10 Medium — no health/readiness endpoint, no structured logging, no monitoring

`docs/09_DEPLOYMENT_AND_TESTING.md` calls for `GET /health` and `GET /version`; neither exists. There is no logging configuration — failures currently have no operational visibility beyond stdout/stderr from `print`/exceptions, and there's nothing distinguishing camera-open failures, MediaPipe failures, or Groq failures from each other.

## 3.11 Low — unused `assets/` directory and dead legacy files

`assets/` (logo, icons, screenshots) is committed but never served or referenced by the running app — fine for the repo, but irrelevant to hosting until/unless a real landing page is built. `beff.py` and `befgemgym_trainer.py` are legacy duplicates that must not be deployed or imported (see `CLAUDE.md`).

## 3.12 Informational — the `docs/` target architecture doesn't exist yet

`docs/02_ENGINEERING_SPEC.md` specifies Next.js/TypeScript/TailwindCSS/shadcn/ui for the frontend and SQLAlchemy 2/Alembic/PostgreSQL/JWT for the backend. Building "the website" could mean either (a) getting the *current* Jinja/vanilla-JS prototype online with the minimum fixes needed to function for real remote visitors, or (b) executing the full multi-phase rebuild described in `docs/03_IMPLEMENTATION_PLAN.md`. These are very different amounts of work and the plan below treats them as separate tracks (§5 vs §6).

---

# 4. The core architectural decision: how does video get from the visitor's camera to MediaPipe?

This has to be decided before any hosting work starts, because it determines what Phase 1 even is.

### Option A — Browser captures, streams frames to the existing Python engine (recommended)
The browser uses `getUserMedia()` to get the visitor's camera locally, draws frames to a `<canvas>`, encodes them (JPEG) on an interval, and sends them to the backend over a `WebSocket`. The backend decodes each frame with `cv2.imdecode` and feeds it into the **unmodified** `gym_trainer.process_frame()` — the same function the regression baseline already protects — then sends back either the annotated frame or just the computed metrics (reps, stage, form violations) for the browser to render.

- Preserves `gym_trainer.py` exactly as-is, satisfying `CODEX.md`'s regression rule and "preserve existing systems, extend don't replace" rule — the existing `tools/regression_baseline.py` harness continues to be valid with zero changes to what it tests.
- Changes are isolated to `main.py` (new WebSocket route, per-connection session state) and `templates/index.html` (real `getUserMedia`/canvas/WebSocket client code replacing the current `<img src="/webcam_feed">` approach).
- Uploaded-video mode needs the same per-connection isolation but keeps its current playback-loop shape.
- Cost: still CPU-bound server-side inference, so concurrent-user capacity per server instance is limited and must be load-tested; this is a real scaling ceiling, not a hypothetical one.

### Option B — Client-side pose estimation (MediaPipe Tasks / TF.js in the browser)
Run pose landmark detection in the browser itself; only send computed landmarks or metrics to the server, never video frames.

- Eliminates the server-side video pipeline and its CPU/concurrency ceiling entirely — this is how most production browser-based form-checking products are actually built, and it's the same "raw pixels stay local, only structured data crosses the wire" principle `CODEX.md` already mandates for the LLM boundary, extended one hop earlier.
- But: it requires **porting** `gym_trainer.py`'s rep-counting/form-check logic (angle thresholds, state machine, `FORM_CHECKS` config) to JavaScript/TypeScript. That is a rewrite of the regression-protected engine, not an extension of it — it directly conflicts with `CODEX.md`'s "do not replace the existing AI pipeline, extend it" instruction and would require a parallel JS regression harness, since `tools/regression_baseline.py` only exercises the Python engine.
- Larger effort, bigger architectural change, but the more scalable end state.

**Recommendation:** build Option A first to get a working, correctly-architected hosted product without touching the protected CV engine; treat Option B as a later, explicitly-scoped migration if/when concurrent-user load actually requires it. The rest of this plan assumes Option A.

---

# 5. Track 1 — Minimum path to a working hosted demo

Goal: get the *current feature set* (webcam or uploaded-video workout, live rep counting, form feedback, Groq set/session feedback) correctly running for real, independent, remote visitors — without building auth, a database, or a dashboard. This is the smallest change set that makes "host it as a website" actually true rather than superficially true.

## Phase 1 — Make the app installable and runnable as a service
- Add a real `requirements.txt` (or `pyproject.toml`) for `main.py`/`ai_trainer.py`/`gym_trainer.py`: `fastapi`, `uvicorn[standard]`, `groq`, `python-dotenv`, `jinja2`, `python-multipart`, plus the pinned versions already used for the CV stack in `requirements-regression.txt`.
- Add `GET /health` (per `docs/09`) that checks MediaPipe/model load succeeded, and `GET /version`.
- Replace ad-hoc `print`/silent exception handling with structured logging (module-level loggers; log camera/video open failures, MediaPipe exceptions already swallowed at `gym_trainer.py:939` and `:974`, Groq call failures).
- **Acceptance:** app starts from a clean `pip install -r requirements.txt`; `uvicorn main:app` serves `/health` returning 200.
- **Risk:** none of the CV logic changes; this phase is pure plumbing.

## Phase 2 — Rework the capture pipeline (Option A from §4)
- Replace `<img src="/webcam_feed">` with real browser-side `getUserMedia()` + `<video>`/`<canvas>` capture in `templates/index.html`'s script block.
- Add a WebSocket route in `main.py` that receives JPEG frames, decodes them, calls `gym_trainer.process_frame()`, and returns the annotated frame (or metrics-only, if bandwidth/latency testing favors that) to the browser.
- Keep uploaded-video mode, but move it off the global `uploaded_video_path`/MJPEG-generator shape and onto the same per-session model introduced in Phase 3.
- **Acceptance:** a workout can be run start-to-finish from a browser on a different machine than the server, with rep counting and form feedback visibly working.
- **Risk:** this is the highest-effort phase in this track — it's a real feature rewrite of the transport layer, not a config change. Frame rate/latency over the network needs empirical tuning (JPEG quality, send interval, backpressure if the server falls behind).
- **Regression:** none expected — `gym_trainer.process_frame()` itself is untouched; re-run `python tools/regression_baseline.py --verify` after this phase to confirm.

## Phase 3 — Per-session state isolation (no database required)
- Replace the module-level `gym_trainer.state`/`session` dicts with an in-memory, keyed store (e.g. a dict of session-id → state, keyed by a server-generated session/connection ID), so concurrent visitors don't collide. This can be a plain in-process dict for an MVP — no database needed yet, just no more shared globals.
- Scope uploaded-video temp files and the WebSocket connection to the same session key.
- **Acceptance:** two browser tabs/machines can run independent workouts simultaneously without cross-talk.
- **Risk:** this touches the call sites in `gym_trainer.py` that currently read/write the two globals directly — needs care to keep `process_frame()`'s regression-tested output identical for a single-session run (the offline regression tool exercises it exactly as a single global session today, so this refactor must preserve that call shape or the regression harness itself needs a matching update).

## Phase 4 — Basic abuse/cost controls
- Rate-limit `/get_set_feedback` and the session-summary trigger (per session key from Phase 3), and cap upload size/validate content-type in `upload_video()`.
- Move `GROQ_API_KEY` and any other secrets to the host's secret manager (not just `.env`) at deploy time.
- **Acceptance:** a single visitor cannot trigger unbounded Groq spend; oversized/invalid uploads are rejected with a clear error instead of silently accepted.

## Phase 5 — Containerize and deploy
- Add `Dockerfile` (pin Python version, install system deps MediaPipe/OpenCV need, copy app, run via `uvicorn`), `.dockerignore`.
- Pick a host that can run a long-lived WebSocket connection and has enough CPU per instance for MediaPipe inference (matters more than for a typical CRUD API) — evaluate against actual concurrent-session targets from Phase 2 load testing, not guessed.
- Configure environment variables/secrets, HTTPS (required for `getUserMedia` in browsers outside `localhost`), and CORS if the frontend and API ever end up on different origins.
- **Acceptance:** the containerized app is reachable over HTTPS from an outside network and a full workout flow (webcam or upload → live feedback → Groq set/session feedback) completes successfully from a non-developer machine.

## Phase 6 — Minimum operational hardening
- Add the missing `GET /health` failure modes (fail startup if `GROQ_API_KEY` missing, per the "startup should fail immediately" rule already specified in `docs/09_DEPLOYMENT_AND_TESTING.md`).
- Decide and implement a retry/fallback for Groq failures (also already specified, not yet implemented anywhere in `ai_trainer.py`, which has no error handling at all today).
- **Acceptance:** killing network access to Groq mid-session degrades gracefully (workout still completes) instead of the request hanging/erroring uncaught.

**What Track 1 deliberately excludes:** accounts/login, saved workout history across visits, a dashboard, PDF reports, a marketing/landing page. A visitor gets one anonymous session at a time, same as today, but it now actually works for people who aren't on the host machine and can't break each other's sessions.

---

# 6. Track 2 — The full SaaS in `docs/03_IMPLEMENTATION_PLAN.md`

If the goal is the product described in `docs/01_PRODUCT_REQUIREMENTS.md`/`docs/02_ENGINEERING_SPEC.md` (accounts, persistent history, dashboards, AI reports, premium UI), Track 1 above becomes prerequisite infrastructure underneath it, and the remaining phases are the ones already defined in `docs/03_IMPLEMENTATION_PLAN.md` (Authentication → Database → Workout Session persistence → AI Reports → Dashboard → Workout Experience polish → UI/UX polish → Testing → Deployment → Documentation). Per `CODEX.md`'s Implementation Scope Rule, each of those remains its own session/subsystem — this document does not re-derive them, since `docs/03` already specifies acceptance criteria for each. The one correction to make when picking that plan back up: its own Phase 1 ("Project Foundation") and the deployment phase implicitly assume the video-capture and multi-tenancy problems in §3.1/§3.2 above are already solved — they are not solvable by Alembic/Docker/JWT work alone, so Track 1 Phases 1-3 should be treated as inserted before `docs/03`'s Phase 2 (Authentication), not as optional.

Note also the frontend stack decision implied by `docs/02_ENGINEERING_SPEC.md` (Next.js/TypeScript) is a full rewrite of `templates/index.html`, not an extension of it — worth confirming as an explicit decision before Track 2 work starts, since it's a much larger commitment than Track 1's targeted rework of the same file.

---

# 7. Open decisions needed before implementation starts

1. **Track 1 only, or Track 1 as a stepping stone into Track 2?** Changes the scope of Phase 3's session model (throwaway in-memory dict vs. designed to later back onto real user accounts).
2. **Keep the current Python CV engine (Option A) or plan an eventual client-side rewrite (Option B)?** Affects how much investment goes into optimizing the server-side streaming path vs. treating it as a bridge.
3. **Hosting target and expected concurrent users** — determines instance sizing (CPU-bound MediaPipe inference is the real constraint, not typical web request volume) and whether a single-instance deployment is even sufficient.
4. **Groq cost tolerance for public/unauthenticated use** — determines whether Phase 4's rate limiting ships before or alongside first public availability.
5. **Frontend rebuild timing** — whether the current vanilla-JS UI ships as the public site (rebuilt for Phase 2's capture change but otherwise as-is) or whether a Next.js rebuild happens before any public launch.
