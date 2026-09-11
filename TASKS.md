# Project Progress & Task Checklist

## ✅ Completed Milestones

### Milestone 3: JWT Authentication + User System
- **Status:** ✅ Complete
- **Description:** Implemented production-appropriate MVP authentication system using FastAPI, bcrypt password hashing, short-lived JWT access tokens (15-min expiry), persistent hashed refresh tokens (7-day expiry, token rotation upon refresh), user registration/login/refresh/logout endpoints, and reusable `get_current_user` FastAPI dependency.
- **Authentication Endpoints:**
  - `POST /api/v1/auth/register`: Validates email and strong password rules, checks duplicate emails, hashes password with bcrypt, and creates User record.
  - `POST /api/v1/auth/login`: Authenticates credentials against stored bcrypt hash, updates `last_login`, returns short-lived JWT access token and raw refresh token, and persists SHA-256 hash of refresh token.
  - `POST /api/v1/auth/refresh`: Validates refresh token hash, verifies expiry and revocation, revokes old refresh token (rotation), creates new refresh token, and returns new access + refresh tokens.
  - `POST /api/v1/auth/logout`: Revokes stored refresh token matching provided token hash.
  - `GET /api/v1/users/me`: Protected endpoint requiring `Authorization: Bearer <access_token>` returning user profile information.
- **Files Created/Modified:**
  - Created `app/core/security.py`: Password hashing/verification using bcrypt (`passlib`), access token creation (`python-jose`), access token decoding, random refresh token generation, and SHA-256 refresh token hashing.
  - Created `app/schemas/auth.py`: Pydantic models for user registration (email/password validation), login, refresh token requests, user responses, token responses, and API envelope.
  - Created `app/schemas/__init__.py`: Package exports for Pydantic schemas.
  - Created `app/api/deps.py`: Reusable `get_current_user` FastAPI dependency extracting Bearer token from headers and verifying user identity.
  - Created `app/api/v1/endpoints/auth.py`: Auth router implementing `/register`, `/login`, `/refresh`, and `/logout`.
  - Created `app/api/v1/endpoints/users.py`: User router implementing protected `/users/me` endpoint.
  - Created `app/api/v1/router.py`: Aggregated v1 API router mounted at `/api/v1`.
  - Created `tests/test_auth.py`: Complete unit test suite verifying registration, duplicate email rejection, bcrypt password hashing, login, invalid password rejection, JWT claims, protected route dependency, expired/invalid tokens, refresh token rotation, old token invalidation, revoked token rejection, and logout token revocation.
  - Modified `app/core/config.py`: Added JWT `SECRET_KEY`, `ALGORITHM` (HS256), `ACCESS_TOKEN_EXPIRE_MINUTES` (15), and `REFRESH_TOKEN_EXPIRE_DAYS` (7) settings.
  - Modified `app/repositories/refresh_token_repository.py`: Added `get_by_hash()` and `revoke_by_hash()` helper methods.
  - Modified `main.py`: Mounted `api_v1_router` at `/api/v1`.
  - Modified `requirements.txt`: Added `python-jose[cryptography]`, `passlib[bcrypt]`, and `bcrypt`.
- **Tests Run & Results:**
  1. `python -m pytest tests/test_auth.py` $\rightarrow$ **PASS** (12/12 tests passed in 13.47s)
  2. `python -m pytest tests/test_database.py` $\rightarrow$ **PASS** (6/6 tests passed in 0.77s)
  3. `python tests/test_session_isolation.py` $\rightarrow$ **PASS** (3/3 tests passed in 0.834s)
  4. `python tools/regression_baseline.py --verify` $\rightarrow$ **PASS** ("Regression baselines match.")
- **Known Limitations:**
  - `get_current_user` dependency is created and tested on `/users/me`; workout endpoints are not yet restricted to authenticated users (planned for Milestone 4).

---

### Milestone 2: PostgreSQL + SQLAlchemy 2.0 + Alembic Persistence Foundation
- **Status:** ✅ Complete
- **Description:** Built a clean persistence layer using SQLAlchemy 2.0, PostgreSQL DDL compatibility, Alembic migrations, and thin Repository pattern for database entities (`User`, `WorkoutSession`, `ExerciseMetric`, `AIReport`, `RefreshToken`).
- **Files Created/Modified:**
  - Created `app/core/config.py`: Application settings using `pydantic-settings` to load environment variables including `DATABASE_URL`.
  - Created `app/db/session.py`: Database engine setup, `SessionLocal` thread-safe sessionmaker, and FastAPI `get_db()` dependency.
  - Created `app/models/base.py`: Centralized Declarative Base (`Base`).
  - Created `app/models/user.py`: `User` model with UUID PK, email, hashed password, timestamps, and relationships.
  - Created `app/models/workout_session.py`: `WorkoutSession` model with user FK, exercise type, reps, form score, duration, status, and timestamps.
  - Created `app/models/exercise_metric.py`: `ExerciseMetric` model with session FK, metric name, numerical value, and metadata JSON.
  - Created `app/models/ai_report.py`: `AIReport` model with session FK, report markdown, summary text, and metadata JSON.
  - Created `app/models/refresh_token.py`: `RefreshToken` model with user FK, token hash, expiration timestamp, and revocation flag (database model only).
  - Created `app/models/__init__.py`: Package exports for all models.
  - Created `app/repositories/base.py`: Base repository interface for CRUD operations.
  - Created `app/repositories/user.py`: UserRepository for user query operations.
  - Created `app/repositories/workout_session.py`: WorkoutSessionRepository for workout session persistence.
  - Created `app/repositories/exercise_metric.py`: ExerciseMetricRepository for per-exercise metric persistence.
  - Created `app/repositories/ai_report.py`: AIReportRepository for AI report persistence.
  - Created `app/repositories/refresh_token.py`: RefreshTokenRepository for refresh token persistence.
  - Created `app/repositories/__init__.py`: Package exports for repositories.
  - Configured `alembic.ini` & `alembic/env.py`: Pointed to `Base.metadata` and loaded `DATABASE_URL` from settings.
  - Created `alembic/versions/001_initial_schema.py`: Initial Alembic migration script containing standard `upgrade()` and `downgrade()` schema DDL for all 5 core tables.
  - Created `tests/test_database.py`: Focused database test suite testing imports, metadata registration, UUID primary keys, foreign keys, cascade deletes, and repository CRUD operations.
  - Updated `.env.example`: Safe example PostgreSQL connection URL.
- **Tests Run & Results:**
  1. `python -m pytest tests/test_database.py` $\rightarrow$ **PASS** (6/6 tests passed in 0.257s)
  2. `alembic upgrade head --sql` $\rightarrow$ **PASS** (Generated valid PostgreSQL DDL statements for all 5 tables and Alembic versioning table)
  3. `python tests/test_session_isolation.py` $\rightarrow$ **PASS** (3/3 tests passed in 0.970s)
  4. `python tools/regression_baseline.py --verify` $\rightarrow$ **PASS** ("Regression baselines match.")
- **PostgreSQL Availability & Limitations:**
  - Local PostgreSQL service (`postgresql-x64-18`) was running on port 5432, but default user credentials were not configured locally.
  - Used SQLite in-memory engine for fast, isolated ORM and repository unit tests (`tests/test_database.py`).
  - Generated and validated static PostgreSQL migration DDL via `alembic upgrade head --sql` to verify PostgreSQL dialect compatibility.
  - No authentication, token generation, UI dashboard, or API changes were introduced.

---

### Per-Workout Session State Isolation
- **Status:** ✅ Complete
- **Description:** Refactored state management to isolate workout state, rep counters, form metrics, and MediaPipe Pose trackers per `session_id`. Multiple simultaneous workout sessions can now run without state collision or cross-talk.
- **Files Changed:**
  - `gym_trainer.py`: Introduced `WorkoutSessionState`, in-memory `_sessions` registry, `get_session_state()`, `end_session()`, session TTL cleanup (30 min inactivity), and `_SessionDictProxy` for backward compatibility.
  - `main.py`: Updated `/start_session`, `/stats`, `/get_set_feedback`, `/ws/webcam`, `/upload_video`, `/uploaded_feed`, and added `/end_session` to handle `session_id`.
  - `templates/index.html`: Updated frontend JavaScript to capture `session_id` from `/start_session` and pass it through all HTTP requests and WebSocket connections.
  - `tests/test_session_isolation.py`: Added new unit test suite verifying state independence, pose tracker isolation, API routes, and session cleanup.
- **Tests Run & Results:**
  1. `python tools/regression_baseline.py --verify` $\rightarrow$ **PASS** ("Regression baselines match.")
  2. `python tests/test_session_isolation.py` $\rightarrow$ **PASS** (3/3 tests passed in 0.817s)
- **Known Limitations:**
  - Session state is held in-process memory. Process restarts will clear active sessions (database persistence planned for future milestone).
  - Shoulder-press video is still missing from the regression baseline video corpus (`CANONICAL_VIDEOS["shoulder_press"] = None`).

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

### Dashboard

☐ Cards  
☐ Charts  

### Reports

☐ AI  
☐ PDF  

### Deployment

☐ Render  
☐ Vercel  
☐ Supabase  
