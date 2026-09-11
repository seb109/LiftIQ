# MODULE_MIGRATION_MAP.md

Every significant file in the repository today, mapped to its future location and migration decision. Grounded in `ARCHITECTURE_REVIEW.md` §4's file classification and `TECH_DEBT.md`; this document adds the *destination* and *decision* those didn't need to make. Scope note: this map now targets the full enterprise Gym Management + AI Coaching platform (organizations/branches/staff/billing layered on top of the existing individual-coaching engine) — see `ADR_001_TARGET_ARCHITECTURE.md` for why that scope is wider than `docs/01`-`09` originally described.

**Decision legend:** Preserve (move/wrap without logic change) · Refactor (change internals, keep purpose) · Split (break into multiple modules) · Replace (build new, retire old) · Remove (delete, with justification) · Merge (combine with another module) · Create New (no current equivalent).

## 1. Backend

| Current Location | Current Responsibility | Future Location | Decision | Reason |
|---|---|---|---|---|
| `main.py` (208 lines, 8 routes) | Entire HTTP surface: page render, health/version, session lifecycle, streaming, upload | `app/api/routers/workouts.py`, `app/api/routers/health.py`, `app/main.py` (thin ASGI entrypoint only) | **Split** | Each route's concern belongs in a different router once the service layer exists (`BACKEND_REVIEW.md` §2-3); `main.py` itself should shrink to app construction + router registration only |
| `gym_trainer.py` (~1,099 lines) — CV engine: pose detection, rep counting, form scoring, HUD drawing | Preserved almost entirely, relocated | `app/computer_vision/engine.py` (or split — see §3 below) | **Preserve**, relocate only | `CODEX.md`'s Regression Rule and "preserve existing systems" principle apply directly; this file must move without a single logic change, verified byte-for-byte against `tests/regression/baselines.json` before and after the move |
| `ai_trainer.py` (87 lines) — Groq integration, free-text prompts | Prompt construction + Groq client calls | `app/coaching/llm_client.py` + `app/coaching/prompts.py` | **Refactor** | Logic is sound and CV/AI boundary is correctly enforced (`AI_REVIEW.md` §1), but the free-text-vs-JSON output contract needs to change per `DOCUMENTATION_GAP_ANALYSIS.md` §2.1 — this is a genuine behavior change, not a pure relocation, so it's Refactor not Preserve |
| `templates/index.html` (596 lines) — Jinja2 page + inline CSS/JS | Entire frontend | Next.js app (`frontend/src/app/`, `frontend/src/features/workout/`) | **Replace** | `FRONTEND_REVIEW.md` §5 confirms the gap against `docs/08` is total, not partial; this is a rebuild, not an evolution of the existing file |
| `tools/regression_baseline.py` | Offline CV regression harness | `tests/regression/harness.py` (or unchanged path — low priority to move) | **Preserve** | Working, well-designed; only needs updates in lockstep with Phase-2 session-isolation work per `SCALABILITY_REVIEW.md` §5, not a structural move |
| `tests/regression/baselines.json`, `tests/regression/README.md` | Regression ground truth + docs | Unchanged | **Preserve** | No reason to move |
| `requirements.txt` / `requirements-regression.txt` | Dependency manifests | `pyproject.toml` (single source, with optional dependency groups for CV/regression vs. web) | **Merge** | Two manifests for one app is a maintenance seam; a single `pyproject.toml` with extras (`[project.optional-dependencies]`) is the standard enterprise-Python pattern and removes the current split entirely |
| `.env.example` (empty) | Documents required env vars | `app/core/config.py` (Pydantic `Settings` class) + populated `.env.example` | **Refactor** | Needs actual content (`DOCUMENTATION_GAP_ANALYSIS.md` §5) and a typed settings object to replace the current bare `os.getenv()` calls scattered in `ai_trainer.py` |
| `beff.py` | Legacy duplicate CV engine (721 lines, byte-identical to `befgemgym_trainer.py`), superseded ~900 lines ago | — | **Remove** | Confirmed byte-identical duplicate of `befgemgym_trainer.py`, confirmed superseded by `gym_trainer.py` per `CLAUDE.md`'s own note; zero functional risk to remove since nothing imports it — **not removed by this document**, flagged for explicit user sign-off per the File Cleanup Rule |
| `befgemgym_trainer.py` | Same as above | — | **Remove** | Identical reasoning; removing both together avoids leaving one orphaned duplicate |
| `try.py` | 17-line standalone webcam smoke-test script | — | **Remove** | Not imported anywhere, superseded by the real app's webcam handling; low-risk removal candidate, still requires explicit sign-off |
| `New folder/` | Empty directory | — | **Remove** | Empty; no content to lose |
| `.agents/` | Empty directory | — | **Remove** | Empty; no content to lose |
| `uvicorn_err.log`, `uvicorn_out.log` | Local run logs | — | **Remove** | Runtime artifacts, not source; confirm `.gitignore` coverage rather than tracking removal as a source-code change |

## 2. Frontend / static

| Current Location | Current Responsibility | Future Location | Decision | Reason |
|---|---|---|---|---|
| `assets/logo/`, `assets/icons/` | Brand assets, currently unreferenced | `frontend/public/` | **Preserve**, relocate | Legitimate future use once a landing page/Next.js app exists (`ARCHITECTURE_REVIEW.md` §4); not currently wired to anything, so no logic risk in moving |
| `assets/screenshots/`, `assets/demo/` | Marketing/README assets, currently unreferenced | `docs/assets/` or `README.md` embeds | **Preserve**, relocate | Same reasoning; useful for the `DOCUMENTATION_GAP_ANALYSIS.md` §5 README fix |

## 3. New enterprise modules with no current equivalent

These have no corresponding row above because nothing like them exists yet. Full detail in `ENTERPRISE_MODULE_MAP.md`; listed here only to make the migration map complete.

| Future Location | Decision | Reason |
|---|---|---|
| `app/auth/` | **Create New** (via migration — see `AUTH_MIGRATION_PLAN.md`) | No auth code exists today |
| `app/organizations/`, `app/branches/` | **Create New** | Multi-tenant gym-management scope is new relative to `docs/01`-`09`'s individual-coaching target — see `ADR_001_TARGET_ARCHITECTURE.md` |
| `app/members/`, `app/staff/`, `app/roles/` | **Create New** | Same — no equivalent concept exists in the current single-user prototype |
| `app/billing/`, `app/payments/` | **Create New** | Explicitly out-of-scope for the MVP per `docs/01` §10 ("Payment integration... intentionally excluded"); now in scope for the enterprise target — flagged as a scope change, not silently assumed |
| `app/attendance/` | **Create New** | No equivalent |
| `app/workouts/` (persistence layer around the existing engine) | **Create New**, wraps Preserved `gym_trainer.py` | The engine itself is preserved; the session/persistence/repository layer around it doesn't exist yet |
| `app/analytics/`, `app/reports/` | **Create New** | Dashboard/reports don't exist yet (`IMPLEMENTATION_PROGRESS.md` §2) |
| `app/notifications/` | **Create New** | Explicitly out of MVP scope per `docs/01` §10; new for the enterprise target |
| `app/audit_logs/` | **Create New** | No equivalent; standard enterprise requirement, not previously specified in any `docs/0N` file |

## 4. Summary counts

| Decision | Count | Notable examples |
|---|---|---|
| Preserve | 5 | `gym_trainer.py`, `tools/regression_baseline.py`, baseline/docs files, brand assets |
| Refactor | 3 | `ai_trainer.py`, `.env.example`/config, dependency manifests |
| Split | 1 | `main.py` |
| Replace | 1 | `templates/index.html` |
| Remove (pending sign-off) | 6 | `beff.py`, `befgemgym_trainer.py`, `try.py`, `New folder/`, `.agents/`, log files |
| Create New | 9+ module groups | Auth, orgs/branches, members/staff/roles, billing/payments, attendance, workout persistence, analytics/reports, notifications, audit logs |

The headline number worth sitting with: **exactly one file (`gym_trainer.py`) is a pure Preserve-with-relocation of genuinely complex logic.** Nearly everything else in the eventual enterprise system is new construction. This matches `PROJECT_AUDIT.md`'s conclusion that the CV engine is the one mature asset in the repository — the migration blueprint should protect it accordingly (see `REFACTORING_BLUEPRINT.md` §1 for how).
