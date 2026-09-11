# STARTUP_SEQUENCE.md

## 1. What happens today, in actual execution order

Tracing `main.py`'s module-level statements and imports, in the order Python actually executes them:

1. **`main.py:1-10`** — imports execute: `logging`, `cv2`, FastAPI pieces, `gym_trainer as gt`, `ai_trainer as ai`, `tempfile`, `os`.
   - Importing `gym_trainer` (`gt`) triggers **all of `gym_trainer.py`'s module-level code**, including:
     - `mp_pose = mp.solutions.pose` / `mp_drawing = mp.solutions.drawing_utils` (`gym_trainer.py:11-12`)
     - `pose = _create_pose()` (`gym_trainer.py:27`) — **MediaPipe model loading happens here, at import time, unconditionally, with no error handling around it.** If this fails (e.g. missing model files), the entire app fails to start with an unhandled exception during import.
     - `EXERCISES`, `FORM_CHECKS`, `feedback_messages`, `state`, `session` dicts are all constructed (`gym_trainer.py:34-438`).
   - Importing `ai_trainer` (`ai`) triggers:
     - `load_dotenv()` (`ai_trainer.py:6`) — reads `.env` if present.
     - `client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))` (`ai_trainer.py:10`) — **constructs the Groq client unconditionally, even if `GROQ_API_KEY` is `None`.** This succeeds silently; the missing key is only discovered on the first actual API call.
2. **`main.py:12-16`** — `logging.basicConfig(...)` configures the root logger; module logger `logger` created. (Uncommitted addition — did not exist in the last commit.)
3. **`main.py:18`** — `VERSION = "0.1.0"` constant defined.
4. **`main.py:20`** — `app = FastAPI()` — app instance created with zero configuration (no title, no version metadata, no lifespan handler).
5. **`main.py:21`** — `Jinja2Templates(directory="templates")` — template loader initialized (reads the `templates/` directory lazily, not eagerly).
6. **`main.py:23`** — `uploaded_video_path = None` — global initialized.
7. **`main.py:27-208`** — route decorators register each endpoint with the `app` instance, in file order.
8. **Server start** (`uvicorn main:app`, not itself in the file) — ASGI server begins accepting connections. No FastAPI `lifespan`/`@app.on_event("startup")` hook exists, so nothing further happens between import completing and the server accepting its first request.

## 2. What's missing, relative to `docs/09_DEPLOYMENT_AND_TESTING.md` §16

`docs/09` §16 requires: "Startup should fail immediately if: Database unavailable / Required environment variables missing / Critical configuration invalid." **None of this exists today.** Specifically:

- No check that `GROQ_API_KEY` is set before the server starts accepting traffic — a misconfigured deployment will boot successfully and only fail on a user's first real request.
- No database connectivity check (no database exists yet, so not yet applicable, but this needs to be added the moment Phase 5 — Database — lands, not retrofitted later).
- No validation that MediaPipe's model actually loaded successfully beyond the implicit "import didn't crash" — `/health`'s check (`gt.pose is not None`, `main.py:36`) is evaluated per-request, not at startup, and is close to tautological as noted in `BACKEND_REVIEW.md` §5.

## 3. Target enterprise startup sequence

```
1. Load configuration
   - app/core/config.py: Pydantic Settings reads environment variables
   - FAIL FAST here if required vars missing (GROQ_API_KEY, DATABASE_URL,
     JWT_SECRET, JWT_REFRESH_SECRET) — raise a clear, specific error naming
     which variable is missing, not a generic crash
   ↓
2. Initialize logging
   - app/core/logging.py: structured logging configured BEFORE any other
     subsystem, so every subsequent step's failures are captured
   ↓
3. Initialize database connection pool
   - app/database/session.py: create the async engine, verify connectivity
     with a lightweight query (SELECT 1) — FAIL FAST if unreachable
   - Run/verify Alembic migrations are up to date (or fail startup if not —
     docs/09 §6: "Deployment must fail if migrations cannot be applied")
   ↓
4. Initialize FastAPI app
   - app/main.py: FastAPI(title=..., version=..., lifespan=lifespan_handler)
   - Unlike today, VERSION is passed into the constructor so /docs reflects it
   ↓
5. Register middleware
   - CORS (app/middleware/cors.py) — configured per environment, not wildcard
   - Rate limiting (app/middleware/rate_limit.py)
   - Request logging / correlation ID (app/middleware/request_logging.py)
   - Tenant context resolution (app/middleware/tenant_context.py)
   ↓
6. Register routers
   - Each app/api/v1/routers/*.py module's router included via app.include_router()
   - Ordered: health/version first (so monitoring works even if later steps
     have partial failures), then domain routers
   ↓
7. Initialize dependency providers
   - DB session factory, current-user resolver, current-tenant resolver
     wired into FastAPI's dependency_overrides / Depends() graph
   ↓
8. Initialize AI components
   - app/coaching/llm_client.py: construct the Groq client — but ONLY after
     step 1 confirmed GROQ_API_KEY exists, so this step cannot silently
     succeed with a broken client the way ai_trainer.py:10 does today
   - computer_vision/engine.py: construct the MediaPipe Pose instance —
     wrapped in explicit error handling (today's gym_trainer.py:27's
     unconditional, unguarded construction is the thing being replaced here)
   ↓
9. Run startup health self-check
   - Exercise pose.process() against a trivial dummy frame to confirm the
     model genuinely works, not just that the constructor didn't throw
   - This is what makes /health meaningful rather than tautological
     (closes TECH_DEBT.md #12)
   ↓
10. Begin accepting traffic
   ↓
[running]
   ↓
11. Shutdown lifecycle (NEW — nothing like this exists today)
   - FastAPI lifespan context manager's teardown phase:
     - Close database connection pool cleanly
     - Cancel any in-flight WebSocket sessions gracefully (notify connected
       clients rather than dropping them)
     - Flush any buffered logs/metrics
```

## 4. Migration note

Steps 1, 2, 4, 6 above are direct evolutions of what `main.py` already does (config loading, logging, FastAPI init, router registration) — low-risk, additive changes. Steps 3, 5, 7, 9, 11 are genuinely new. Step 8 is the one that requires care: it's moving *existing, working* initialization code (`gym_trainer.py:27`'s `pose = _create_pose()`, `ai_trainer.py:10`'s Groq client construction) into a controlled startup sequence — this should be done as a pure relocation with added error handling, not a rewrite of what's being initialized, consistent with `MODULE_MIGRATION_MAP.md`'s "Preserve" decision for the CV engine.
