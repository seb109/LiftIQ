# Project Progress & Task Checklist

### Infrastructure Hardening: Local Docker + PostgreSQL Setup
- **Status:** 🔄 In Progress (pauses Milestone 6D)
- **Description:** Dockerized the full LiftIQ local development stack with a real PostgreSQL 16 database. Frontend locked to port 3001. Backend on 8000. PostgreSQL mapped to host port 5433 (5432 occupied by a separate local install). CORS updated to remove localhost:3000 references. WebSocket URL remains browser-resolvable via NEXT_PUBLIC_API_URL. Alembic migration workflow documented. Milestone 6C live workout must remain functional after Dockerization.
- **Changes:**
  - `requirements.txt`: Added `psycopg2-binary` (PostgreSQL driver) and `pydantic-settings`
  - `app/core/config.py`: Added `FRONTEND_URL`, `ENVIRONMENT`, `LOG_LEVEL` settings
  - `app/db/session.py`: SQLite fallback disabled when `APP_ENV=docker`
  - `main.py`: CORS now environment-driven via `settings.FRONTEND_URL`; removed `localhost:3000`
  - `frontend/package.json`: `dev` and `start` scripts locked to `-p 3001`
  - `frontend/next.config.ts`: Added `output: 'standalone'` for Docker builds
  - `frontend/src/components/workout/camera-permission-error.tsx`: Fixed `localhost:3000` → `localhost:3001`
  - `frontend/README.md`: Fixed `localhost:3000` → `localhost:3001`
  - `Dockerfile`: Backend image (Python 3.12-slim + system libs for MediaPipe/OpenCV)
  - `frontend/Dockerfile`: Multi-stage frontend image (deps → build → runner) on port 3001
  - `compose.yaml`: Three-service stack (postgres 5433:5432, backend 8000:8000, frontend 3001:3001)
  - `.dockerignore` / `frontend/.dockerignore`: Exclude secrets and build artifacts
  - `.env.example`: Full expansion with all required variables
  - `frontend/.env.example`: Added with NEXT_PUBLIC_API_URL
  - `.gitignore`: Added `*.db`, `compose.override.yaml`
  - `README.md`: Rewrote with Local Development with Docker section

- **Port Map:**
  | Service | Host Port | Docker Port |
  |---------|-----------|-------------|
  | Frontend | 3001 | 3001 |
  | Backend | 8000 | 8000 |
  | PostgreSQL | **5433** | 5432 |

- **Checklist:**
  ✅ Docker Compose (`compose.yaml`)
  ✅ PostgreSQL 16 container with named volume (`liftiq_pgdata`)
  ✅ Frontend permanently locked to port 3001
  ✅ Backend on port 8000
  ✅ Host port 5433 for PostgreSQL (avoids collision with host PG on 5432)
  ✅ PostgreSQL healthcheck (pg_isready, 10 retries)
  ✅ Backend depends_on postgres (condition: service_healthy)
  ✅ `NEXT_PUBLIC_API_URL=http://localhost:8000` (browser-accessible — not Docker hostname)
  ✅ WebSocket URL derived from NEXT_PUBLIC_API_URL (ws:// protocol replacement)
  ✅ CORS: localhost:3001 always allowed; FRONTEND_URL configures production origin
  ✅ Backend Dockerfile (Python 3.12-slim + MediaPipe/OpenCV system libs)
  ✅ Frontend Dockerfile (multi-stage, standalone output, PORT=3001)
  ✅ `.dockerignore` files prevent secrets and venvs from leaking into images
  ✅ `.env.example` expanded with all variables
  ✅ Alembic migration strategy: `docker compose run --rm backend alembic upgrade head`
  ✅ `APP_ENV=docker` disables SQLite fallback — PG failure is a hard error in Docker
  ✅ `docker compose down` preserves data volume
  ✅ `docker compose down -v` documented for intentional reset
  ✅ README.md updated with Docker quick-start
  ✅ Tests verified — npm test 22/22 PASS, pytest 37/37 PASS
  ✅ `npm run build` clean — TypeScript OK, standalone output generated
  ✅ Regression baseline verified — "Regression baselines match."
  ✅ Docker images built — liftiq-backend and liftiq-frontend
  ✅ Alembic upgrade head — 001_initial_schema applied to Docker PostgreSQL
  ✅ Schema verified — all 5 tables + alembic_version created in liftiq_db
  ✅ Backend PostgreSQL connection verified inside Docker network
  ✅ Port conflict documented — compose.override.yaml.example for remapping
  ✅ Git commit: `chore: dockerize liftiq with postgresql`

---

### Milestone 6C: Live Workout Experience
- **Status:** ✅ Complete
- **Description:** Implemented the full browser-based live workout experience connecting the existing MediaPipe/OpenCV CV engine to a polished frontend. Backend `/stats` endpoint extended with `form_violations` and `form_score` (additive). New frontend pages and hooks manage camera access (`getUserMedia`), WebSocket ping-pong frame streaming to `/ws/webcam`, stats polling at 800ms intervals, elapsed timer, exercise setup, live view with annotated camera canvas, form coaching bar, and post-session completion screen with real backend data.
- **Architecture:**
  - `main.py`: Extended `/stats` response with `form_violations` (live correction messages from CV engine) and `form_score` (current rep 0–100 score).
  - `src/lib/api.ts`: Added `WorkoutStats`, `StartSessionResponse`, `StopSessionResponse` interfaces and `startWorkoutSession`, `stopWorkoutSession`, `getWorkoutStats` API functions.
  - `src/lib/use-workout-session.ts`: Core hook encapsulating camera lifecycle (getUserMedia, track cleanup on unmount), WebSocket ping-pong frame loop, 800ms stats polling, elapsed timer, session start/stop API calls, pause/resume, and reconnect logic (3 attempts).
  - `src/components/workout/workout-setup.tsx`: Exercise selection (6 cards matching backend canonical IDs), reps/sets configuration, camera notice, and Start Workout CTA.
  - `src/components/workout/live-workout-view.tsx`: Camera-hero layout. Desktop: annotated canvas (left) + stats sidebar (right). Mobile: full-width camera with overlay quick-stats, coaching bar + controls in sticky bottom bar.
  - `src/components/workout/stats-panel.tsx`: Reps, set progress, animated SVG form-score ring (colour-coded: lime ≥80, amber ≥60, red <60), and duration timer.
  - `src/components/workout/coaching-bar.tsx`: Displays real CV `form_violations` with 1.2s debounce, falls back to rep feedback, then neutral state. Red highlight on violation.
  - `src/components/workout/connection-status.tsx`: Status pill (IDLE / CONNECTING / LIVE / PAUSED / RECONNECTING / STOPPING / COMPLETED / ERROR).
  - `src/components/workout/end-workout-dialog.tsx`: Confirmation dialog guarding accidental termination.
  - `src/components/workout/workout-complete-view.tsx`: Completion screen with real `total_reps`, `duration_seconds`, `average_form_score` from backend. Colour-coded form score. AI report notice.
  - `src/components/workout/camera-permission-error.tsx`: Camera denied/unavailable state with retry action.
  - `src/app/workout/page.tsx`: Protected route, orchestrates setup → live → complete state machine.
  - `src/app/page.tsx`: "Start Workout" CTA now navigates to `/workout` (replaces alert placeholder).
- **Tests Run & Results:**
  1. `npm test` → **PASS** (22 tests: 5 auth + 4 dashboard + 13 workout; all passed including exercise ID matching, API functions, hook constants, camera cleanup, ping-pong frame control, dialog safety, real backend field usage, and dashboard navigation).
  2. `npm run build` → **PASS** (TypeScript clean; `/workout` route appears in route table).
  3. `python -m pytest tests/ -v` → **PASS** (All backend tests passed).
  4. `python tools/regression_baseline.py --verify` → **PASS**.

---

### Milestone 6B: LiftIQ Authenticated Dashboard & Data Integration
- **Status:** ✅ Complete
- **Description:** Implemented the authenticated Dashboard landing page for LiftIQ using real backend data (`GET /api/v1/users/me`, `GET /api/v1/sessions`, and `GET /api/v1/reports`). Prioritized a polished, functional fitness dashboard using TanStack React Query for server state management, robust zero-state empty handling, and strict design language compliance (deep charcoal background `#09090B`, graphite surface `#18181B`, warm white primary typography, muted slate secondary text, and acid lime `#A3E635` accents). Zero fake or hardcoded mock statistics.
- **Dashboard Sections & Architecture:**
  - `src/lib/api.ts`: Added `WorkoutSessionItem` and `AIReportItem` interfaces along with `sessionsApi.getSessions(limit)` and `reportsApi.getReports(limit)` helper functions.
  - `src/lib/use-dashboard-data.ts`: Created reusable data transformation utilities and custom `@tanstack/react-query` hook. Aggregates completed sessions into:
    - **KPI Metrics**: Total Workouts (count of completed sessions), Total Reps (sum of completed session reps), Average Form Score (average of scored sessions formatted to 1 decimal place e.g. 88.3%), and Total Training Time (sum of session durations e.g. "45 min").
    - **Recent Workout**: Identifies the most recent completed workout with exercise, reps, form score badge, duration, date/time, or renders a clean onboarding empty state.
    - **Performance Trend**: Plots form score over recent completed workouts in chronological order (oldest to newest) using a lightweight, responsive SVG line chart with gradient fill, grid ticks, and interactive tooltips.
    - **Exercise Breakdown**: Frequency distribution and percentage progress bars per exercise type (`squat`, `pushup`, `bicep_curl`, `shoulder_press`, `lunge`, `deadlift`).
    - **Recent Activity**: Scannable table displaying recent workout history items with formatted names, timestamps, rep counts, form scores, and durations.
    - **AI Coaching Insight**: Displays latest real AI report (`coach_summary`, `next_session_focus`, `overall_score`, `motivation`) or an encouraging empty state.
  - Modular UI Components (`src/components/dashboard/`):
    - `dashboard-header.tsx`: Personalized time-based greeting ("Good morning, Joel" or "Good afternoon"), supporting subtext, and visually dominant "Start Workout" CTA.
    - `dashboard-stats.tsx`: KPI cards displaying real metrics.
    - `recent-workout.tsx`: Prominent session highlight or empty state.
    - `performance-chart.tsx`: Lightweight SVG form score trend chart with 0–100% grid lines and empty state handling.
    - `exercise-breakdown.tsx`: Exercise distribution bars.
    - `recent-activity.tsx`: Recent activity table.
    - `coach-insight.tsx`: Real AI report insight card.
    - `dashboard-skeleton.tsx`: Skeleton loading state.
  - Page & Routing (`src/app/page.tsx`): Authenticated landing page enclosed in `ProtectedRoute` and `AppShell`.
- **Tests Run & Results:**
  1. `npm test` (inside `frontend/`) $\rightarrow$ **PASS** (Ran both `tests/test_auth_ui.ts` and `tests/test_dashboard_ui.ts`; verified formatting helpers, KPI calculations, chronological trend sorting, zero-state empty safety, 9 component file exports, and zero hardcoded fake stats/secrets).
  2. `npm run build` (inside `frontend/`) $\rightarrow$ **PASS** (Next.js 16.3.5 webpack build completed with zero TypeScript errors or broken routes).
  3. `python -m pytest tests/` $\rightarrow$ **PASS** (All 37 backend tests passed across `test_ai_reports.py`, `test_auth.py`, `test_database.py`, `test_session_isolation.py`, `test_workout_lifecycle.py`).
  4. `python tools/regression_baseline.py --verify` $\rightarrow$ **PASS** ("Regression baselines match.")
- **Known Limitations:**
  - "Start Workout" CTA prompts a helpful toast/alert; live webcam workout studio and video processing pages will be integrated in Milestone 6C.
  - Full workout history pagination page and full AI report detail page remain planned for later dedicated milestones.

---

### Milestone 6A: Next.js Frontend Foundation + Authentication UI
- **Status:** ✅ Complete
- **Description:** Initialized the Next.js App Router frontend foundation using React 19, TypeScript, Tailwind CSS v4, and a restrained dark aesthetic. Implemented authentication pages (`/login` and `/register`), centralized Axios API client (`src/lib/api.ts`) with automatic Bearer token injection and refresh token rotation, React `AuthContext` state management, `ProtectedRoute` client guard, application shell foundation (`AppShell`), and a comprehensive frontend test runner (`tests/test_auth_ui.ts`).

---

### Milestone 5: Structured AI Workout Reports + PostgreSQL Persistence
- **Status:** ✅ Complete
- **Description:** Implemented structured post-workout AI coaching reports integrated with the existing Groq LLM client (`llama-3.1-8b-instant`), strict Pydantic schema validation, 1 retry attempt upon schema mismatch, deterministic safe metric-based fallback report (no medical claims or injury diagnoses), idempotent single-report persistence in PostgreSQL, and authenticated user report retrieval endpoints with user ownership enforcement.

---

### Milestone 4: Authenticated Workout Session Lifecycle + PostgreSQL Persistence
- **Status:** ✅ Complete
- **Description:** Integrated JWT user authentication with the workout lifecycle and PostgreSQL persistence layer. Protected workout endpoints (`POST /api/v1/sessions/start`, `POST /api/v1/sessions/{id}/metrics`, `POST /api/v1/sessions/{id}/stop`, `GET /api/v1/sessions/{id}`, `GET /api/v1/sessions`), enforced user session ownership (`404 Not Found` for unowned sessions), persisted session metadata and set-by-set exercise metrics, and maintained full backward compatibility with legacy unauthenticated routes (`/start_session`, `/stats`, `/end_session`).

---

### Milestone 3: JWT Authentication + User System
- **Status:** ✅ Complete
- **Description:** Implemented production-appropriate MVP authentication system using FastAPI, bcrypt password hashing, short-lived JWT access tokens (15-min expiry), persistent hashed refresh tokens (7-day expiry, token rotation upon refresh), user registration/login/refresh/logout endpoints, and reusable `get_current_user` FastAPI dependency.

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
✅ Persistent Refresh Token revocation & logout (`POST /api/v1/auth/logout`)  
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

### Dashboard (Milestone 6B)

✅ Personalized Welcome Header with name & Start Workout CTA  
✅ Compact KPI Cards (Total Workouts, Total Reps, Average Form Score, Total Training Time)  
✅ Most Recent Workout Highlight Card & Zero-State Onboarding Card  
✅ SVG Performance Trend Chart (Form score over time with chronological ordering)  
✅ Exercise Breakdown Distribution Bars (`squat`, `pushup`, `bicep_curl`, `shoulder_press`, `lunge`, `deadlift`)  
✅ Scannable Recent Activity Table  
✅ Real AI Coach's Insight Card  
✅ Loading Skeletons, Error Retry Banners & Zero-State Empty Cards  
✅ Dashboard UI Test Suite (`frontend/tests/test_dashboard_ui.ts`)  

### Reports

✅ AI Structured Reports  
☐ PDF  

### Deployment

☐ Render  
☐ Vercel  
☐ Supabase  


✅ AI Structured Reports  
☐ PDF  

### Deployment

☐ Render  
☐ Vercel  
☐ Supabase  
