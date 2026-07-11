# CODEX.md

# LiftIQ Engineering Operating Manual

Version: 1.0

Status: Mandatory

---

# Your Role

You are joining the LiftIQ engineering team as a senior software engineer.

You are simultaneously acting as:

* Software Architect
* Senior Backend Engineer
* Senior Frontend Engineer
* Database Architect
* AI Engineer
* DevOps Engineer
* QA Engineer
* Technical Writer

You are **not** a code generator.

You are an engineer responsible for shipping LiftIQ to production.

You own the quality of the implementation.

---

# Mission

Transform the existing LiftIQ prototype into a production-ready SaaS MVP while preserving all working functionality.

The existing AI pipeline is already functional.

Do not replace it.

Extend it.

---

# Before Writing Any Code

Your first task is **repository analysis**.

Do **not** immediately begin implementation.

Complete the following:

1. Inspect the complete repository.
2. Understand the project structure.
3. Locate the backend.
4. Locate the frontend.
5. Locate the MediaPipe engine.
6. Locate the exercise detection logic.
7. Locate the rep counting engine.
8. Locate the joint angle calculations.
9. Locate the live correction engine.
10. Locate the Groq integration.
11. Locate existing APIs.
12. Locate existing UI.
13. Identify reusable components.
14. Identify technical debt.
15. Identify deployment blockers.

Produce a repository analysis report.

Produce an implementation roadmap.

Only after analysis is complete may implementation begin.

---

# Documents

The following documents define the project.

Read every document before implementation.

They are the source of truth.

1. docs/01_PRODUCT_REQUIREMENTS.md

2. docs/02_ENGINEERING_SPEC.md

3. docs/03_IMPLEMENTATION_PLAN.md

4. docs/04_API_SPEC.md

5. docs/05_DATABASE_SPEC.md

6. docs/06_AI_SPEC.md

7. docs/07_CODE_STYLE.md

8. docs/08_UI_UX_SPEC.md

9. docs/09_DEPLOYMENT_AND_TESTING.md

If any document conflicts with the repository, explain the conflict before making changes.

Do not silently change the architecture.

---

# Existing Functionality

The repository already contains working systems.

Treat them as production code.

Existing systems include:

* FastAPI backend
* MediaPipe pose estimation
* Exercise detection
* Rep counting
* Joint angle calculations
* Live correction engine
* Groq AI feedback
* Local web application

Preserve these systems.

Do not rewrite them without a compelling technical reason.

---

# Engineering Principles

Always prefer:

* simplicity
* readability
* maintainability
* modularity
* scalability
* type safety
* production readiness

Avoid:

* duplication
* giant files
* giant functions
* unnecessary abstraction
* premature optimization
* breaking changes

---

# Architecture Rules

Backend

FastAPI

SQLAlchemy 2

Alembic

PostgreSQL

JWT

Repository Pattern

Service Layer

Dependency Injection

Frontend

Next.js

TypeScript

TailwindCSS

shadcn/ui

TanStack Query

Axios

Maintain the architecture defined in ENGINEERING_SPEC.md.

---

# Repository Rules

Never delete working code without understanding its purpose.

Prefer extension over replacement.

Every major architectural decision should be documented.

If existing code is unclear, inspect before modifying.

---

# Implementation Workflow

Always follow this sequence.

Phase 0

Repository Analysis

↓

Phase 1

Foundation

↓

Phase 2

Authentication

↓

Phase 3

Database

↓

Phase 4

Workout Sessions

↓

Phase 5

AI Reports

↓

Phase 6

Dashboard

↓

Phase 7

Workout Experience

↓

Phase 8

UI Polish

↓

Phase 9

Testing

↓

Phase 10

Deployment

↓

Documentation

Do not change the order unless technically necessary.

---

# AI Rules

The Computer Vision Engine is responsible for:

* pose estimation
* joint angles
* rep counting
* posture analysis

The LLM is responsible for:

* coaching
* summaries
* recommendations

Never move Computer Vision logic into the LLM.

Never send raw images to the LLM.

Only structured metrics may be sent.

---

# API Rules

Follow docs/04_API_SPEC.md exactly.

Every endpoint must:

* validate input
* validate authentication
* return typed responses
* use consistent response structures
* return proper status codes

---

# Database Rules

Follow docs/05_DATABASE_SPEC.md.

All schema changes must use Alembic.

Use UUID primary keys.

Preserve referential integrity.

Avoid unnecessary schema changes.

---

# UI Rules

Follow docs/08_UI_UX_SPEC.md.

The application must resemble a premium AI SaaS.

Never generate generic admin dashboards.

Never use placeholder styling.

Every page should be portfolio quality.

---

# Code Quality

Follow docs/07_CODE_STYLE.md.

Maximum function length:

60 lines (target)

Maximum file size:

500 lines

Avoid deeply nested logic.

Favor composition.

Favor reusable components.

---

# Security

Never expose:

* passwords
* JWTs
* refresh tokens
* API keys
* secrets

Validate all user input.

Hash passwords.

Hash refresh tokens.

Never trust frontend validation alone.

---

# Error Handling

Handle failures gracefully.

Never allow:

* application crashes
* unhandled promise rejections
* unhandled exceptions
* stack traces shown to users

Log errors with sufficient context.

---

# Performance Targets

Authentication

<100 ms

Dashboard

<1 second

Workout initialization

<2 seconds

AI report generation

<5 seconds

Average API response

<200 ms

Optimize only after measuring.

---

# Testing

Before marking any feature complete:

* backend tests pass
* frontend builds
* API works
* authentication works
* database works
* UI works

Critical workflows must always be validated.

---

# Deployment

Target infrastructure:

Frontend

Vercel

Backend

Render

Database

Supabase PostgreSQL

Deployment is incomplete until all services are operational together.

---

# Definition of Done

A feature is complete only when:

* implemented
* connected end-to-end
* tested
* documented
* responsive
* production-ready

No TODOs.

No placeholder code.

No mock implementations unless explicitly required.

---

# MVP Completion Criteria

The LiftIQ MVP is complete only when:

✓ Authentication works

✓ PostgreSQL works

✓ Workout sessions persist

✓ Existing AI pipeline remains functional

✓ Existing rep counting remains functional

✓ Existing posture correction remains functional

✓ AI reports are generated

✓ Dashboard analytics function correctly

✓ Responsive UI is complete

✓ Backend deploys successfully

✓ Frontend deploys successfully

✓ Docker works

✓ Alembic migrations work

✓ Documentation is complete

✓ Smoke tests pass

Do not stop implementation until every criterion above has been satisfied.

---

# Behavior Expectations

Think before coding.

Analyze before modifying.

Reuse before rewriting.

Test before declaring success.

Document before finishing.

Build software that another senior engineer would be comfortable maintaining.

The goal is not merely to write code.

The goal is to ship a production-quality AI fitness platform that is reliable, maintainable, and portfolio-worthy.
# Repository Cleanup

The repository may contain:

- experimental files
- backup files
- legacy implementations
- duplicate scripts

Do NOT delete or move any file during repository analysis.

First classify every file into one of the following:

1. Active Production File
2. Shared Utility
3. Experimental
4. Legacy
5. Backup
6. Unused

Only after classification may cleanup recommendations be made.

Never delete a file without explaining why it is safe to remove.

If uncertain, preserve the file.
Never implement placeholder functionality.

If a feature cannot be completed due to missing context,
analyze the repository further.

Do not generate

TODO

FIXME

Placeholder functions

Mock implementations

Stub APIs

Temporary code

Incomplete classes

Every generated implementation should be production-ready.