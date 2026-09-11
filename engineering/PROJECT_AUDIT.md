# LiftIQ — Enterprise Engineering Audit

**Audit date:** 2026-08-07
**Method:** Full read of every file in `docs/`, `CODEX.md`, `CLAUDE.md`, `TASKS.md`, `README.md`, all Python source (`main.py`, `gym_trainer.py`, `ai_trainer.py`, `tools/regression_baseline.py`), `templates/index.html`, `tests/regression/`, dependency manifests, `.gitignore`, `.env.example`, git history/diff, and legacy files (`beff.py`, `befgemgym_trainer.py`, `try.py`). No code was modified to produce this audit.
**Companion documents:** this file summarizes findings; detailed findings live in the sibling documents listed at the bottom.

---

## 1. One-paragraph summary

LiftIQ today is a **single-process Python prototype**, not the SaaS described in `docs/`. One FastAPI file (`main.py`) serves one Jinja2/vanilla-JS page (`templates/index.html`) and streams either a server-side webcam or an uploaded video through a genuinely well-built computer-vision engine (`gym_trainer.py`) that does pose estimation, rep counting, and per-rep form scoring for six exercises, then calls Groq for free-text coaching (`ai_trainer.py`). There is no database, no auth, no frontend framework, no Docker, no CI, and no persistence of any kind — every workout vanishes when the process restarts. The `docs/01`–`docs/09` specs and `CODEX.md` describe a materially different, much larger target system (Next.js/TypeScript frontend, FastAPI+SQLAlchemy2+Alembic+PostgreSQL+JWT backend, Docker/Render/Vercel/Supabase deployment) that has not been started. Two newer documents, `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` and `docs/11_WEB_HOSTING_PROGRESS.md`, are the most accurate documents in the repository — they were written against direct code inspection rather than aspiration, and one concrete fix from that plan (a MediaPipe tracker state leak between sessions) is already implemented and regression-verified, sitting uncommitted in the working tree alongside a new `requirements.txt`, `/health` and `/version` endpoints, and structured logging.

## 2. Project maturity

| Dimension | Maturity | Evidence |
|---|---|---|
| Core CV/rep-counting engine | **Mature prototype, well-engineered** | `gym_trainer.py` — consistent side-selection helper (`_get_side_landmarks`), per-exercise config-driven thresholds, isolated form-metric functions, regression-tested |
| AI coaching integration | **Working prototype, spec-divergent** | `ai_trainer.py` — functional Groq calls, but free-text output where `docs/06` mandates structured JSON |
| Web serving layer | **Minimal prototype** | `main.py` — 8 routes, no auth, no versioning, no persistence |
| Frontend | **Functional single-page prototype** | `templates/index.html` — works end-to-end for one local user, no design system, no framework |
| Backend architecture (per `docs/02`) | **Not started** | no `app/` package, no services, no repositories, no DI |
| Database | **Not started** | no models, no ORM, no migrations, no PostgreSQL |
| Authentication | **Not started** | no auth code anywhere; explicitly deferred by the user to a future migration |
| Testing | **CV regression only** | `tools/regression_baseline.py` + `tests/regression/baselines.json`; no API/unit/integration tests |
| Deployment | **Not started; actively blocked** | no Docker, and the live-webcam feature cannot work on a remote host at all in its current form (see §3) |
| Documentation | **Inconsistent** | `docs/01-09`/`CODEX.md` describe unbuilt aspiration; `docs/10-11`/`CLAUDE.md` are accurate and current; `README.md` is a table of contents with no content |

## 3. The one finding that changes how every other phase should be read

`docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` §3.1 and §4 establish something that none of `docs/01`–`09` or `CODEX.md` anticipate: **`webcam_feed()` opens a camera on the server process itself** (`main.py:128`, `cv2.VideoCapture(0, cv2.CAP_DSHOW)`). On any host that isn't the visitor's own machine, camera index `0` doesn't exist or belongs to the wrong machine. This is not a scaling problem or a hardening gap — it is a correctness bug that makes the flagship live-webcam feature non-functional the moment the app is hosted anywhere but `localhost`. Every phase-ordering decision below (see `ROADMAP.md`) treats this, plus the closely related lack of per-session state isolation (§3.2 of the same document), as prerequisite work that has to land before `docs/03`'s own Phase 2 (Authentication), not as optional hardening alongside it.

## 4. Architecture quality

- **Strength:** `gym_trainer.py`'s internal design is genuinely clean for what it is — a single dispatcher (`_METRIC_COMPUTERS`) per exercise, a documented invariant (`_get_side_landmarks` — never mix left/right landmarks), config-driven thresholds (`EXERCISES`, `FORM_CHECKS`) separated from measurement logic, and a regression harness that already caught and fixed a real bug (MediaPipe tracker state leaking across sessions — see `docs/11` Session 1, now fixed in the uncommitted working tree via `_create_pose()`).
- **Weakness:** there is no layering anywhere else. `main.py` calls directly into `gym_trainer` module globals (`gt.state`, `gt.session`) and `ai_trainer` functions with no service layer, no repository layer, no dependency injection — a direct violation of `docs/02` §11's mandated `API → Services → Repositories → Database` flow, though this is expected for a prototype that hasn't reached that implementation phase yet.
- **Weakness:** all mutable state is module-level (`gym_trainer.state`, `gym_trainer.session`, `main.uploaded_video_path`). This is a single-process, single-workout application today; two simultaneous visitors will overwrite each other's session (`docs/10` §3.2).
- File size: `gym_trainer.py` is ~1,099 lines against `docs/07`'s 500-line hard maximum. This is protected, regression-tested logic — see `TECH_DEBT.md` for why splitting it is not a quick-win.

## 5. Code quality

- Naming, structure, and comments inside `gym_trainer.py` meet `docs/07`'s standard well (descriptive names, comments explain *why* not *what*, e.g. the `_get_side_landmarks` docstring).
- `main.py` and `ai_trainer.py` are short, readable, and now (uncommitted) have structured logging instead of silent `except: pass` swallowing.
- No formatting/lint tooling is configured anywhere (no `pyproject.toml`, `.flake8`, `.ruff.toml`) despite `docs/07` §16 mandating Black/Ruff/isort.
- No type hints on FastAPI route handlers' request bodies (`start_session(data: dict)` in `main.py:52` — a raw untyped `dict`, not a Pydantic model, contradicting `docs/02` §5's "Pydantic v2, avoid Any" principle). Expected at this stage; flagged for the Phase-2/3 rework.

## 6. Security posture (summary — full detail in `SECURITY_REVIEW.md`)

Every endpoint is open. There is no rate limiting on the Groq-calling endpoints, so a public deployment today is a direct path to unmetered API spend against `GROQ_API_KEY`. Upload handling has no size or content-type validation. No secrets are hardcoded or committed — `.env` is correctly gitignored — but `.env.example` is currently an empty file, violating the repo's own documented rule that a complete example must be maintained.

## 7. AI architecture (summary — full detail in `AI_REVIEW.md`)

The separation `CODEX.md` mandates (CV engine never touches the LLM, LLM never sees raw images, only structured metrics cross that boundary) is correctly implemented — `ai_trainer.py` only ever receives a plain dict of exercise/reps/depths/times. However, `docs/06_AI_SPEC.md` requires the LLM to return validated, versioned, retry-capable structured JSON; the actual implementation returns unvalidated free-text prose with no retry and no fallback, and a Groq failure today would propagate as an unhandled exception through `main.py`'s `/get_set_feedback` route rather than degrading gracefully as `docs/06` §13 and `docs/09` §17 require.

## 8. Backend / Frontend / Database / API — see dedicated reviews

Each of these areas has enough independent detail to warrant its own document: `BACKEND_REVIEW.md`, `FRONTEND_REVIEW.md`, `DATABASE_REVIEW.md`, `API_REVIEW.md`.

## 9. Testing

Only the CV engine is tested, and well: `tools/regression_baseline.py` replays six exercises (five with real videos; `shoulder_press` has no canonical video and is recorded as `missing_corpus`) through `process_frame()` with a monkeypatched deterministic clock and diffs rep counts, per-rep form scores, and correction-message counts against `tests/regression/baselines.json`. There are zero tests for `main.py`'s routes, `ai_trainer.py`, or any future backend/frontend layer, and no CI configuration exists to run even the regression suite automatically.

## 10. Deployment readiness

Not deployable today. See `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` (already comprehensive and code-verified) and this audit's `ROADMAP.md`, which sequences its Track 1 phases ahead of the database/auth work in `docs/03`.

## 11. Developer experience

- `CLAUDE.md` and `docs/10`/`docs/11` are, today, the most reliable onboarding material in the repo.
- `README.md` is a bare table of contents (8 headings, zero body content) — fails `docs/09` §18's documentation requirement outright.
- `requirements.txt` for the running app now exists (uncommitted) but per `docs/11`'s own log has not yet been installed into `.venv` or smoke-tested — the app's actual runnability from a clean checkout is currently unverified.

## 12. Technical debt

Ranked list in `TECH_DEBT.md`. Highlights: the webcam-capture blocker (§3 above), global shared state, synchronous blocking stream generators, two byte-identical 721-line legacy files (`beff.py`, `befgemgym_trainer.py`), an empty `.env.example`, and incomplete regression coverage (`shoulder_press` has no baseline video; the `squat` baseline video is too short to exercise the rep-counting state machine at all).

## 13. Document index

| Document | Covers |
|---|---|
| `CURRENT_STATUS.md` | Exact present-tense snapshot: what's committed, what's uncommitted, what runs |
| `IMPLEMENTATION_PROGRESS.md` | `TASKS.md` / `docs/03` / `docs/10` phase-by-phase status |
| `ARCHITECTURE_REVIEW.md` | Structural comparison, file classification table |
| `BACKEND_REVIEW.md` | Route-by-route backend inspection |
| `FRONTEND_REVIEW.md` | `templates/index.html` vs `docs/08` |
| `DATABASE_REVIEW.md` | Current (absent) persistence vs `docs/05` |
| `AI_REVIEW.md` | CV/AI layering and the JSON-schema conflict |
| `API_REVIEW.md` | Endpoint-by-endpoint contract table |
| `AUTHENTICATION_REVIEW.md` | Confirms zero auth exists; migration-readiness notes |
| `TECH_DEBT.md` | Ranked debt inventory |
| `SECURITY_REVIEW.md` | Threat-by-threat findings |
| `PERFORMANCE_REVIEW.md` | Concurrency ceiling analysis |
| `SCALABILITY_REVIEW.md` | Multi-tenancy blocker analysis |
| `DOCUMENTATION_GAP_ANALYSIS.md` | Doc-vs-doc and doc-vs-code gaps |
| `ROADMAP.md` | Phased plan, folding `docs/10` Track 1 ahead of `docs/03` Phase 2 |
