# DEPENDENCY_GRAPH.md

## 1. Actual import/call graph today

```
main.py
  ├──imports──► gym_trainer (as gt)
  ├──imports──► ai_trainer (as ai)
  ├──imports──► cv2, fastapi, tempfile, os, logging
  │
  ├──calls────► gt.start_session()      [main.py:56]
  ├──calls────► gt.state, gt.session    [main.py:70-86, direct global read/write]
  ├──calls────► gt.process_frame()      [main.py:138, 173 — inside stream generators]
  ├──calls────► gt.reset_state()        [main.py:197]
  └──calls────► ai.get_set_feedback(), ai.get_session_summary()  [main.py:103, 116]

gym_trainer.py
  ├──imports──► cv2, mediapipe, numpy, time, random, logging
  └──NO import of ai_trainer, groq, or anything AI-related  ← the enforced boundary

ai_trainer.py
  ├──imports──► groq, dotenv, os, logging
  └──NO import of cv2, mediapipe, gym_trainer, or anything CV-related  ← the enforced boundary

tools/regression_baseline.py
  ├──imports──► gym_trainer (as trainer)   [sys.path manipulation to reach repo root]
  ├──calls────► trainer.start_session(), trainer.process_frame()
  └──monkeypatches trainer.time.time        [to make replay deterministic]

templates/index.html
  └──calls (via fetch/img src)──► /start_session, /stats, /get_set_feedback,
                                    /webcam_feed, /upload_video, /uploaded_feed
     (HTTP boundary, not a Python import — but a real coupling: the JS hardcodes
     these exact route paths and the exact JSON field names main.py's /stats
     returns, e.g. data.counter, data.is_resting, data.completed_sets)
```

## 2. Coupling analysis

### 2.1 Tight coupling: `main.py` ↔ `gym_trainer` module globals
`main.py`'s `/stats` handler (`main.py:60-86`) reads `gt.state["counter"]`, `gt.state["stage"]`, `gt.session["is_resting"]`, etc. — 15 distinct keys across two dicts, read by direct attribute-style access with no accessor layer in between. This is the tightest coupling in the codebase: any rename of a key inside `gym_trainer.state`/`session` breaks `main.py` silently (no type system catches it, since both are plain `dict`s). **Recommendation:** the Service Layer introduced in Phase 3 (`ROADMAP.md`) should be the only thing that reads these dicts directly; everything above it should go through typed accessor methods or Pydantic models.

### 2.2 Tight coupling: `templates/index.html` ↔ `main.py`'s exact response shape
The frontend JS destructures specific field names (`data.session_complete`, `data.completed_sets[].set_number`, `data.completed_sets[].reps_completed`, etc. — `templates/index.html:510-554`) with no schema contract enforcing that shape. This is an HTTP-boundary coupling, invisible to any Python type checker, and will need a versioned Pydantic response schema (per `docs/02` §18) before the frontend rebuild (Phase 9) can safely evolve independently of the backend.

### 2.3 No circular dependency risk found
`gym_trainer.py` and `ai_trainer.py` do not import each other, and neither imports `main.py`. `tools/regression_baseline.py` imports `gym_trainer` one-directionally. This is a genuinely clean acyclic graph today — worth explicitly preserving as new modules are added: the target `computer_vision/` and `coaching/` packages (`PACKAGE_RESTRUCTURE_PLAN.md`) must maintain this same zero-cross-import property, since it's the mechanism that makes the CV/AI boundary rule (`CODEX.md`) enforceable by more than convention (a linter rule forbidding `computer_vision/` from importing `coaching/` and vice versa would make this boundary structurally, not just socially, enforced).

### 2.4 Hidden dependency: `main.py`'s implicit ordering requirement
`/start_session` must be called before `/webcam_feed`/`/uploaded_feed` for the session to be in a sane state — this ordering constraint exists only in the frontend's call sequence (`templates/index.html:470-499` calls `/start_session` then sets `video-feed.src`) and is not enforced anywhere server-side. Calling `/webcam_feed` without a prior `/start_session` would process frames against whatever `gym_trainer.state`/`session` happen to currently hold (likely stale defaults) rather than being rejected. This is a hidden dependency the current architecture tolerates because there's only one global session to be in a wrong state — it becomes a real bug risk once Phase 2 (session isolation) introduces multiple concurrent, independently-keyed sessions, and should be made explicit (e.g. a session-not-found error) at that point.

### 2.5 Global mutable state (already covered in depth — cross-reference only)
`gym_trainer.state`, `gym_trainer.session`, `main.uploaded_video_path` — see `SCALABILITY_REVIEW.md` for full analysis. Listed here only to note it as the dependency graph's single largest structural liability: effectively every route in `main.py` has a hidden dependency on these three shared mutable objects, which is a form of coupling a static import graph doesn't show but is just as real.

### 2.6 Singleton usage
- `gym_trainer.pose` (`gym_trainer.py:27`, recreated per-session via `_create_pose()` at `gym_trainer.py:838-839`) — a **module-level singleton that gets replaced, not truly per-request**. This was the exact source of the cross-session tracking-state leak bug fixed in the uncommitted working tree (`docs/11` Session 1). Once Phase 2's session isolation lands, this needs to become one `Pose` instance *per session key*, not one global that gets swapped — otherwise concurrent sessions will contend for and corrupt each other's single `pose` object exactly the way sequential sessions used to.
- `ai_trainer.client` (`ai_trainer.py:10`) — a genuine, safe singleton (the Groq SDK client is stateless and thread/session-agnostic); no change needed here beyond moving its construction into the startup sequence (`STARTUP_SEQUENCE.md` step 8).

## 3. Recommended dependency boundaries going forward

```
api/  ──depends on──►  services/  ──depends on──►  repositories/  ──depends on──►  models/, database/
                              │
                              ├──depends on──►  computer_vision/   (one-directional, never the reverse)
                              └──depends on──►  coaching/          (one-directional, never the reverse)

computer_vision/  ──depends on──►  NOTHING in services/, coaching/, repositories/, or api/
coaching/         ──depends on──►  NOTHING in services/, computer_vision/, repositories/, or api/

organizations/, members/, staff/, billing/, attendance/
   ──depends on──►  repositories/, models/   (peer domain modules — should NOT import each other
                                               directly; cross-domain coordination belongs in services/)
```

The two rules worth enforcing with tooling (not just documentation) once the package restructure lands:
1. **`computer_vision/` and `coaching/` must never import each other or anything above them in the stack.** This is the one dependency rule that's also a compliance rule (`CODEX.md`'s AI Rules) — a lint rule (e.g. `import-linter` contract) catching an accidental cross-import here is worth setting up early, before the codebase grows enough for a violation to hide.
2. **New enterprise domain packages (`organizations/`, `members/`, etc.) must not import each other directly.** Cross-domain needs (e.g. "does this member belong to an org that has an active billing plan") belong in a service that depends on both repositories, not in one domain module importing another's internals — this is what keeps the eventual module count (a dozen-plus domains per `ENTERPRISE_MODULE_MAP.md`) from becoming a tangled graph instead of a star topology around `services/`.
