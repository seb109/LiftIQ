# DOCUMENTATION_GAP_ANALYSIS.md

Two different kinds of gap exist in this repository's documentation, and they need different fixes: **doc-vs-code gaps** (a spec describes something unbuilt — expected, not a defect) and **doc-vs-doc gaps** (two documents disagree, or a document is simply missing content it claims to have — a real defect regardless of code state).

## 1. Doc-vs-code gaps (expected, tracked elsewhere)

`docs/01`–`09` and `CODEX.md` describe the target SaaS; the current repo is a prototype well short of that target. This is documented exhaustively elsewhere in this audit (`PROJECT_AUDIT.md`, `ARCHITECTURE_REVIEW.md`, `IMPLEMENTATION_PROGRESS.md`) and is not itself a documentation defect — `CLAUDE.md` already correctly frames `docs/01`-`09` as "the spec for work not yet started," and this audit's job was to verify that framing, not relitigate it. Nothing further to add here beyond what those documents already cover.

## 2. Doc-vs-doc conflicts — genuine defects, flagged per `CLAUDE.md`'s instruction to surface rather than silently resolve

### 2.1 AI output format: free text vs. structured JSON
`docs/06_AI_SPEC.md` §8 mandates strict JSON responses from the LLM. The actual, working implementation in `ai_trainer.py` produces free-text prose by design (the prompts explicitly ask for natural conversational language). This isn't a case of the doc describing unbuilt work — the AI integration *is* built and working, just to a different contract than `docs/06` specifies. See `AI_REVIEW.md` §2 for full detail. **Needs an explicit decision, not a silent pick, before Phase 5 (AI Report System) work begins.**

### 2.2 `ExerciseMetric`'s fixed-column schema vs. the CV engine's variable per-exercise metrics
`docs/05_DATABASE_SPEC.md` §6 specifies a fixed set of angle columns (`left_knee_angle`, `left_elbow_angle`, etc.) for all exercises. `gym_trainer.py`'s six `_compute_form_metrics_*` functions each produce a *different* set of named metrics per exercise (squat: `forward_lean`/`knee_cave`; deadlift: `back_rounding`/`bar_drift`; etc. — see `gym_trainer.py:550-716`). A literal implementation of `docs/05`'s fixed columns would leave most columns permanently null for most exercises and have no column at all for several real metrics (`hip_sag`, `elbow_flare`, `wrist_alignment`, etc.). See `DATABASE_REVIEW.md` §4 for the recommended reconciliation (a JSONB metrics column, consistent with the pattern `docs/05` §7 already uses elsewhere in the same document). **Needs resolution before Phase 3 (Database) schema work begins.**

### 2.3 Atomic workout completion vs. "AI failure must never fail the workout"
`docs/05_DATABASE_SPEC.md` §16 lists "Workout Completion" and "AI Report Generation" as operations that "must execute atomically." `docs/09_DEPLOYMENT_AND_TESTING.md` §17 and `docs/06_AI_SPEC.md` §13 both require that a Groq failure must not prevent the workout from completing normally. Taken literally, these two requirements conflict: if session completion and AI-report generation are one atomic transaction, an AI failure *would* roll back session completion. See `DATABASE_REVIEW.md` §4. **Needs resolution before Phase 3/5 work begins**, ideally by scoping the atomic transaction to session-completion-and-persistence only, with AI report generation as a separate, best-effort step that can fail independently.

## 3. Documents that are simply incomplete (not a doc-vs-doc conflict — just unfinished)

### 3.1 `README.md`
19 lines, 8 bare headings ("Overview", "Features", "Tech Stack", "Architecture", "Quick Start", "Documentation", "Deployment", "License"), zero body content under any of them. `docs/09_DEPLOYMENT_AND_TESTING.md` §18 requires the repository to include a README with an architecture overview, installation guide, deployment guide, and environment setup instructions — none of which currently exists anywhere in `README.md`. Notably, everything `README.md` *should* contain already exists in better, more accurate form elsewhere in the repo (`CLAUDE.md` for architecture/setup, `docs/10`/`docs/11` for deployment reality) — the gap here is that none of it is surfaced from the one file a new visitor is most likely to open first.

### 3.2 `.env.example`
0 bytes. `docs/02_ENGINEERING_SPEC.md` §20 and `CODEX.md` both explicitly require "a complete `.env.example` file must be maintained." The file doesn't document even the one environment variable the app currently, actually requires (`GROQ_API_KEY`, read in `ai_trainer.py:6,10`), let alone the future `DATABASE_URL`/`JWT_SECRET`/`JWT_REFRESH_SECRET`/`FRONTEND_URL`/`BACKEND_URL`/`ENVIRONMENT`/`LOG_LEVEL` variables `docs/02` §20 lists for the target system.

### 3.3 `tests/regression/README.md`
By contrast, this is a *good* example of complete, accurate, present-tense documentation — it correctly describes the regression tool's usage and explicitly flags the `shoulder_press` coverage gap (`tests/regression/README.md:25-27`). Noted here as a positive baseline for what the other documentation gaps above should look like once closed.

## 4. Which documents to actually trust right now

Ranked by reliability, based on this audit's direct code verification:

1. **`CLAUDE.md`** — accurate, current, correctly scoped to "what exists" vs. "what's aspirational."
2. **`docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` / `docs/11_WEB_HOSTING_PROGRESS.md`** — written against direct code inspection, and this audit's independent verification confirms every specific claim checked (file:line references, the pose-tracker bug fix, the regression re-baseline) is accurate as of this audit.
3. **`tests/regression/README.md`** — small, accurate, current.
4. **`docs/01`–`09` / `CODEX.md`** — internally consistent as a *target* spec, correctly labeled as aspirational by `CLAUDE.md`, but contains the doc-vs-doc conflicts in §2 above that need resolving before implementation reaches those phases.
5. **`TASKS.md`** — accurate as far as it goes, but doesn't capture `docs/10`'s hosting-blocker findings or the uncommitted Phase-1 progress already made.
6. **`README.md`** — least reliable; effectively no content.

## 5. Recommended immediate documentation fixes (no code risk, no regression exposure)

None of the following touch `gym_trainer.py` or require regression re-verification:
- Populate `.env.example` with at minimum `GROQ_API_KEY=` (matches what the app actually needs today).
- Write real content into `README.md`'s existing headings, sourced from `CLAUDE.md` (architecture/quick start) and `docs/10`/`docs/11` (deployment status) rather than drafted fresh.
- Resolve conflict §2.1 (AI JSON format) and §2.2 (ExerciseMetric schema) and §2.3 (atomic transaction scope) as explicit decisions recorded in the relevant `docs/0N` files themselves, before Phase 3/5 implementation begins.
