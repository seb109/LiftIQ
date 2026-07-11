# LiftIQ Deployment & Testing Specification

**Version:** 1.0
**Status:** Production MVP

---

# 1. Purpose

This document defines the deployment architecture, environment configuration, testing strategy, production validation, and release process for LiftIQ.

The goal is to ensure every deployment is:

* Repeatable
* Reliable
* Secure
* Observable
* Recoverable

The MVP is **not** considered complete until every section of this document has been satisfied.

---

# 2. Production Architecture

```
                 Internet
                     │
                     ▼
              Vercel (Frontend)
                     │
              HTTPS REST API
                     │
                     ▼
             Render (FastAPI API)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
 Supabase PostgreSQL        Groq API
```

All communication must occur over HTTPS.

---

# 3. Deployment Targets

## Frontend

Platform:

* Vercel

Requirements:

* Production build succeeds
* Environment variables configured
* HTTPS enabled
* Custom domain supported (future)

---

## Backend

Platform:

* Render

Requirements:

* Docker deployment
* Health check endpoint
* Automatic restart
* Production logging
* Environment variables

---

## Database

Platform:

* Supabase PostgreSQL

Requirements:

* SSL enabled
* Alembic migrations applied
* Connection pooling configured
* Automatic backups enabled

---

# 4. Environment Variables

Backend

Required:

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

Frontend

Required:

```
NEXT_PUBLIC_API_URL=
```

Rules:

* Never commit secrets.
* Never hardcode credentials.
* Maintain a complete `.env.example`.

---

# 5. Docker Requirements

Repository must include:

```
Dockerfile

docker-compose.yml

.dockerignore
```

Docker image must:

* Build successfully
* Run without manual intervention
* Use production dependencies
* Expose the correct port

---

# 6. Database Migrations

Schema changes must be handled exclusively through Alembic.

Requirements:

* Upgrade migration
* Downgrade migration
* No manual production schema edits

Deployment must fail if migrations cannot be applied.

---

# 7. API Validation

Before deployment:

Verify:

* Authentication
* Session APIs
* Reports
* Dashboard
* Posture endpoints
* Health endpoint
* Swagger/OpenAPI

Every endpoint must return documented responses.

---

# 8. Frontend Validation

Verify:

* Login
* Registration
* Dashboard
* Workout page
* Camera access
* Live metrics
* Reports
* History
* Responsive layouts

No broken routes.

No runtime errors.

No hydration errors.

---

# 9. Backend Testing

Required tests:

Authentication

* Register
* Login
* Refresh
* Logout

Workout

* Start session
* Stop session
* Session persistence

Reports

* Report generation
* AI parsing
* Database persistence

Repositories

* CRUD operations

Services

* Authentication
* Session service
* Report service

---

# 10. Frontend Testing

Validate:

Authentication flow

Dashboard rendering

Workout lifecycle

History page

Report page

Navigation

Error states

Loading states

Responsive layouts

---

# 11. Integration Testing

Complete end-to-end workflow:

User Registration

↓

Login

↓

Dashboard

↓

Start Workout

↓

Camera

↓

Workout Complete

↓

AI Report

↓

Dashboard Updated

↓

Logout

Every step must succeed.

---

# 12. Manual Smoke Tests

Before every release:

☐ Application loads

☐ Login works

☐ Registration works

☐ Camera permission works

☐ Exercise detection works

☐ Rep counting works

☐ Live correction works

☐ Workout ends successfully

☐ AI report generated

☐ Dashboard updated

☐ History visible

☐ Logout works

---

# 13. Performance Targets

Authentication

<100 ms

Dashboard

<1 second

Workout initialization

<2 seconds

Report generation

<5 seconds

API average

<200 ms

Frontend Lighthouse

Performance

90+

Accessibility

90+

Best Practices

90+

SEO

80+ (landing page)

---

# 14. Security Checklist

☐ HTTPS enabled

☐ JWT validated

☐ Refresh tokens hashed

☐ Passwords hashed

☐ SQL injection prevented

☐ XSS mitigated

☐ CORS configured

☐ Environment variables secured

☐ No secrets in repository

☐ Rate limiting enabled

---

# 15. Logging

Backend logs:

* Startup
* Shutdown
* Authentication
* Session creation
* Session completion
* AI requests
* AI failures
* Database failures

Do not log:

* Passwords
* Tokens
* API keys

---

# 16. Monitoring

Health endpoint:

```
GET /health
```

Version endpoint:

```
GET /version
```

Startup should fail immediately if:

* Database unavailable
* Required environment variables missing
* Critical configuration invalid

---

# 17. Failure Recovery

If Groq fails:

* Retry once
* Log failure
* Generate fallback report
* Complete workout normally

If database temporarily fails:

* Roll back transaction
* Return meaningful error
* Preserve consistency

If frontend loses connection:

* Inform the user
* Allow retry

---

# 18. Documentation Requirements

Repository must include:

README.md

Architecture overview

Screenshots

Installation guide

Deployment guide

API documentation

Environment setup

Demo GIF or short video

---

# 19. Release Checklist

Repository

☐ Clean commit history

☐ No secrets

☐ Documentation updated

Backend

☐ Builds successfully

☐ Tests pass

☐ Docker builds

☐ Migrations succeed

Frontend

☐ Production build succeeds

☐ No console errors

☐ Responsive

Database

☐ Migrations applied

☐ Connection verified

Deployment

☐ Render deployed

☐ Vercel deployed

☐ Supabase connected

Verification

☐ Complete end-to-end workflow tested

---

# 20. Definition of Production Ready

LiftIQ is considered production ready only when:

✓ Backend deployed

✓ Frontend deployed

✓ PostgreSQL connected

✓ Authentication operational

✓ Existing MediaPipe engine preserved

✓ Existing rep counter preserved

✓ Existing correction engine preserved

✓ AI reports generated successfully

✓ Dashboard analytics operational

✓ Workout history persistent

✓ Responsive UI complete

✓ Docker configuration verified

✓ Alembic migrations verified

✓ Documentation complete

✓ Smoke tests passed

✓ Critical workflows validated

Only after every criterion above has been satisfied may the application be released as the LiftIQ MVP.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_