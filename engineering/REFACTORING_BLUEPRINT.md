# REFACTORING_BLUEPRINT.md

The implementation guide. One entry per major component. Ordered by `ROADMAP.md` phase, not by severity — this document is about *how* to change each thing safely, not re-ranking *whether* to.

---

## 1. Computer Vision Engine (`gym_trainer.py`)

**Current implementation:** ~1,099-line module with module-level state, config-driven per-exercise thresholds, dispatcher-based form-metric functions, regression-tested via `tools/regression_baseline.py`.

**Problems:** File exceeds `docs/07`'s 500-line ceiling; lives at repo root instead of a `computer_vision/` package; the one module-level singleton (`pose`) doesn't yet support per-session isolation (`DEPENDENCY_GRAPH.md` §2.6).

**Target implementation:** Same logic, split across `computer_vision/engine.py` (state machine + `process_frame()`), `computer_vision/exercises.py` (`EXERCISES`, `FORM_CHECKS` config), `computer_vision/metrics.py` (the six `_compute_form_metrics_*` functions) — a pure structural split, zero logic change. `pose` becomes per-session-keyed (one instance per active session, not one global that gets swapped).

**Migration strategy:**
1. Run `python tools/regression_baseline.py --verify` — confirm current green state.
2. Move code file-by-file (no line changes beyond import paths) into the new package structure.
3. Re-run `--verify` — must match exactly, byte-for-byte against `baselines.json`.
4. Only *after* the pure move is verified, in a **separate** change, introduce per-session `pose` instances (needed for Phase 2 anyway) and re-verify again.
5. Never combine steps 2 and 4 in one commit — `CODEX.md`'s regression rule requires isolating structural moves from behavior changes so a baseline mismatch has one possible cause, not two.

**Risk level:** Low for the move (mechanical); Medium for the per-session `pose` change (touches the exact code path that caused the cross-session leak bug already found once — `docs/11` Session 1).

**Estimated effort:** 0.5 day for the move; 1 day for per-session `pose`, including re-verification.

**Rollback strategy:** Each step is its own commit; reverting the per-session `pose` commit alone restores the single-global-`pose` behavior without touching the relocation. The relocation commit is reversible via `git revert` since it's a pure file move with no logic delta.

---

## 2. AI Coaching (`ai_trainer.py`)

**Current implementation:** Two functions, free-text prompts, Groq client constructed at import time, exceptions now (uncommitted) logged-and-reraised.

**Problems:** Output contract diverges from `docs/06_AI_SPEC.md`'s JSON schema (`AI_REVIEW.md` §2); no retry/fallback; no prompt versioning; `main.py:103`'s call site has no error handling around the reraise (`TECH_DEBT.md` #7).

**Target implementation:** `coaching/llm_client.py` (Groq wrapper, constructed at startup per `STARTUP_SEQUENCE.md` step 8) + `coaching/prompts.py` (versioned prompt templates) + `coaching/validators.py` (JSON parsing, schema validation, retry-once-then-fallback per `docs/06` §9/§13).

**Migration strategy:**
1. **First, independently, fix the immediate bug**: wrap `main.py`'s call sites in try/except with a static fallback message. This closes `TECH_DEBT.md` #7 with zero risk and zero dependency on the larger JSON-format decision — do this in Phase 1, not deferred to Phase 7.
2. Resolve the free-text-vs-JSON decision (`DOCUMENTATION_GAP_ANALYSIS.md` §2.1) as an explicit written choice before touching prompts.
3. If JSON is chosen: rewrite prompts to request the `docs/06` §8 schema, add `validators.py`, add retry-once logic, add a fallback report template used when both the original call and the retry fail.
4. Add prompt-version tagging (a simple string constant per prompt, stored alongside any future persisted `AIReport`).

**Risk level:** Low (doesn't touch `gym_trainer.py`); Medium for the JSON rewrite specifically, since it's a genuine behavior change to a working feature and has no regression harness protecting it today — recommend adding a small test suite (sample session dicts → assert valid JSON schema on response) *before* the rewrite, not after.

**Estimated effort:** 0.25 day for the immediate error-handling fix (step 1); 1.5-2 days for the full JSON rework (steps 2-4), most of it in prompt iteration and fallback-path testing.

**Rollback strategy:** Step 1 is trivially revertible (it's additive error handling). Steps 2-4 should ship behind a decision that's easy to reverse — e.g. keep the free-text prompts available as a fallback mode until the JSON version has run in production long enough to trust it.

---

## 3. Web Serving Layer (`main.py`)

**Current implementation:** 208-line single file, 8 routes, no layering, no DI, no versioned response envelope.

**Problems:** Full list in `BACKEND_REVIEW.md`; summarized — no service/repository layers, no Pydantic request models, no centralized error envelope, dead `BackgroundTasks` import.

**Target implementation:** Thin `app/main.py` (app construction + router registration only) + `app/api/v1/routers/*.py` + the full layered stack in `PACKAGE_RESTRUCTURE_PLAN.md`.

**Migration strategy:** This is the one component where incremental, in-place refactoring is safer than a rewrite-and-swap, because it's the integration point for everything else:
1. Add Pydantic models for existing request bodies (`/start_session`'s `dict` → a real schema) — no behavior change, just validation, closes `API_REVIEW.md` §3 gaps.
2. Introduce a thin `WorkoutService` that wraps the existing direct `gt.*` calls — routes call the service, the service calls `gym_trainer`/`ai_trainer` exactly as `main.py` does today. No logic changes, just an indirection layer inserted.
3. Split routes into per-domain router files, registered via `app.include_router()`.
4. Add the centralized exception handler + response envelope.
5. Only after 1-4 are stable, begin wiring in the repository layer as Phase 5/6 (Database) lands.

**Risk level:** Low — each step is additive/structural, verifiable by re-running the manual smoke tests in `docs/09` §12 after each step.

**Estimated effort:** 1-2 days for steps 1-4.

**Rollback strategy:** Each step is independently revertible; because no step changes `gym_trainer.py`/`ai_trainer.py`'s actual behavior, reverting any step restores exactly the prior HTTP-observable behavior.

---

## 4. Frontend (`templates/index.html`)

**Current implementation:** 596-line single file, vanilla JS/CSS, no framework, functional three-screen flow.

**Problems:** Total gap against `docs/08` (see `FRONTEND_REVIEW.md`); tightly coupled to `main.py`'s exact undocumented response shape (`DEPENDENCY_GRAPH.md` §2.2).

**Target implementation:** Next.js/TypeScript app per `docs/02` §12's folder structure and `docs/08`'s full design system.

**Migration strategy:** Rebuild, not incrementally evolve — `FRONTEND_REVIEW.md` §5 and `docs/10` §7 open decision #5 both already conclude this is a rewrite, not a migration. Recommended sequencing to avoid a big-bang cutover:
1. Build the new frontend against the *existing* API contract first (even the un-enveloped, unversioned one) — get feature parity with today's three screens.
2. Cut over the served frontend once parity is confirmed via manual smoke test (`docs/09` §12's checklist).
3. Only after cutover, adopt the new versioned API contract as it lands from Phase 3 onward — don't block the frontend rebuild on the backend layering work finishing first, since they're independent efforts once a stable-enough contract exists.

**Risk level:** Low to backend (frontend-only change); the risk is entirely in effort/scope, not in breaking existing systems.

**Estimated effort:** High — full rebuild, best estimated once the design system (`docs/08`) and target pages (dashboard, reports, history, profile, landing) are scoped in detail; not estimated further here since it's out of this blueprint's grounding in the current audit.

**Rollback strategy:** Keep `templates/index.html` and `main.py`'s `GET /` route intact and deployable until the Next.js frontend has run acceptance testing — a config flag or separate deployment target can let both coexist during the transition rather than an irreversible cutover.

---

## 5. Global State → Per-Session Isolation

**Current implementation:** `gym_trainer.state`/`session`, `main.uploaded_video_path` — module-level, process-wide.

**Problems:** The multi-tenancy blocker (`SCALABILITY_REVIEW.md`); the regression harness's coupling to this exact shape (`SCALABILITY_REVIEW.md` §5).

**Target implementation:** A session-key-indexed store (in-memory dict for Phase 2, backed by real persistence from Phase 6 onward).

**Migration strategy:**
1. Introduce a `SessionStore` abstraction (`{session_key: {state: ..., session: ...}}`) as a new module, without yet changing `gym_trainer.py`'s function signatures.
2. Change `gym_trainer.py`'s functions to accept a session-key parameter (or a state/session object) instead of reading module globals — this is the one genuinely risky step, since it touches the same functions the regression harness calls directly.
3. Update `tools/regression_baseline.py` in the same change (not a follow-up) to call through the new signature, per `SCALABILITY_REVIEW.md` §5's explicit warning about the harness silently testing the wrong path otherwise.
4. Verify regression baseline matches exactly before merging.

**Risk level:** Medium-High — this is the highest-risk *code* change in the entire blueprint, because it's the one place a structural refactor touches the regression-protected engine's function signatures, not just its surrounding plumbing.

**Estimated effort:** 1.5-2 days including harness updates and full regression re-verification.

**Rollback strategy:** Keep the single-global-session code path available behind a feature flag during initial rollout (e.g. `SESSION_MODE=global|isolated`), so a regression discovered post-deploy can be mitigated by flipping the flag rather than an emergency revert-and-redeploy.

---

## 6. Configuration & Secrets (`.env.example`, scattered `os.getenv()`)

**Current implementation:** `os.getenv("GROQ_API_KEY")` called directly inside `ai_trainer.py`; `.env.example` empty.

**Problems:** No startup validation (`STARTUP_SEQUENCE.md` §2); no typed settings object; incomplete documentation (`DOCUMENTATION_GAP_ANALYSIS.md` §3.2).

**Target implementation:** `app/core/config.py`'s Pydantic `Settings` class, populated `.env.example`.

**Migration strategy:** Purely additive — introduce `Settings`, have `ai_trainer.py` (and everything else) read from it instead of `os.getenv()` directly, populate `.env.example` in the same change since it's zero-risk documentation.

**Risk level:** Low.

**Estimated effort:** 0.5 day.

**Rollback strategy:** Trivial — revert the one commit; no other component depends on the new `Settings` object existing yet at this point in the sequence.

---

## 7. Authentication

Not detailed here — see `AUTH_MIGRATION_PLAN.md`, which covers this component's current/target/migration-strategy/risk breakdown in the depth its migration-from-elsewhere nature requires.

---

## Cross-cutting principle applied throughout this document

Every entry above follows the same shape deliberately: **separate the low-risk structural move from the higher-risk behavior change, and never ship them in the same commit.** This is the one repeatable technique that makes "preserve working systems while migrating to enterprise architecture" achievable in practice rather than just a stated goal — it's also exactly the discipline `docs/11`'s Session 1 log already demonstrated once, successfully, on the pose-tracker bug fix.
