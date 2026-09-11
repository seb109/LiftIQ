# Web Hosting Implementation — Progress Log

Tracks execution of `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md`, one crucial problem per session, per `CODEX.md`'s scope rule. Each entry: what was found, what was fixed, verification evidence, next task.

---

## Session 1 (2026-07-27/28) — Fixed: cross-exercise state leak in the pose tracker

### What was supposed to happen this session

Plan said to start with Track 1 / Phase 1 (dependency manifest, `/health`, `/version`, structured logging — pure plumbing, zero CV-engine risk). Before touching anything, `python tools/regression_baseline.py --verify` was run as a pre-check per `CODEX.md`'s regression rule. It failed on a clean checkout, before any change was made.

### Issue found (not in `docs/10`, discovered during pre-check)

`gym_trainer.py` creates one module-level `mp_pose.Pose()` object at import time and never recreates it. MediaPipe's `Pose` keeps internal tracking state (its last-known region of interest) between calls. Because the server holds exactly one process-wide `pose` object (the same architecture problem `docs/10` §3.2 already flags for `state`/`session`), running one exercise and then starting a different one **in the same process, without a restart** carries tracking bias from the previous video/exercise into the new one's opening frames.

Evidence: `--verify --exercise pushup` alone passed; the full-suite `--verify` (squat → pushup → bicep_curl → lunge → deadlift in one process) failed on `pushup` — same source video (verified by SHA-256), same frame count, but a different last-rep form score (100 vs. baseline's 80) and 5 extra "tuck your elbows" correction events. This is a live bug today, not just a hosting-readiness gap: any real user who runs one exercise, then switches to another without restarting the server, gets rep/form-scoring output biased by whichever exercise ran before — silently, with no error.

### Fix

`gym_trainer.py`:
- Added `_create_pose()`, a small factory wrapping the existing `mp_pose.Pose(...)` constructor call.
- `start_session()` now calls `global pose; pose = _create_pose()` before resetting session/state — every new session (the natural boundary the app already has via `POST /start_session`, called before either the webcam or upload feed starts — confirmed in `templates/index.html`) gets a tracker with no memory of any prior video.

### Verification (regression rule followed: verify before, verify after)

- **Before fix:** full-suite `--verify` failed on `pushup` only.
- **Root-cause isolation:** recreating `pose` between `analyze_video("squat", ...)` and `analyze_video("pushup", ...)` in a throwaway script made the contaminated pushup run match the committed baseline exactly — confirms the tracker, not the rep-counting logic, was the source.
- **After fix, full-suite `--verify`:** `bicep_curl` and `lunge` newly mismatched (event counts off by 5–14, reps/form scores otherwise identical). Isolation testing showed these two exercises' fixed-code output was **already identical** whether run standalone or as part of the full sequence — i.e. the fix made all six exercises fully order-independent. The two mismatches were because the *committed baseline itself* had been recorded under the old, order-dependent, contaminated behavior (bicep_curl/lunge's baseline entries silently encoded whatever ran before them at baseline-recording time — not a reproducible ground truth).
- Per `CODEX.md`: "only after a reviewed, intentional behavior change: `python tools/regression_baseline.py --write`" — this is exactly that case. Re-recorded baselines for `bicep_curl` and `lunge` only (`--write --exercise bicep_curl`, `--write --exercise lunge`); `squat`, `pushup`, `deadlift`, `shoulder_press` baseline entries were untouched (they already reflected order-independent, uncontaminated output).
- Final `python tools/regression_baseline.py --verify` (full suite, no `--exercise` filter): **all baselines match.**

### Files changed

- `gym_trainer.py` — `_create_pose()` factory + reset call in `start_session()`. No rep-counting/form-check logic touched.
- `tests/regression/baselines.json` — `bicep_curl` and `lunge` correction-event counts updated to the new, order-independent ground truth (reps and form scores unchanged for both).
- `requirements.txt` — added (see below; unrelated to the fix, done as prep for Phase 1 next session).

### Next most crucial task

`docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` Track 1, **Phase 1 — Make the app installable and runnable as a service**:
- `requirements.txt` now exists at repo root (pins `fastapi`, `uvicorn[standard]`, `python-multipart`, `jinja2`, `python-dotenv`, `groq`, plus the CV stack already pinned in `requirements-regression.txt`) — not yet installed into `.venv` or smoke-tested.
- Still to do: `pip install -r requirements.txt` into `.venv` and confirm `main.py` actually boots; add `GET /health` (MediaPipe/model load check) and `GET /version`; replace the silent `except Exception: return frame, state` / `except Exception: state["form_metrics"] = {}; ...` swallows at the two try/excepts in `gym_trainer.py`'s `process_frame()`, plus `main.py`'s camera/video-open failures, and `ai_trainer.py`'s Groq calls, with structured logging (log-and-reraise/log-and-continue, no behavior change — verify against the now-green regression baseline before/after since two of the edits are inside `process_frame()`).
