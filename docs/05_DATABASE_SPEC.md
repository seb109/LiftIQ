# LiftIQ Database Specification

**Version:** 1.0
**Status:** Production MVP

---

# 1. Purpose

This document defines the database architecture for LiftIQ.

The database is responsible for storing users, workout sessions, exercise metrics, AI-generated reports, authentication data, and future analytical information.

The schema must support future expansion without major redesign.

Database Engine:

**PostgreSQL 16+**

ORM:

**SQLAlchemy 2.0**

Migration Tool:

**Alembic**

---

# 2. Design Principles

The database must be:

* Normalized (3NF where practical)
* ACID compliant
* Scalable
* Indexed appropriately
* Secure
* Easy to migrate
* Easy to query
* Optimized for analytics

Never duplicate information unnecessarily.

Derived values should be computed when possible instead of permanently stored unless required for performance.

---

# 3. Entity Relationship Diagram

```
User
 │
 ├──────────────┐
 │              │
 ▼              ▼
WorkoutSession RefreshToken
 │
 │
 ▼
ExerciseMetric
 │
 ▼
AIReport
```

One User → Many WorkoutSessions

One WorkoutSession → Many ExerciseMetrics

One WorkoutSession → One AIReport

One User → Many RefreshTokens

---

# 4. User Table

Purpose:

Stores user accounts and profile information.

Fields

| Column        | Type                |
| ------------- | ------------------- |
| id            | UUID                |
| name          | VARCHAR(100)        |
| email         | VARCHAR(255) UNIQUE |
| password_hash | TEXT                |
| avatar_url    | TEXT NULL           |
| created_at    | TIMESTAMP           |
| updated_at    | TIMESTAMP           |
| last_login    | TIMESTAMP NULL      |
| is_active     | BOOLEAN             |
| is_verified   | BOOLEAN             |

Indexes

* email

Constraints

* email unique
* email not null

---

# 5. WorkoutSession Table

Represents one completed workout.

Fields

| Column              | Type      |
| ------------------- | --------- |
| id                  | UUID      |
| user_id             | UUID FK   |
| exercise            | VARCHAR   |
| started_at          | TIMESTAMP |
| ended_at            | TIMESTAMP |
| duration_seconds    | INTEGER   |
| total_reps          | INTEGER   |
| average_form_score  | FLOAT     |
| overall_score       | FLOAT     |
| calories_estimate   | FLOAT     |
| ai_report_generated | BOOLEAN   |

Indexes

* user_id
* exercise
* started_at

---

# 6. ExerciseMetric Table

Stores detailed metrics captured during a workout.

Each workout session can have multiple metric records.

Fields

| Column               | Type      |
| -------------------- | --------- |
| id                   | UUID      |
| session_id           | UUID FK   |
| timestamp            | TIMESTAMP |
| rep_number           | INTEGER   |
| stage                | VARCHAR   |
| form_score           | FLOAT     |
| left_knee_angle      | FLOAT     |
| right_knee_angle     | FLOAT     |
| left_elbow_angle     | FLOAT     |
| right_elbow_angle    | FLOAT     |
| left_shoulder_angle  | FLOAT     |
| right_shoulder_angle | FLOAT     |
| correction_message   | TEXT      |

Indexes

* session_id
* timestamp

This schema should remain extensible.

Future angle measurements should be added without redesigning existing tables.

---

# 7. AIReport Table

Stores structured AI coaching.

Fields

| Column             | Type           |
| ------------------ | -------------- |
| id                 | UUID           |
| session_id         | UUID FK UNIQUE |
| overall_score      | FLOAT          |
| form_score         | FLOAT          |
| strengths          | JSONB          |
| mistakes           | JSONB          |
| improvements       | JSONB          |
| coach_summary      | TEXT           |
| next_session_focus | TEXT           |
| motivation         | TEXT           |
| raw_response       | JSONB          |
| created_at         | TIMESTAMP      |

Using JSONB allows future prompt evolution while keeping key fields queryable.

---

# 8. RefreshToken Table

Supports secure authentication.

Fields

| Column     | Type      |
| ---------- | --------- |
| id         | UUID      |
| user_id    | UUID FK   |
| token_hash | TEXT      |
| expires_at | TIMESTAMP |
| revoked    | BOOLEAN   |
| created_at | TIMESTAMP |

Indexes

* user_id
* expires_at

Never store raw refresh tokens.

Only store hashed values.

---

# 9. Relationships

## User

One User owns many WorkoutSessions.

Deleting a user should cascade only after confirmation through the application layer.

---

## WorkoutSession

A WorkoutSession belongs to exactly one User.

A WorkoutSession owns:

* ExerciseMetrics
* AIReport

Deleting a session removes associated metrics and reports.

---

## AIReport

Exactly one report belongs to one WorkoutSession.

Enforce uniqueness on `session_id`.

---

# 10. Future Tables (Not MVP)

Reserve space in the architecture for:

WorkoutPlan

ExerciseLibrary

Achievements

Badges

Goals

Trainer

Team

Subscription

Notifications

These are intentionally excluded from the MVP implementation.

---

# 11. Data Lifecycle

## Workout Start

Create WorkoutSession.

Status:

Active.

---

## During Workout

Store metrics in memory.

Avoid excessive database writes during real-time processing.

Persist metrics:

* periodically (batching), or
* at session completion.

The implementation should prioritize smooth real-time performance over immediate persistence.

---

## Workout End

Update WorkoutSession.

Insert ExerciseMetrics.

Generate AIReport.

Mark session as complete.

Refresh dashboard statistics.

---

# 12. Constraints

Email

Unique.

---

Workout Duration

Must be greater than zero.

---

Rep Count

Must never be negative.

---

Scores

Range:

0–100.

---

AIReport

One report per completed session.

---

# 13. Indexing Strategy

Primary indexes:

* email
* user_id
* session_id
* started_at
* exercise

Additional indexes should be added only after profiling.

Avoid premature optimization.

---

# 14. UUID Strategy

All primary keys must use UUIDs.

Reasons:

* Better security
* Harder to enumerate
* Easier distributed scaling
* Safer public APIs

Auto-increment integers should not be exposed externally.

---

# 15. Soft Deletes

MVP:

Physical deletes are acceptable for user-owned data.

Future versions may introduce `deleted_at` timestamps if recovery becomes a requirement.

---

# 16. Transactions

The following operations must execute atomically:

Register User

Login (token issuance)

Workout Completion

AI Report Generation

Session Finalization

If any step fails, the transaction should roll back to preserve consistency.

---

# 17. Migration Rules

All schema changes must be managed through Alembic.

Never modify the production database manually.

Every schema change requires:

* Upgrade migration
* Downgrade migration

Migration history must remain linear and reproducible.

---

# 18. Backup & Recovery

Although managed by the hosting provider, the application should assume regular backups are available.

Schema design must avoid irreversible data loss from routine operations.

---

# 19. Performance Targets

Typical dashboard queries:

< 100 ms

Workout history queries:

< 200 ms

Report retrieval:

< 150 ms

Authentication queries:

< 50 ms

Indexes should be reviewed if these targets are consistently missed.

---

# 20. Acceptance Criteria

The database layer is complete when:

* All core tables exist.
* Relationships are enforced.
* Foreign keys are valid.
* Constraints are applied.
* UUIDs are used consistently.
* Alembic migrations run successfully.
* CRUD operations function correctly.
* Authentication persists securely.
* Workout sessions persist reliably.
* AI reports are stored and retrievable.
* Dashboard analytics can be generated from stored data.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_