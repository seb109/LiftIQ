# LiftIQ Engineering Specification

Version: 1.0

Status: Production MVP

---

# 1. Product Vision

LiftIQ is an AI-powered personal fitness platform that provides real-time exercise tracking, posture analysis, rep counting, live coaching, workout analytics, and AI-generated fitness insights.

The goal is not to create another workout counter.

The goal is to create a product that feels like a premium AI fitness coach capable of helping users improve exercise quality through computer vision and intelligent feedback.

This project must be production-ready and deployable.

Every engineering decision should prioritize reliability, maintainability, scalability, and user experience.

---

# 2. Current Repository State

The repository already contains functional AI components.

These existing components are considered stable business logic and must be preserved.

Existing functionality includes:

- FastAPI backend
- MediaPipe pose estimation
- Joint angle calculations
- Exercise detection
- Rep counting
- Live posture correction
- Groq AI integration
- Local web interface

These systems are not prototypes.

They are the foundation of the MVP.

Do not rewrite these systems unless absolutely necessary.

Instead, extend them.

---

# 3. Product Goals

The MVP must allow a user to:

- Register
- Login
- Start a workout
- Select an exercise
- Allow webcam access
- Receive live posture analysis
- Receive live rep counting
- Receive live correction messages
- End workout
- Receive AI-generated coaching
- View previous workouts
- Track progress
- View workout reports

The complete user experience should feel smooth, modern, and responsive.

---

# 4. Non Goals

The MVP will NOT include:

- Social features
- Workout sharing
- Community
- Challenges
- Premium subscriptions
- Payments
- Diet planning
- Trainer marketplace
- Wearable integrations
- Mobile applications
- Offline mode

These features belong to future releases.

---

# 5. Engineering Principles

Every engineer working on LiftIQ must follow these principles.

## Preserve Working Code

Never rewrite working functionality.

Existing AI modules have priority.

New features should extend the current architecture.

Avoid regressions.

---

## Build Incrementally

Large rewrites are prohibited.

Implement small, verifiable improvements.

Every completed feature should leave the application in a deployable state.

---

## Production First

Every feature should be written as production code.

Avoid shortcuts.

Avoid temporary implementations.

Avoid TODO comments.

Avoid placeholder logic.

---

## Simplicity

Prefer readable code over clever code.

If two solutions solve the same problem,
choose the simpler solution.

---

## Separation of Concerns

Business logic must never exist inside API routes.

Database logic must never exist inside UI components.

AI prompting must remain isolated.

MediaPipe logic must remain isolated.

Every layer has one responsibility.

---

## Type Safety

Backend:

- Python typing
- Pydantic v2

Frontend:

- TypeScript

Avoid "Any".

Avoid untyped responses.

---

## Consistency

Naming conventions must remain consistent.

Folder structures must remain predictable.

Code style must remain uniform across the project.

---

# 6. Target Tech Stack

Backend

- FastAPI
- Python 3.12+
- SQLAlchemy 2
- Alembic
- PostgreSQL
- JWT Authentication
- Pydantic v2

Frontend

- Next.js 15
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- TanStack Query
- Axios
- Recharts

AI

- MediaPipe
- OpenCV
- Groq API

Deployment

Frontend

- Vercel

Backend

- Render

Database

- Supabase PostgreSQL

---

# 7. High Level Architecture

                 Browser

                    │

            Next.js Frontend

                    │

             REST API (HTTPS)

                    │

               FastAPI Server

                    │

      ┌─────────────┼─────────────┐

 Authentication   AI Engine   Database

                    │

      MediaPipe + OpenCV + Groq

                    │

             PostgreSQL Database

The frontend must never communicate directly with MediaPipe.

All AI processing occurs inside the backend.

The frontend communicates exclusively through REST APIs.

---

# 8. Project Philosophy

LiftIQ should resemble a commercial SaaS product rather than a university project.

Every page should be visually polished.

Every interaction should feel intentional.

Every API should be documented.

Every error should be handled gracefully.

Every deployment should be repeatable.

If a feature feels unfinished,
it is not complete.

---

# 9. Definition of Production Ready

The project is considered production ready only when:

- Frontend builds successfully.
- Backend builds successfully.
- PostgreSQL is connected.
- Authentication works.
- Sessions are stored.
- Reports are generated.
- Dashboard displays analytics.
- Environment variables are documented.
- Docker builds.
- Application deploys successfully.
- README is complete.
- API documentation is available.
- Error handling is implemented.
- Logging is implemented.
- All critical features are tested.

Until every requirement above is complete,
the project is not considered finished.

---

# 10. Repository Analysis Rules

Before implementing any new feature,
the engineer must:

1. Analyze the repository structure.
2. Locate all FastAPI routes.
3. Locate AI modules.
4. Locate MediaPipe implementation.
5. Locate exercise detection.
6. Locate rep counting.
7. Locate Groq integration.
8. Locate frontend entry points.
9. Locate configuration files.
10. Identify reusable components.
11. Identify technical debt.
12. Generate an implementation roadmap.

Only after repository analysis is complete
may implementation begin.

No code should be modified before analysis.
---

# 11. Backend Architecture

The backend follows **Clean Architecture**.

Every layer has exactly one responsibility.

The dependency flow must always be:

```
API
↓

Services
↓

Repositories
↓

Database
```

API routes must never directly access the database.

Business logic must never exist inside API routes.

Repositories must never contain business rules.

Services coordinate repositories, AI modules, and domain logic.

---

## Backend Folder Structure

```
app/

├── api/
│   ├── auth.py
│   ├── users.py
│   ├── sessions.py
│   ├── posture.py
│   ├── reports.py
│   └── health.py
│
├── auth/
│   ├── jwt.py
│   ├── dependencies.py
│   ├── hashing.py
│   └── security.py
│
├── core/
│   ├── config.py
│   ├── logging.py
│   ├── exceptions.py
│   └── constants.py
│
├── db/
│   ├── session.py
│   ├── base.py
│   └── migrations/
│
├── models/
│   ├── user.py
│   ├── workout_session.py
│   ├── exercise_metric.py
│   ├── ai_report.py
│   └── refresh_token.py
│
├── repositories/
│   ├── users.py
│   ├── sessions.py
│   ├── reports.py
│   └── metrics.py
│
├── schemas/
│   ├── auth.py
│   ├── user.py
│   ├── session.py
│   ├── report.py
│   └── posture.py
│
├── services/
│   ├── auth.py
│   ├── user.py
│   ├── session.py
│   ├── report.py
│   ├── posture.py
│   └── analytics.py
│
├── posture/
│
├── reports/
│
├── tests/
│
└── main.py
```

The existing posture engine should remain inside the `posture/` package.

It must not be rewritten.

---

# 12. Frontend Architecture

The frontend follows a feature-first architecture.

Pages must remain lightweight.

Business logic belongs inside feature modules.

API calls belong inside service files.

Components should remain reusable.

---

## Frontend Folder Structure

```
src/

├── app/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── charts/
│   ├── dashboard/
│   └── workout/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── workout/
│   ├── reports/
│   └── profile/
│
├── hooks/
│
├── lib/
│
├── services/
│
├── store/
│
├── types/
│
└── utils/
```

Avoid deeply nested folders.

Favor discoverability over clever organization.

---

# 13. Database Design

The MVP requires five primary entities.

## User

Stores authentication and profile information.

Fields include:

- id
- email
- username
- hashed_password
- created_at
- updated_at
- last_login

---

## WorkoutSession

Represents one completed workout.

Fields:

- id
- user_id
- exercise
- started_at
- ended_at
- duration
- overall_score
- calories_estimate

---

## ExerciseMetric

Stores detailed metrics collected during a workout.

Examples:

- rep_count
- average_form_score
- minimum_joint_angle
- maximum_joint_angle
- average_rep_duration
- correction_count

This table should support future expansion without schema redesign.

---

## AIReport

Stores structured AI feedback.

Fields:

- id
- session_id
- strengths
- mistakes
- improvements
- coach_summary
- next_session_focus
- raw_response

Store structured fields separately where possible instead of relying only on raw text.

---

## RefreshToken

Supports secure JWT refresh.

Fields:

- id
- user_id
- token_hash
- expires_at
- revoked
- created_at

---

# 14. Relationships

```
User

↓

WorkoutSession

↓

ExerciseMetric

↓

AIReport
```

One user has many workout sessions.

One workout session has one AI report.

One workout session has many metrics.

Refresh tokens belong to users.

Use cascading deletes only where appropriate.

Avoid orphaned records.

---

# 15. Repository Pattern

Every model must have a repository.

Repositories are responsible only for persistence.

Allowed:

- CRUD
- filtering
- pagination
- database queries

Forbidden:

- AI logic
- authentication
- business rules
- HTTP responses

---

# 16. Service Layer

Services coordinate application behavior.

Example:

WorkoutService

Responsibilities:

- create session
- stop session
- calculate duration
- save metrics
- generate report
- trigger Groq
- return response DTO

The service layer should be the only place where multiple repositories interact.

---

# 17. Dependency Injection

FastAPI dependency injection should be used consistently.

Inject:

- database session
- authenticated user
- repositories
- services
- configuration

Avoid creating services manually inside routes.

---

# 18. API Design Standards

Every endpoint must:

- validate input
- validate authentication
- return typed responses
- use proper HTTP status codes
- return meaningful error messages

Never expose stack traces.

Never expose internal exceptions.

Response format should remain consistent.

Example:

```
{
  "success": true,
  "data": {},
  "message": "Workout created successfully"
}
```

Error format:

```
{
  "success": false,
  "error": {
      "code": "...",
      "message": "..."
  }
}
```

---

# 19. Logging

Every important event should be logged.

Examples:

- login
- logout
- workout started
- workout ended
- report generated
- Groq request
- Groq failure
- authentication failure
- database errors

Do not log passwords.

Do not log secrets.

Do not log tokens.

---

# 20. Environment Variables

No secrets may be hardcoded.

All configuration must come from environment variables.

Examples:

```
DATABASE_URL=

JWT_SECRET=

JWT_REFRESH_SECRET=

GROQ_API_KEY=

FRONTEND_URL=

BACKEND_URL=

ENVIRONMENT=

LOG_LEVEL=
```

A complete `.env.example` file must be maintained.

---

# 21. Definition of Done (Per Feature)

A feature is complete only when:

- implementation is finished
- backend compiles
- frontend compiles
- API works
- UI is connected
- errors are handled
- loading states exist
- validation exists
- tests pass
- documentation is updated

No feature is considered complete until all criteria are satisfied.
---

# 22. Authentication Architecture

Authentication must use stateless JWT authentication with refresh tokens.

## Authentication Flow

```
Register

↓

Hash Password

↓

Store User

↓

Login

↓

Verify Password

↓

Generate Access Token

↓

Generate Refresh Token

↓

Store Refresh Token

↓

Return Tokens

↓

Authenticated Requests

↓

Refresh Token

↓

New Access Token
```

## Requirements

- Access Token (short-lived)
- Refresh Token (long-lived)
- Password hashing using bcrypt or Argon2
- Token revocation on logout
- Protected API routes
- Refresh token rotation
- Secure HTTP-only cookies are preferred for production deployment

---

# 23. User Journey

The MVP user journey should be seamless.

## First Visit

Landing Page

↓

Register/Login

↓

Dashboard

↓

Choose Exercise

↓

Start Workout

↓

Live Coaching

↓

Finish Workout

↓

AI Report

↓

Dashboard Updated

↓

Workout History

---

# 24. Workout Lifecycle

Every workout follows the same lifecycle.

```
Create Session

↓

User selects exercise

↓

Webcam starts

↓

MediaPipe initializes

↓

Pose detection begins

↓

Rep counting begins

↓

Live corrections

↓

Metrics collected

↓

Workout stopped

↓

Metrics aggregated

↓

Groq generates report

↓

Database updated

↓

Dashboard refreshed
```

A workout should never bypass any stage.

---

# 25. AI Pipeline

The AI system consists of three independent layers.

## Layer 1

Computer Vision

Responsibilities:

- MediaPipe
- Joint landmarks
- Joint angles
- Pose tracking

Output:

Raw body metrics

---

## Layer 2

Workout Analysis

Responsibilities:

- Rep counting
- Stage detection
- Tempo
- Form score
- Exercise validation
- Corrections

Output:

Structured workout metrics

---

## Layer 3

AI Coach

Responsibilities:

- Generate summary
- Highlight strengths
- Highlight mistakes
- Recommend improvements
- Produce structured coaching

Output:

Structured JSON

---

# 26. AI Response Format

The LLM must always return structured JSON.

Never return free-form text.

Expected schema:

```json
{
  "overall_score": 92,
  "form_score": 89,
  "strengths": [
    "...",
    "..."
  ],
  "mistakes": [
    "...",
    "..."
  ],
  "improvements": [
    "...",
    "..."
  ],
  "coach_summary": "...",
  "next_session_focus": "...",
  "motivation": "..."
}
```

If parsing fails, fallback gracefully.

Never crash the application.

---

# 27. Dashboard Requirements

The dashboard should communicate progress immediately.

Required widgets:

- Welcome message
- Workout streak
- Sessions this week
- Total workouts
- Average form score
- Workout score trend
- Recent workouts
- AI recommendation
- Quick Start Workout
- Profile summary

Use charts instead of tables wherever possible.

---

# 28. Reports

Every completed workout generates one report.

A report contains:

## Session Summary

- Exercise
- Date
- Duration
- Reps
- Calories estimate

---

## Scores

- Overall score
- Form score
- Consistency score

---

## AI Analysis

- Strengths
- Mistakes
- Improvements
- Coach summary
- Next session focus

---

## Charts

- Rep quality
- Form trend
- Joint angle trend (if available)

---

Reports should be printable and downloadable as PDF.

---

# 29. API Endpoints

## Authentication

POST /auth/register

POST /auth/login

POST /auth/refresh

POST /auth/logout

---

## User

GET /users/me

PUT /users/me

---

## Workout

POST /sessions/start

POST /sessions/{id}/stop

GET /sessions

GET /sessions/{id}

DELETE /sessions/{id}

---

## Reports

GET /reports

GET /reports/{id}

POST /reports/generate

---

## Posture

POST /posture/analyze

GET /posture/live

---

## Health

GET /health

GET /version

---

# 30. API Standards

Every endpoint must include:

- Authentication (when required)
- Validation
- Typed request models
- Typed response models
- Error responses
- OpenAPI documentation

Never return inconsistent response structures.

---

# 31. Performance Requirements

Target performance:

Backend API

Average response

<200 ms

Authentication

<100 ms

Dashboard

<1 second

Workout initialization

<2 seconds

Report generation

<5 seconds

Frontend

Lighthouse score

90+

Avoid unnecessary re-renders.

Avoid duplicate API requests.

Optimize expensive computations.

---

# 32. Error Handling

Every error must have:

- Code
- User-friendly message
- Log entry

Never expose internal exceptions.

Use centralized exception handlers.

Frontend should display graceful error states.

---

# 33. Security

Requirements:

- Password hashing
- JWT validation
- Refresh token validation
- CORS configuration
- Rate limiting (basic)
- Input validation
- SQL injection protection
- XSS prevention
- CSRF considerations (if cookie-based auth)
- Environment variable validation

Secrets must never be committed.

---

# 34. Testing Strategy

Minimum required tests:

Backend

- Authentication
- Session creation
- Session completion
- Report generation
- Repository tests
- Service tests

Frontend

- Authentication flow
- Dashboard rendering
- Workout page
- Report page

Integration

- Login
- Workout
- Report
- Logout

Critical paths must always be tested.

---

# 35. Deployment Requirements

Backend

Render

Frontend

Vercel

Database

Supabase PostgreSQL

The repository must include:

- Dockerfile
- docker-compose.yml
- .env.example
- Alembic migrations
- README
- Deployment guide

Deployment should require minimal manual steps.

---

# 36. Observability

Include:

- Health endpoint
- Structured logs
- Startup validation
- Configuration validation

The application should fail fast if critical configuration is missing.

---

# 37. Code Quality Standards

Code should be:

- Readable
- Modular
- Typed
- Documented where necessary
- Consistent
- Tested

Avoid:

- Giant functions
- Duplicate logic
- Hardcoded values
- Magic numbers
- Deep nesting

Prefer composition over duplication.

---

# 38. MVP Completion Checklist

The MVP is complete only when:

✅ Authentication implemented

✅ PostgreSQL connected

✅ Workout sessions stored

✅ Dashboard operational

✅ Reports generated

✅ AI feedback integrated

✅ MediaPipe integrated

✅ Existing rep counter preserved

✅ Existing correction engine preserved

✅ Responsive UI completed

✅ Backend deployed

✅ Frontend deployed

✅ Database deployed

✅ README completed

✅ API documentation available

✅ Docker configuration completed

✅ Environment variables documented

✅ Tests passing

Only after every item above is complete may the MVP be considered production-ready.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_