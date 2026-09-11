# CURRENT_STATUS.md

Present-tense snapshot of the repository as inspected on 2026-08-07. This is a factual state dump, not an evaluation — see `PROJECT_AUDIT.md` for judgment calls.

---

## 1. Git state

- **Branch:** `main`
- **Commits:** 2 total — `aa83966 chore: initialize LiftIQ repository`, `2f77320 feat: add regression baseline infrastructure`.
- **Uncommitted, tracked-file changes** (working tree vs `HEAD`):
  - `CODEX.md` — appended the "Implementation Scope Rule" section (one-phase-per-session rule).
  - `main.py` — added `logging.basicConfig` + module logger, `VERSION` constant, `GET /health`, `GET /version`, and error logging around webcam/video open failures.
  - `ai_trainer.py` — added a module logger and wrapped both Groq calls in `try/except Exception: logger.exception(...); raise`.
  - `gym_trainer.py` — added `_create_pose()` factory and a call to it inside `start_session()` (fixes a MediaPipe tracker state leak across sessions — see `docs/11` Session 1), plus `logger.exception(...)` calls in the two previously-silent `except Exception` blocks inside `process_frame()`.
  - `tests/regression/baselines.json` — `bicep_curl` and `lunge` correction-event counts updated (815/817 and 418/248 respectively) to match the order-independent output produced after the `_create_pose()` fix; reps and per-rep form scores unchanged for both.
- **New, untracked files:** `CLAUDE.md`, `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md`, `docs/11_WEB_HOSTING_PROGRESS.md`, `requirements.txt`.
- **Net effect:** the working tree already contains a complete, regression-verified fix for one real bug (pose-tracker state leak) plus groundwork (logging, health/version, requirements.txt) for `docs/10` Track 1 Phase 1. None of this is committed yet.

## 2. What runs today, and what doesn't

| Component | Runs? | Notes |
|---|---|---|
| `tools/regression_baseline.py --verify` | **Yes**, if `requirements-regression.txt` is installed and `vids/` exists locally | `vids/` is gitignored and not committed — must be supplied locally |
| `main.py` (`uvicorn main:app`) | **Yes — verified 2026-08-07** | `requirements.txt` installed into `.venv` clean, no conflicts. `uvicorn main:app` boots, `/health` → 200 (`mediapipe_pose_loaded: true`), `/version` → 200. See ROADMAP.md Phase 1.1. |
| Live webcam workout flow, hosted remotely | **No — architecturally cannot work** | `webcam_stream()` in `main.py:125-143` opens `cv2.VideoCapture(0, ...)` on the server process itself; there is no camera device `0` on a remote host, and even if there were it would be the server's camera, not the visitor's (`docs/10` §3.1) |
| Live webcam workout flow, run locally (`localhost`) | **Yes** | This is the only environment the current architecture supports |
| Uploaded-video workout flow | **Yes, single-user** | Works end-to-end locally; not per-session (see §4) |
| Groq set/session feedback | **Yes, if `GROQ_API_KEY` is set** | No fail-fast check at startup; a missing key surfaces only on first call |

## 3. Dependency manifests

| File | Covers | Committed? |
|---|---|---|
| `requirements-regression.txt` | `mediapipe==0.10.21`, `opencv-contrib-python==4.10.0.84`, `numpy==1.26.4` — offline CV regression tool only | Yes |
| `requirements.txt` | Same CV stack + `fastapi==0.115.6`, `uvicorn[standard]==0.34.0`, `python-multipart==0.0.20`, `jinja2==3.1.5`, `python-dotenv==1.0.1`, `groq==0.15.0` — the actual running app | **No — untracked** (installed into `.venv` and verified 2026-08-07, still not `git add`-ed) |

## 4. Global mutable state (the multi-tenancy blocker)

Three module-level containers hold all live application state, process-wide:

- `gym_trainer.state` (`gym_trainer.py:402-417`) — current rep counter, stage, feedback, form metrics/violations for the *one* active workout.
- `gym_trainer.session` (`gym_trainer.py:420-438`) — current set/rest/target-reps tracking for the *one* active session.
- `main.uploaded_video_path` (`main.py:23`) — the *one* currently uploaded video's temp path.

There is exactly one of each for the entire process. Two concurrent visitors will overwrite each other's workout and stomp each other's uploaded file (`docs/10` §3.2). Not yet fixed anywhere in the working tree.

## 5. Endpoints that exist right now

See `API_REVIEW.md` for the full contract table. Summary: `GET /`, `GET /health`, `GET /version`, `POST /start_session`, `GET /stats`, `GET /get_set_feedback`, `GET /webcam_feed`, `POST /upload_video`, `GET /uploaded_feed`. None are authenticated. None follow the `/api/v1` prefix or `{success, data}` response envelope `docs/04_API_SPEC.md` specifies.

## 6. Exercises supported and regression coverage

| Exercise | Rep-counting config | Form checks | Regression baseline |
|---|---|---|---|
| squat | ✅ | ✅ (forward_lean, knee_cave) | Recorded, but source video (`squat1.mp4`, 192 frames / 8s) is too short to complete a rep — baseline `reps: 0`; only depth-check corrections are exercised |
| pushup | ✅ | ✅ (hip_sag, elbow_flare) | Recorded, 6 reps, form scores captured |
| bicep_curl | ✅ | ✅ (elbow_flare, torso_sway) | Recorded, 5 reps |
| shoulder_press | ✅ | ✅ (lower_back_arch, wrist_alignment) | **Missing** — `CANONICAL_VIDEOS["shoulder_press"] = None` in `tools/regression_baseline.py:28`; no local video exists |
| lunge | ✅ | ✅ (forward_lean, knee_alignment) | Recorded, but baseline shows `reps: 0` (same short-clip issue as squat) |
| deadlift | ✅ | ✅ (back_rounding, bar_drift) | Recorded, 2 reps |

Six exercises are *configured*; only three (`pushup`, `bicep_curl`, `deadlift`) have a baseline that actually exercises the rep-completion state machine end-to-end.

## 7. File inventory (top-level, excluding `.venv`/`.git`/`__pycache__`)

See `ARCHITECTURE_REVIEW.md` §2 for the full classification. Quick facts:
- `beff.py` and `befgemgym_trainer.py` — 721 lines each, byte-identical to each other, predate the current form-scoring system.
- `try.py` — 17 lines, a standalone webcam smoke-test script (`cv2.VideoCapture(0, cv2.CAP_DSHOW)` + `imshow` loop).
- `New folder/` and `.agents/` — both empty directories.
- `assets/{demo,icons,logo,screenshots}` — present, not mounted or referenced anywhere in `main.py` or `templates/index.html`.
- `.env.example` — exists, **0 bytes**.
- `README.md` — 19 lines, all headings, no body content.
- `TASKS.md` — only "Repository Analysis" is checked; everything else (Auth, Database, Dashboard, Reports, Deployment) is unchecked, consistent with the rest of this audit.

## 8. Environment / secrets

- `.env` is gitignored; `GROQ_API_KEY` is read via `python-dotenv` in `ai_trainer.py:6,10`.
- No secrets found hardcoded in any tracked file.
- `.env.example` documents nothing — not even the one secret the app actually uses today.
