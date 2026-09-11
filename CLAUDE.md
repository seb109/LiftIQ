
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo actually is right now

LiftIQ today is a **single-process Python prototype**: a FastAPI app (`main.py`) that streams webcam/uploaded video through a MediaPipe pose-estimation engine (`gym_trainer.py`), overlays rep counts and live form feedback with OpenCV, and calls Groq for natural-language coaching (`ai_trainer.py`). There is no database, no auth, no frontend framework, no Docker, and no Next.js — despite what `docs/` and `CODEX.md` describe as the target architecture.

`docs/01_PRODUCT_REQUIREMENTS.md` through `docs/09_DEPLOYMENT_AND_TESTING.md` and `CODEX.md` describe an **aspirational production SaaS** (FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL + JWT backend, Next.js + TypeScript + TailwindCSS + shadcn/ui frontend, Docker, Render/Vercel/Supabase deployment). None of that has been built yet — check `TASKS.md` for the current checklist state before assuming any phase is done. Do not treat the docs as a description of the current code; treat them as the spec for work not yet started.

## CODEX.md — mandatory operating rules

`CODEX.md` is a standing operating manual for AI agents working in this repo. Key rules that actually bind day-to-day work here:

- **Regression rule**: never modify `gym_trainer.py` (the CV/rep-counting engine) without first running the regression baseline tool (see below) before and after the change. Behavior must not silently change.
- **Implementation scope rule**: one phase of `docs/03_IMPLEMENTATION_PLAN.md` per session; don't start the next phase unless explicitly told to; don't build multiple major subsystems (auth, database, frontend, deployment, etc.) in one sitting.
- **No placeholders**: no TODO/FIXME, stub functions, mock implementations, or incomplete classes in generated code.
- **File cleanup rule**: never delete or move a file during analysis. Classify first (Active Production / Shared Utility / Experimental / Legacy / Backup / Unused), and only recommend removal with an explanation of why it's safe.
- Read the relevant `docs/0N_*.md` file before implementing the area it covers; if a doc conflicts with the actual repo, surface the conflict instead of silently picking one.

## Commands

**Regression baseline for the CV engine** (the only tooling with a committed dependency list, `requirements-regression.txt`):

```powershell
pip install -r requirements-regression.txt

# Verify current gym_trainer.py behavior against the committed baseline
python tools/regression_baseline.py --verify

# Only after a reviewed, intentional behavior change:
python tools/regression_baseline.py --write

# Scope to one exercise (useful for short-timeout runs):
python tools/regression_baseline.py --verify --exercise squat
```

This replays local canonical videos in `vids/` (gitignored, not committed — must exist locally) through `gym_trainer.process_frame()` and diffs rep counts, per-rep form scores, and correction-message counts against `tests/regression/baselines.json`. See `tests/regression/README.md`. Shoulder press currently has **no baseline video** (`CANONICAL_VIDEOS["shoulder_press"] = None` in `tools/regression_baseline.py`) — six-exercise regression coverage is incomplete until one is added.

**Running the app itself**: there is no committed `requirements.txt` for `main.py`/`ai_trainer.py`. The checked-in `.venv` only has the CV/regression stack (`mediapipe`, `opencv-*`, `numpy`) installed — `fastapi`, `uvicorn`, `groq`, `python-dotenv`, `jinja2`, and `python-multipart` are not present and must be installed manually before `main.py` will run. `.env` (gitignored) must supply `GROQ_API_KEY`.

There are no lint or unit-test commands configured beyond the regression harness above.

## Architecture of the current prototype

- **`main.py`** — FastAPI app. Serves `templates/index.html` (Jinja2) and exposes:
  - `POST /start_session`, `GET /stats`, `GET /get_set_feedback` — session lifecycle and polling.
  - `GET /webcam_feed`, `POST /upload_video` + `GET /uploaded_feed` — MJPEG streaming endpoints (`multipart/x-mixed-replace`) that pull frames through `gt.process_frame()`.
  - All state is held in module-level globals inside `gym_trainer` (`state`, `session`) — there is exactly one active workout at a time, process-wide. This is fine for the prototype but is a blocker for any multi-user/auth work in the roadmap.

- **`gym_trainer.py`** — the CV engine, and the thing the regression rule protects:
  - `EXERCISES` — per-exercise landmark triple + up/down angle thresholds that drive rep counting.
  - `FORM_CHECKS` — per-exercise form-quality thresholds (e.g. knee cave, torso lean) with pass/fail messages; the *measurement* logic lives in the `_compute_form_metrics_<exercise>` functions, not in this config.
  - `_get_side_landmarks()` — always fetches all landmarks for one joint chain from the same body side (chosen by shoulder visibility); every form-metric function must use this instead of independent per-landmark lookups, or angles come out nonsensical.
  - `process_frame(frame)` — the main per-frame entrypoint: runs MediaPipe pose detection, smooths the primary rep angle, drives an up/down/rest state machine (rep counting + set completion + rest timer), computes form metrics/violations every frame, computes a 0–100 per-rep form score, and draws all HUD overlays directly onto the frame with OpenCV.
  - Adding a new exercise touches four places together: `EXERCISES`, `FORM_CHECKS`, a new `_compute_form_metrics_<exercise>` function, and its registration in `_METRIC_COMPUTERS`.

- **`ai_trainer.py`** — Groq (`llama-3.1-8b-instant`) integration. Only ever receives structured numeric metrics (depths, rep times, form scores) built from `gym_trainer` state — per `CODEX.md`'s AI rules, computer-vision logic must never move into the LLM and raw frames/images must never be sent to it. Two entrypoints: per-set feedback and end-of-session summary.

- **`tools/regression_baseline.py`** — offline harness that monkeypatches `gym_trainer.time.time` to a simulated clock so video replay is deterministic regardless of machine speed, then drives frames through `process_frame()` exactly like the live server does.

- **Legacy/duplicate files** (do not build on these — classify as Legacy/Backup per `CODEX.md`, keep unless explicitly told to remove): `beff.py` and `befgemgym_trainer.py` are byte-identical copies of each other and predate `gym_trainer.py`'s form-checking/scoring system (~900 lines of diff). `try.py` is a 17-line scratch file. `New folder/` is empty.

## Where the target architecture is defined

If asked to work on anything beyond the current CV prototype (auth, database, dashboard, reports, deployment), the authoritative specs are in `docs/`, read in this order for the relevant area:

- `docs/03_IMPLEMENTATION_PLAN.md` — phase sequence and acceptance criteria; check `TASKS.md` first to see which phase is actually next.
- `docs/02_ENGINEERING_SPEC.md` — target backend/frontend stack and architecture rules.
- `docs/04_API_SPEC.md`, `docs/05_DATABASE_SPEC.md`, `docs/06_AI_SPEC.md`, `docs/08_UI_UX_SPEC.md`, `docs/09_DEPLOYMENT_AND_TESTING.md` — contracts for API, schema, AI layering, UI/UX, and deployment/testing respectively, for when those phases are underway.
