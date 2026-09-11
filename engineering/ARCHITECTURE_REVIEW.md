# ARCHITECTURE_REVIEW.md

## 1. Actual architecture today

```
Browser (templates/index.html, vanilla JS)
        │  HTML page load, fetch() calls, <img src="/webcam_feed">
        ▼
FastAPI app (main.py, single file, 8 routes)
        │  direct function calls, no service/repository layers
        ├──► gym_trainer.py (module-level state + process_frame())
        │        │
        │        ▼
        │    MediaPipe Pose + OpenCV (in-process, synchronous, CPU-bound)
        │
        └──► ai_trainer.py (AsyncGroq client, free-text prompts)
                     │
                     ▼
                Groq API (llama-3.1-8b-instant)

No database. No auth layer. No message queue. No cache.
State lives entirely in gym_trainer.state / gym_trainer.session / main.uploaded_video_path.
```

## 2. Target architecture per `docs/02_ENGINEERING_SPEC.md`

```
Browser → Next.js (TypeScript, TanStack Query, Axios)
       → REST API (HTTPS, /api/v1)
       → FastAPI (Clean Architecture: API → Services → Repositories → DB)
       → PostgreSQL (SQLAlchemy 2 + Alembic)
       + MediaPipe/OpenCV/Groq behind the service layer
```

The gap between these two diagrams is the entire remaining scope of the project. This is expected and already correctly documented by `CLAUDE.md`; this review exists to make the gap precise, not to re-argue that it exists.

## 3. Structural comparison

| `docs/02` requirement | Present in repo? | Detail |
|---|---|---|
| `app/api/*.py` routers | No | All routes live directly in `main.py` |
| `app/auth/*` (jwt, hashing, dependencies) | No | — |
| `app/core/*` (config, logging, exceptions, constants) | Partial | Logging now configured directly in `main.py` (uncommitted `logging.basicConfig`); no centralized config or exception-handling module |
| `app/db/*` + `app/models/*` | No | — |
| `app/repositories/*` | No | — |
| `app/schemas/*` (Pydantic request/response models) | No | `main.py:52` takes a raw `dict` for `/start_session`, not a Pydantic model |
| `app/services/*` | No | `main.py` calls `gt.*`/`ai.*` functions directly |
| `posture/` package (explicitly meant to keep the existing engine intact) | No — but functionally equivalent | The existing engine lives at repo root as `gym_trainer.py` rather than inside a `posture/` package; functionally this *is* "the existing posture engine, preserved," just not relocated into the target folder layout yet |
| Dependency Injection via FastAPI `Depends` | No | Nothing uses `Depends` in `main.py` |

## 4. File classification (per `CODEX.md`'s File Cleanup Rule — classify only, no deletions recommended without explicit justification)

| File | Classification | Rationale |
|---|---|---|
| `main.py` | **Active Production File** | The only entry point; serves the running app |
| `gym_trainer.py` | **Active Production File** | Core CV/rep-counting/form-scoring engine; regression-protected |
| `ai_trainer.py` | **Active Production File** | Live Groq integration, called from `main.py` |
| `templates/index.html` | **Active Production File** | The only served frontend |
| `tools/regression_baseline.py` | **Shared Utility** | Offline harness used by the regression rule's workflow; not part of the served app but essential to safe change |
| `tests/regression/baselines.json`, `tests/regression/README.md` | **Shared Utility** | Regression ground truth + its documentation |
| `requirements.txt` | **Active Production File (new, uncommitted)** | Defines the running app's dependencies; not yet installed/verified |
| `requirements-regression.txt` | **Shared Utility** | Dependencies for the offline regression tool only |
| `CLAUDE.md`, `CODEX.md`, `docs/*.md`, `TASKS.md`, `README.md` | **Shared Utility** (documentation) | Governs how agents and humans work in this repo |
| `.env.example` | **Active Production File, but empty** | Should document `GROQ_API_KEY` at minimum; currently 0 bytes — see `DOCUMENTATION_GAP_ANALYSIS.md` |
| `assets/{demo,icons,logo,screenshots}` | **Experimental / not yet wired in** | Exists, not referenced by any served route or template; plausible future use for a landing page, currently dead weight |
| `beff.py` | **Legacy** | 721 lines, byte-identical to `befgemgym_trainer.py`, predates the current form-checking/scoring system per `CLAUDE.md`; superseded by `gym_trainer.py` |
| `befgemgym_trainer.py` | **Legacy** | Same file as `beff.py` (byte-identical); doubly redundant — two copies of the same superseded engine |
| `try.py` | **Experimental** | 17-line standalone webcam smoke-test script (`cv2.VideoCapture` + `imshow` loop); not imported by anything, not part of the app |
| `New folder/` | **Unused** | Empty directory |
| `.agents/` | **Unused** | Empty directory |
| `uvicorn_err.log`, `uvicorn_out.log` | **Backup / runtime artifact** | Local run logs from a previous manual `uvicorn` invocation; not meaningful as source, safe candidates for `.gitignore` addition (not deletion — see below) |

**On removal:** per `CODEX.md`'s rule, no file above is being deleted or moved by this analysis. `beff.py` and `befgemgym_trainer.py` are the strongest removal candidates — they are byte-identical to each other and represent a ~900-line-diff-old version of logic that `gym_trainer.py` has since fully superseded (per `CLAUDE.md`'s own note) — but removal requires explicit user confirmation, which this audit is not authorized to assume. `try.py`, `New folder/`, and `.agents/` are low-risk candidates for the same treatment. `uvicorn_err.log`/`uvicorn_out.log` are better handled by adding `*.log`-equivalent gitignore coverage (already present — `.gitignore` has `*.log`) and confirming they're genuinely untracked rather than deleted outright.

## 5. Architecture risk register

1. **No layering boundary exists yet to enforce `docs/02`'s API→Services→Repositories→DB rule** — when Phase 1 foundation work starts, the risk is routes growing business logic before the service layer exists to receive it. Mitigate by introducing the service layer *before* adding new routes, not after.
2. **`gym_trainer.py` at ~1,099 lines is more than double `docs/07`'s hard 500-line ceiling.** It is also the single most regression-sensitive file in the repo. Splitting it is legitimate future work but must be done as a pure move (no logic changes) verified line-for-line against the regression baseline before and after — not bundled with any feature work.
3. **The `posture/` package `docs/02` specifies doesn't exist**, meaning the eventual migration of `gym_trainer.py`/`ai_trainer.py` into the target `app/` layout is still fully pending. This is fine as long as it's tracked as explicit Phase 1 work (see `ROADMAP.md`) rather than assumed already done.
