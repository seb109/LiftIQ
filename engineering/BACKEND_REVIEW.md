# BACKEND_REVIEW.md

## 1. Scope

Everything server-side that isn't the CV engine itself (covered in `AI_REVIEW.md` and `ARCHITECTURE_REVIEW.md`): `main.py`'s FastAPI app, its routing, request handling, and integration points.

## 2. Framework and setup

- FastAPI app instantiated with no configuration: `app = FastAPI()` (`main.py:20`) — no title/version metadata passed to the constructor (despite a `VERSION` constant existing at `main.py:18`, it's only used in the `/version` route, not passed to `FastAPI(version=...)`, so the auto-generated OpenAPI docs won't reflect it).
- Templates: `Jinja2Templates(directory="templates")` (`main.py:21`) — used for exactly one page (`GET /`).
- No `Depends`-based dependency injection anywhere, despite `docs/02` §17 and `CODEX.md`'s Architecture Rules mandating it for DB sessions, auth, repositories, services, and config.
- No middleware configured — no CORS, no request-ID/correlation-ID middleware, no rate limiting.

## 3. Route inventory (see `API_REVIEW.md` for the full contract-level table)

| Route | Method | Layer violations vs `docs/07` §7 ("routes must not query DB directly / contain business logic / call Groq directly / do heavy calculations") |
|---|---|---|
| `/` | GET | None — pure template render |
| `/health` | GET | None — trivial check |
| `/version` | GET | None |
| `/start_session` | POST | Calls `gt.start_session(...)` directly — no service layer, but also no business logic *in the route itself*; acceptable for a prototype, non-compliant once Phase 1 foundation lands |
| `/stats` | GET | Reads `gt.session`/`gt.state` globals directly; computes `rest_remaining` inline (`main.py:63-66`) — this is a small computation living in the route, a direct instance of the rule `docs/07` §7 prohibits |
| `/get_set_feedback` | GET | **Calls Groq directly** (`await ai.get_set_feedback(...)`, `main.py:103`) — exactly the pattern `docs/07` §7 forbids ("API routes must not... call Groq directly"). No service layer exists yet to absorb this, so it's a known, expected gap rather than a fresh regression |
| `/webcam_feed` | GET | Streaming generator opens camera hardware directly from the route module — architecture problem, not a layering nit (see `TECH_DEBT.md` #1) |
| `/upload_video` | POST | Writes to a global `uploaded_video_path`; no validation |
| `/uploaded_feed` | GET | Streams from the global path |

## 4. Error handling

- `main.py:64-66` imports `time` *inside* the `/stats` handler body rather than at module scope — works, but inconsistent with the module-level `import` convention used everywhere else in the file, and a minor readability smell rather than a functional bug.
- `/get_set_feedback` (`main.py:89-120`) has **no try/except around `await ai.get_set_feedback(...)` or `await ai.get_session_summary(...)`.** Since `ai_trainer.py`'s functions now (uncommitted) log-and-*reraise* on Groq failure, an actual Groq outage will propagate as an unhandled exception out of this route, producing a raw 500 with no graceful fallback — directly contradicting `docs/09_DEPLOYMENT_AND_TESTING.md` §17 ("If Groq fails: retry once, log failure, generate fallback report, complete workout normally") and `docs/06_AI_SPEC.md` §13 ("The workout session must never fail because the AI failed"). This is the single most concrete, ready-to-fix backend defect found in this audit — see `TECH_DEBT.md` #7 and `AI_REVIEW.md` §4.
- `webcam_stream()`/`video_stream()` (`main.py:125-187`) now (uncommitted) log camera/video open failures and stream-end conditions via `logger.error`/`logger.info` — a real improvement over the prior silent behavior noted in `docs/10` §3.10.
- No centralized exception handler (`@app.exception_handler`) exists to catch unhandled errors and return the `{"success": false, "error": {...}}` envelope `docs/02` §18 specifies. Every error today returns FastAPI's default JSON error body, not the documented contract.

## 5. Configuration

- No settings/config module (`app/core/config.py` per `docs/02`'s target layout does not exist). `VERSION` is a bare module constant in `main.py:18`.
- No environment-variable validation at startup. `docs/09` §16 requires the app to "fail fast if critical configuration is missing" (e.g., `GROQ_API_KEY`); today, a missing key is invisible until the first Groq call fails inside `ai_trainer.py`.
- `/health` (`main.py:34-41`) checks exactly one condition: `gt.pose is not None`. Since `gt.pose` is assigned unconditionally at import time via `_create_pose()` (`gym_trainer.py:27`) and that constructor call has no failure path exercised in normal operation, this check is close to a tautology — it will report `"ok"` even in states where the app is genuinely unhealthy (e.g., missing `GROQ_API_KEY`, unavailable camera hardware). A meaningful health check per `docs/09` §16 would also validate required environment variables and, ideally, exercise `pose.process()` against a trivial dummy frame.

## 6. Background tasks

`main.py:3` imports `BackgroundTasks` from FastAPI but **never uses it** — no route parameter or handler references `BackgroundTasks`. This is dead import, not a bug, but worth removing whenever the file is next touched (`docs/07` §17: "remove unused imports").

## 7. Summary

The backend is exactly as mature as a single-file FastAPI prototype should be at this stage — functional, readable, and honest about not yet having a service/repository/DI layer. The two findings worth acting on soonest are the missing Groq-failure handling in `/get_set_feedback` (a real availability bug, not just a layering nit) and the tautological `/health` check (undermines the "fail fast" observability goal `docs/09` sets).
