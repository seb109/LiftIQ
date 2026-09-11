# Project Progress & Task Checklist

### Milestone 6A: Next.js Frontend Foundation + Authentication UI
- **Status:** ✅ Complete
- **Description:** Initialized the Next.js App Router frontend foundation using React 19, TypeScript, Tailwind CSS v4, and a restrained dark aesthetic. Implemented authentication pages (`/login` and `/register`), centralized Axios API client (`src/lib/api.ts`) with automatic Bearer token injection and refresh token rotation, React `AuthContext` state management, `ProtectedRoute` client guard, application shell foundation (`AppShell`), and a comprehensive frontend test runner (`tests/test_auth_ui.ts`).
- **Frontend Architecture & Components:**
  - `src/lib/api.ts`: Centralized Axios HTTP client connecting to backend API (`NEXT_PUBLIC_API_URL`). Interceptors handle automatic JWT header injection and 401 refresh token rotation via `POST /api/v1/auth/refresh`.
  - `src/lib/auth-context.tsx`: Client-side AuthContext managing user session state (`loading`, `authenticated`, `unauthenticated`), bootstrap profile fetch (`/api/v1/users/me`), login, registration, and token invalidation on logout.
  - `src/lib/providers.tsx`: Top-level wrapper combining TanStack React Query (`QueryClientProvider`) and `AuthProvider`.
  - UI Primitives (`src/components/ui/`):
    - `Button`: Primary (electric lime), secondary, outline, ghost, danger variants with loading spinner support.
    - `Input`: Dark theme input with focus ring (lime-500), label, error message, and password toggle icon.
    - `Card`: Surface container (`#18181B`) with dark border (`#27272A`), title, description, body, and footer.
    - `Badge`: Metric & status pills (`lime`, `success`, `warning`, `error`, `neutral`).
    - `Logo`: Brand treatment for **LiftIQ** ("Intelligent Training Infrastructure").
    - `LoadingSpinner`: Accessible animated spinner.
  - Pages & Routing:
    - `/login`: Polished login form with email/password validation, loading spinner, error banner, and link to `/register`.
    - `/register`: Polished registration form with name/email validation, password complexity checklist, confirm password check, error banner, and link to `/login`.
    - `/`: Authenticated AppShell home layout protected by `ProtectedRoute`. Displays welcome greeting, user identity claims, token system status, and backend integration status.
- **Visual Design System:**
  - Primary Background: Deep Charcoal (`#09090B`)
  - Primary Surface: Dark Graphite (`#111827` / `#18181B`)
  - Accent Color: Controlled Electric/Acid Lime (`#A3E635` / `lime-400`), used strictly for primary CTA, active badges, and highlights.
  - Primary Text: Warm White (`#F8FAFC`)
  - Secondary Text: Muted Slate (`#94A3B8`)
- **Tests Run & Results:**
  1. `npm test` (inside `frontend/`) $\rightarrow$ **PASS** (All 5 frontend test suites passed in `tests/test_auth_ui.ts` covering API config, token storage, validation rules, 15 required file structures, and zero hardcoded secrets).
  2. `npm run build` (inside `frontend/`) $\rightarrow$ **PASS** (Next.js 16.3.5 webpack production build completed with zero TypeScript or linting errors).
  3. `python -m pytest tests/test_auth.py` $\rightarrow$ **PASS** (12/12 passed)
  4. `python -m pytest tests/test_database.py` $\rightarrow$ **PASS** (6/6 passed)
  5. `python -m pytest tests/test_workout_lifecycle.py` $\rightarrow$ **PASS** (8/8 passed)
  6. `python -m pytest tests/test_ai_reports.py` $\rightarrow$ **PASS** (8/8 passed)
  7. `python tests/test_session_isolation.py` $\rightarrow$ **PASS** (3/3 passed)
  8. `python tools/regression_baseline.py --verify` $\rightarrow$ **PASS** ("Regression baselines match.")
- **Known Limitations:**
  - Milestone 6A focuses exclusively on Next.js foundation & Auth UI. Interactive Dashboard, Webcam/Pose UI, Exercise Selector, History, and AI Report UI are planned for Milestone 6B.

---

### Milestone 5: Structured AI Workout Reports + PostgreSQL Persistence
- **Status:** ✅ Complete
- **Description:** Implemented structured post-workout AI coaching reports integrated with the existing Groq LLM client (`llama-3.1-8b-instant`), strict Pydantic schema validation, 1 retry attempt upon schema mismatch, deterministic safe metric-based fallback report (no medical claims or injury diagnoses), idempotent single-report persistence in PostgreSQL, and authenticated user report retrieval endpoints with user ownership enforcement.
- **AI Service Architecture & Contract:**
  - `build_compact_workout_input()`: Aggregates final completed workout metrics into a compact JSON schema (`exercise`, `total_reps`, `duration_seconds`, `average_form_score`, `completed_sets`). Raw webcam frames, video files, pose landmarks, JWT tokens, and passwords are strictly excluded.
  - `AIReportStructuredSchema`: Pydantic model enforcing `overall_score`, `form_score`, `strengths`, `mistakes`, `improvements`, `coach_summary`, `next_session_focus`, and `motivation`.
  - Validation & Retry Flow: Validates model response against `AIReportStructuredSchema`. If validation fails, retries exactly once with explicit formatting instructions. If the retry attempt fails or Groq API is unavailable, generates a deterministic, metric-based fallback report.
  - Idempotent Persistence (`generate_and_persist_ai_report`): Checks if an `AIReport` already exists for the workout session before creation. Persists exactly one report per workout session.
  - Async Completion Resilience: Report generation runs asynchronously *after* workout finalization transaction commits. External API failures or timeouts will not roll back a successfully completed workout session.
- **API Endpoints:**
  - `POST /api/v1/reports/generate`: Generates/retrieves AI report for an authenticated user's workout session.
  - `GET /api/v1/reports/{id}`: Retrieves specific AI report by ID with user ownership check (`404 Not Found` if user does not own session).
  - `GET /api/v1/reports`: Lists all AI reports owned by the authenticated user with optional pagination (`skip`, `limit`).
- **Files Created/Modified:**
  - Created `app/schemas/report.py`: `AIReportStructuredSchema`, `GenerateReportRequest`, `AIReportResponseData`, and `AIReportListResponse`.
  - Created `app/services/ai_service.py`: `build_compact_workout_input`, `generate_structured_ai_report`, `generate_fallback_report`, `format_report_markdown`, and `generate_and_persist_ai_report`.
  - Created `app/api/v1/endpoints/reports.py`: FastAPI router implementing `/reports/generate`, `/reports/{id}`, and `/reports`.
  - Created `tests/test_ai_reports.py`: Test suite verifying input construction, AI schema validation, 1 retry attempt, fallback generation, idempotency, ownership protection, and workout completion resilience.
  - Modified `app/repositories/ai_report_repository.py`: Added `get_by_id(report_id)` helper method.
  - Modified `app/schemas/__init__.py`: Exported report schemas.
  - Modified `app/api/v1/router.py`: Mounted `reports_router` at `/api/v1/reports`.
  - Modified `app/api/v1/endpoints/sessions.py`: Integrated `generate_and_persist_ai_report` call into `_process_end_session`.
  - Modified `TASKS.md`: Documented Milestone 5 completion details.
- **Tests Run & Results:**
  1. `python -m pytest tests/test_ai_reports.py` $\rightarrow$ **PASS** (8/8 tests passed in 8.50s)
  2. `python -m pytest tests/test_auth.py` $\rightarrow$ **PASS** (12/12 tests passed in 13.59s)
  3. `python -m pytest tests/test_database.py` $\rightarrow$ **PASS** (6/6 tests passed in 1.22s)
  4. `python -m pytest tests/test_workout_lifecycle.py` $\rightarrow$ **PASS** (8/8 tests passed in 18.41s)
  5. `python tests/test_session_isolation.py` $\rightarrow$ **PASS** (3/3 tests passed in 0.909s)
  6. `python tools/regression_baseline.py --verify` $\rightarrow$ **PASS** ("Regression baselines match.")
- **Known Limitations:**
  - Groq API calls are made post-workout; live frame-by-frame AI calls are omitted by design for latency and cost efficiency.
  - PDF report generation and Next.js frontend UI remain out of scope for Milestone 5 (planned for subsequent milestones).

---

### Milestone 4: Authenticated Workout Session Lifecycle + PostgreSQL Persistence
- **Status:** ✅ Complete
- **Description:** Integrated JWT user authentication with the workout lifecycle and PostgreSQL persistence layer. Protected workout endpoints (`POST /api/v1/sessions/start`, `POST /api/v1/sessions/{id}/metrics`, `POST /api/v1/sessions/{id}/stop`, `GET /api/v1/sessions/{id}`, `GET /api/v1/sessions`), enforced user session ownership (`404 Not Found` for unowned sessions), persisted session metadata and set-by-set exercise metrics, and maintained full backward compatibility with legacy unauthenticated routes (`/start_session`, `/stats`, `/end_session`).
- **Files Created/Modified:**
  - Created `app/schemas/session.py`: Pydantic schemas for starting sessions, recording set metrics, stopping sessions, returning session detail responses, and session listing responses.
  - Created `app/api/v1/endpoints/sessions.py`: Protected FastAPI endpoints for workout lifecycle operations (`/start`, `/{id}/metrics`, `/{id}/stop`, `/{id}`, `/`).
  - Created `tests/test_workout_lifecycle.py`: Test suite verifying start/record/stop lifecycle, PostgreSQL DB persistence, authenticated session ownership isolation, 404 on cross-user access, and legacy route compatibility.
  - Modified `app/repositories/workout_session_repository.py`: Added `get_by_id_and_user_id()`, `get_by_user_id()`, and `get_active_session_by_user_id()`.
  - Modified `app/api/v1/router.py`: Mounted `sessions_router` at `/api/v1/sessions`.
  - Modified `main.py`: Synchronized legacy `/start_session` and `/end_session` routes with isolated `WorkoutSessionState`.
- **Tests Run & Results:**
  1. `python -m pytest tests/test_workout_lifecycle.py` $\rightarrow$ **PASS** (8/8 tests passed in 18.41s)
  2. `python -m pytest tests/test_auth.py` $\rightarrow$ **PASS** (12/12 tests passed in 13.59s)
  3. `python -m pytest tests/test_database.py` $\rightarrow$ **PASS** (6/6 tests passed in 1.22s)
  4. `python tests/test_session_isolation.py` $\rightarrow$ **PASS** (3/3 tests passed in 0.909s)
  5. `python tools/regression_baseline.py --verify` $\rightarrow$ **PASS** ("Regression baselines match.")

---

### Milestone 3: JWT Authentication + User System
- **Status:** ✅ Complete
- **Description:** Implemented production-appropriate MVP authentication system using FastAPI, bcrypt password hashing, short-lived JWT access tokens (15-min expiry), persistent hashed refresh tokens (7-day expiry, token rotation upon refresh), user registration/login/refresh/logout endpoints, and reusable `get_current_user` FastAPI dependency.
- **Authentication Endpoints:**
  - `POST /api/v1/auth/register`: Validates email and strong password rules, checks duplicate emails, hashes password with bcrypt, and creates User record.
  - `POST /api/v1/auth/login`: Authenticates credentials against stored bcrypt hash, updates `last_login`, returns short-lived JWT access token and raw refresh token, and persists SHA-256 hash of refresh token.
  - `POST /api/v1/auth/refresh`: Validates refresh token hash, verifies expiry and revocation, revokes old refresh token (rotation), creates new refresh token, and returns new access + refresh tokens.
  - `POST /api/v1/auth/logout`: Revokes stored refresh token matching provided token hash.
  - `GET /api/v1/users/me`: Protected endpoint requiring `Authorization: Bearer <access_token>` returning user profile information.

---

### Milestone 2: PostgreSQL + SQLAlchemy 2.0 + Alembic Persistence Foundation
- **Status:** ✅ Complete
- **Description:** Built a clean persistence layer using SQLAlchemy 2.0, PostgreSQL DDL compatibility, Alembic migrations, and thin Repository pattern for database entities (`User`, `WorkoutSession`, `ExerciseMetric`, `AIReport`, `RefreshToken`).

---

### Per-Workout Session State Isolation
- **Status:** ✅ Complete
- **Description:** Refactored state management to isolate workout state, rep counters, form metrics, and MediaPipe Pose trackers per `session_id`. Multiple simultaneous workout sessions can now run without state collision or cross-talk.

---

## 📋 Task Checklist

### Phase 1A — Architecture & Stabilization

✅ Fix MediaPipe Pose tracker state leak (`_create_pose()`)  
✅ WebSockets camera streaming (`/ws/webcam`)  
✅ Health & Version endpoints (`/health`, `/version`)  
✅ Per-Workout Session State Isolation  
☐ Add shoulder-press video to complete six-exercise coverage  
☐ Verify baselines before each architecture change  

### Database & Persistence (Milestone 2)

✅ Core Models (User, WorkoutSession, ExerciseMetric, AIReport, RefreshToken)  
✅ SQLAlchemy 2.0 Engine & Base setup  
✅ Repository Layer (User, WorkoutSession, ExerciseMetric, AIReport, RefreshToken)  
✅ Alembic initial migration (`001_initial_schema.py`)  
✅ Database unit tests (`tests/test_database.py`)  

### Authentication & User System (Milestone 3)

✅ Register (`POST /api/v1/auth/register`)  
✅ Login (`POST /api/v1/auth/login`)  
✅ JWT Access Token issuance & verification  
✅ Persistent Refresh Token hashing & rotation (`POST /api/v1/auth/refresh`)  
✅ Refresh Token revocation & logout (`POST /api/v1/auth/logout`)  
✅ Protected Profile Endpoint (`GET /api/v1/users/me`)  
✅ Auth Unit Test Suite (`tests/test_auth.py`)  

### Workout Session Lifecycle (Milestone 4)

✅ Start session endpoint (`POST /api/v1/sessions/start`)  
✅ Record set metrics endpoint (`POST /api/v1/sessions/{id}/metrics`)  
✅ Stop session endpoint (`POST /api/v1/sessions/{id}/stop`)  
✅ Session retrieval endpoints (`GET /api/v1/sessions/{id}`, `GET /api/v1/sessions`)  
✅ Ownership isolation & 404 check for unauthorized access  
✅ Lifecycle Unit Test Suite (`tests/test_workout_lifecycle.py`)  

### Structured AI Workout Reports (Milestone 5)

✅ Structured workout input aggregation  
✅ Groq integration reuse (`llama-3.1-8b-instant`)  
✅ Structured output Pydantic schema validation (`AIReportStructuredSchema`)  
✅ 1 retry attempt on schema validation error  
✅ Safe metric-based deterministic fallback report  
✅ Idempotent AIReport persistence in PostgreSQL  
✅ Report retrieval endpoints (`POST /api/v1/reports/generate`, `GET /api/v1/reports/{id}`, `GET /api/v1/reports`)  
✅ Authenticated report ownership enforcement  
✅ AI Reports Unit Test Suite (`tests/test_ai_reports.py`)  

### Dashboard

☐ Cards  
☐ Charts  

### Reports

✅ AI Structured Reports  
☐ PDF  

### Deployment

☐ Render  
☐ Vercel  
☐ Supabase  
