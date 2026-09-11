# ROADMAP.md

This roadmap resolves the one open sequencing question left after `IMPLEMENTATION_PROGRESS.md`: `docs/03_IMPLEMENTATION_PLAN.md` and `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` are both real, both partially authoritative, and both agree explicitly (`docs/10` §6) that Track 1's hosting-blocker fixes must land *before* `docs/03`'s Phase 2 (Authentication) — because auth and deployment built on top of a single-camera, single-session architecture would just be broken in a new way. This document is the single merged sequence. Per `CODEX.md`'s Implementation Scope Rule, each phase below is scoped to one session's worth of work and should not be started until the previous phase's acceptance criteria are met and explicitly confirmed.

---

## Phase 1 — Critical Fixes & Hosting-Blocker Prerequisites
*(= `docs/10` Track 1, Phases 1-2)*

**Objectives:** Make the app installable and runnable as a real service; rework the video-capture pipeline so a workout can run from a browser on a different machine than the server.

**Dependencies:** None — this is the starting point.

**Tasks:**
- ✅ **1.1 — Done 2026-08-07.** Install and smoke-test `requirements.txt` into a clean environment; confirm `uvicorn main:app` boots and `/health` returns 200 (closes `TECH_DEBT.md` #4). `pip install -r requirements.txt` into existing `.venv` — clean, no conflicts. `uvicorn main:app` booted, `/health` → 200 (`mediapipe_pose_loaded: true`), `/version` → 200. No code changes required. See `CURRENT_STATUS.md` §2/§3 and `IMPLEMENTATION_PROGRESS.md` §3 for full detail.
- ✅ **1.2 — Done 2026-08-07.** Fix `main.py:103`'s unhandled Groq-failure propagation (closes `TECH_DEBT.md` #7). `trigger_set_feedback()` now catches `ai.get_set_feedback`/`ai.get_session_summary` failures independently, logs, falls back to a user-facing message; set/session completion bookkeeping runs regardless of Groq outcome. Verified via ad-hoc `TestClient` + mock (no pytest in `.venv`, no committed API test infra — see `IMPLEMENTATION_PROGRESS.md` §3). No automated regression test added; flagged as a scope decision, not silently skipped.
- ✅ **1.3 — Done 2026-08-07 (uncommitted), needs manual browser verification.** Replaced webcam-mode `<img src="/webcam_feed">` with browser-side `getUserMedia()` + `<canvas>` capture in `templates/index.html`; added `@app.websocket("/ws/webcam")` in `main.py` that decodes incoming JPEG frames and calls the **unmodified** `gym_trainer.process_frame()`, then streams the processed frame back. Old `/webcam_feed`/`webcam_stream()` left in place (superseded, not deleted). Regression baseline verified green (`gym_trainer.py` untouched); new WS route verified programmatically (synthetic-frame round trip via `TestClient`). **Not verified: actual browser `getUserMedia()` + live camera rendering** — no browser/camera in the implementing environment; needs a manual local run before this is trusted end-to-end. Upload-video mode (task 1.4) untouched by this change.
- ☐ **1.4** — Keep uploaded-video mode working through the same transport change where practical.

**Estimated complexity:** High — the capture-pipeline rework is a real transport-layer rewrite, not a config change.

**Risk:** Low for `gym_trainer.py` itself (untouched); high for `templates/index.html` and `main.py` (new code paths). Run `python tools/regression_baseline.py --verify` before and after per the regression rule — no change is expected in CV output, and any diff here is a signal the wiring, not the engine, broke something.

**Files affected:** `main.py`, `templates/index.html`, `requirements.txt` (verification only).

**Acceptance criteria:** A workout runs start-to-finish, with visible rep counting and form feedback, from a browser on a machine different from the server. `/health` returns 200 from a clean install. A Groq outage no longer produces an unhandled 500.

---

## Phase 2 — Architecture Stabilization
*(= `docs/10` Track 1, Phases 3-4)*

**Objectives:** Per-session state isolation; basic abuse/cost controls.

**Dependencies:** Phase 1 (the WebSocket/capture rework gives sessions a natural connection boundary to key state by).

**Tasks:**
- Replace `gym_trainer.state`/`session` and `main.uploaded_video_path` module-level globals with an in-memory, session-key-indexed store (no database required yet — see `SCALABILITY_REVIEW.md` §4).
- Update `tools/regression_baseline.py` in lockstep if the call shape into `gym_trainer` changes, so the harness keeps testing the code path the live app actually uses (see `SCALABILITY_REVIEW.md` §5's specific warning about this).
- Rate-limit `/get_set_feedback` and cap/validate `/upload_video` (size + content-type).

**Estimated complexity:** Medium-High — touches call sites throughout `gym_trainer.py`, must preserve exact single-session behavior for the regression harness.

**Risk:** Medium — this is the phase most likely to accidentally break regression coverage silently (harness testing the old path instead of the new one) if not done carefully; see `SCALABILITY_REVIEW.md` §5.

**Files affected:** `gym_trainer.py`, `main.py`, `tools/regression_baseline.py`.

**Acceptance criteria:** Two independent browser sessions can run separate workouts simultaneously with zero cross-talk. `python tools/regression_baseline.py --verify` passes and is confirmed to still be exercising the real per-session code path. A single visitor cannot trigger unbounded Groq spend or unbounded upload storage.

---

## Phase 3 — Backend Foundation
*(= `docs/03` Phase 1, informed by `docs/02` §11)*

**Objectives:** Introduce the `app/` layered structure (`api/`, `services/`, `repositories/`, `core/`, `schemas/`) without moving `gym_trainer.py`'s regression-protected logic in the same session as any behavior change.

**Dependencies:** Phase 2 (session isolation should exist before a service layer is built around it).

**Tasks:**
- Add Pydantic request/response models for existing routes (closes `API_REVIEW.md` §3's validation gaps — e.g. validate `exercise` against `gym_trainer.EXERCISES.keys()`).
- Introduce a thin service layer between routes and `gym_trainer`/`ai_trainer` calls, per `docs/07` §7-8's layering rules.
- Add centralized exception handling returning the `{"success", "data"/"error"}` envelope from `docs/02` §18.
- Resolve the `docs/06` AI-JSON-format and `docs/05` ExerciseMetric-schema documentation conflicts (`DOCUMENTATION_GAP_ANALYSIS.md` §2.1-2.2) as explicit written decisions before Phase 5/6 need them.

**Estimated complexity:** Medium.

**Risk:** Low — purely additive/structural if `gym_trainer.py`'s public functions aren't changed, only how `main.py` calls them.

**Files affected:** New `app/` tree; `main.py` becomes thin route definitions calling into it.

**Acceptance criteria:** Existing functionality unchanged (regression suite green); routes now validate input and return a consistent response envelope.

---

## Phase 4 — Authentication (external migration)
*(= `docs/03` Phase 2)*

**Objectives:** Land the authentication system to be migrated from the separate enterprise project referenced by the user.

**Dependencies:** Phase 2 (session isolation must exist first — see `AUTHENTICATION_REVIEW.md` §5 on why auth without isolation is a false sense of security) and Phase 3 (a service/DI layer to attach `Depends(get_current_user)` to).

**Tasks:** Not scoped in detail here per `AUTHENTICATION_REVIEW.md`'s explicit "inspect only" instruction — reconcile the incoming project's auth shape against `docs/02` §22/`docs/05` §8's JWT+refresh-token target before migrating, per `AUTHENTICATION_REVIEW.md` §4.2.

**Estimated complexity:** Medium (mostly integration, not novel design, if the source project's auth is mature).

**Risk:** Medium — the main risk is a shape mismatch (cookies vs. bearer tokens, different hashing library) discovered mid-migration rather than before it.

**Files affected:** New `app/auth/` package; every route gains an auth dependency.

**Acceptance criteria:** Per `docs/03` Phase 2 — users register, log in, receive tokens, protected routes reject unauthenticated requests, logout revokes refresh tokens.

---

## Phase 5 — Database
*(= `docs/03` Phase 3, `docs/05`)*

**Objectives:** Real persistence — `User`, `WorkoutSession`, `ExerciseMetric`, `AIReport`, `RefreshToken`.

**Dependencies:** Phase 3 (repository pattern scaffolding), Phase 4 (User model needs auth to populate it), and resolution of `DOCUMENTATION_GAP_ANALYSIS.md` §2.2/§2.3 (schema shape and transaction-atomicity conflicts) — do not write migrations before these are decided.

**Tasks:** SQLAlchemy 2 models, Alembic migrations, PostgreSQL connection, repositories per `docs/02` §15.

**Estimated complexity:** Medium.

**Risk:** Low technically; the real risk is schema churn if §2.2/§2.3's conflicts aren't resolved first and a fixed-column `ExerciseMetric` table has to be migrated to JSONB later.

**Files affected:** New `app/models/`, `app/db/`, `alembic/`.

**Acceptance criteria:** Per `docs/03` Phase 3 — migrations succeed, CRUD works, relationships validated.

---

## Phase 6 — Workout Session Persistence
*(= `docs/03` Phase 4)*

**Objectives:** Every workout survives a restart.

**Dependencies:** Phase 5.

**Tasks:** Wire the Phase-2 in-memory session store's completion event to write through to the Phase-5 repositories.

**Estimated complexity:** Low-Medium — the hard part (session boundaries) already exists from Phase 2.

**Risk:** Low.

**Acceptance criteria:** Per `docs/03` Phase 4 — every completed workout is permanently stored.

---

## Phase 7 — AI Report System Rework
*(= `docs/03` Phase 5, `docs/06`)*

**Objectives:** Close the free-text-vs-JSON conflict from `AI_REVIEW.md` §2/`DOCUMENTATION_GAP_ANALYSIS.md` §2.1 — whichever direction that decision goes, implement it with validation, retry, and fallback per `docs/06` §9/§13.

**Dependencies:** Phase 6 (need somewhere to persist the report), the §2.1 decision from Phase 3.

**Estimated complexity:** Medium — prompt rework plus JSON validation/retry/fallback plumbing.

**Risk:** Low to `gym_trainer.py` (untouched); the AI-output contract change itself should be treated with the same before/after rigor as a CV change, even though it isn't regression-harness-covered today.

**Acceptance criteria:** Per `docs/03` Phase 5 — every completed workout generates a report; malformed AI output is handled gracefully and never surfaces as a user-facing error.

---

## Phase 8 — Dashboard
*(= `docs/03` Phase 6)*

**Objectives:** Streak, weekly activity, history, AI recommendation widgets, per `docs/02` §27.

**Dependencies:** Phase 6 (needs persisted history to aggregate).

**Estimated complexity:** Medium.

**Risk:** Low.

**Acceptance criteria:** Per `docs/03` Phase 6 — dashboard updates automatically after workouts.

---

## Phase 9 — Workout Experience & UI/UX Modernization
*(= `docs/03` Phases 7 & 9, `docs/08`)*

**Objectives:** Resolve the frontend-rebuild decision `docs/10` §7 open decision #5 poses (Next.js rebuild vs. continued evolution of `templates/index.html`), then execute it — landing page, auth pages, polished workout/report/history/profile pages, full `docs/08` design-token compliance.

**Dependencies:** Phases 4-8 (needs auth, dashboard, and reports to have pages for).

**Estimated complexity:** High — effectively a full frontend rebuild if Next.js is chosen, per `FRONTEND_REVIEW.md` §5.

**Risk:** Low to backend/CV logic (frontend-only); high effort.

**Acceptance criteria:** Per `docs/03` Phase 9 and `docs/08` §30 — full design-system compliance, responsive, accessible, animated per spec.

---

## Phase 10 — Deployment
*(= `docs/03` Phases 10-12, `docs/09`, `docs/10` Track 1 Phases 5-6)*

**Objectives:** Docker, CI, Render/Vercel/Supabase, operational hardening (fail-fast startup checks, real `/health` depth), documentation completion (`README.md`, API docs, deployment guide).

**Dependencies:** All prior phases — this is the final phase by definition.

**Estimated complexity:** Medium.

**Risk:** Low technically; the risk is discovering a Phase 1-9 assumption doesn't hold under real infrastructure (e.g. the CPU-bound concurrency ceiling from `PERFORMANCE_REVIEW.md` turning out smaller than expected under the chosen instance size) — mitigate by running the load-test measurements `PERFORMANCE_REVIEW.md` §4 recommends before finalizing instance sizing, not after.

**Acceptance criteria:** Per `docs/09` §20 and `CODEX.md`'s MVP Completion Criteria — full checklist, all items satisfied, application publicly accessible end-to-end.

---

## Summary table

| Phase | Source plan | Complexity | Risk | Blocks |
|---|---|---|---|---|
| 1. Critical fixes | `docs/10` T1 P1-2 | High | Low (CV untouched) | Everything |
| 2. Architecture stabilization | `docs/10` T1 P3-4 | Med-High | Med (regression harness trap) | Phases 3-10 |
| 3. Backend foundation | `docs/03` P1 | Medium | Low | Phases 4-10 |
| 4. Authentication | `docs/03` P2 | Medium | Medium (shape mismatch) | Phases 5-10 |
| 5. Database | `docs/03` P3 | Medium | Low (if §2.2/2.3 resolved first) | Phases 6-10 |
| 6. Session persistence | `docs/03` P4 | Low-Med | Low | Phases 7-10 |
| 7. AI report rework | `docs/03` P5 | Medium | Low | Phase 8 (partial) |
| 8. Dashboard | `docs/03` P6 | Medium | Low | Phase 9 (partial) |
| 9. UI/UX modernization | `docs/03` P7/P9 | High | Low risk, high effort | Phase 10 |
| 10. Deployment | `docs/03` P10-12 | Medium | Low | — |

Per `CODEX.md`'s Implementation Scope Rule, treat each numbered phase above as its own session (or, where marked High complexity, its own multi-session milestone set) — do not begin the next phase until the current one's acceptance criteria are explicitly confirmed.
