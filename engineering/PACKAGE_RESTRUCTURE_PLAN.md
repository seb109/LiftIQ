# PACKAGE_RESTRUCTURE_PLAN.md

Target enterprise folder hierarchy. **Design only — not implemented.** Extends `docs/02_ENGINEERING_SPEC.md` §11's `app/` layout (which only covered the individual-coaching MVP) with the gym-management modules introduced in this session's scope (see `ADR_001_TARGET_ARCHITECTURE.md`). Every package below has a one-sentence responsibility and a note on what, if anything, in the current repo maps to it (cross-referenced to `MODULE_MIGRATION_MAP.md`).

```
liftiq/
├── app/
│   ├── main.py                      # ASGI app construction, router registration only
│   │
│   ├── core/                        # Cross-cutting concerns, no business logic
│   │   ├── config.py                # Pydantic Settings — replaces scattered os.getenv() calls
│   │   ├── logging.py               # Structured logging setup — extends main.py's uncommitted logging.basicConfig
│   │   ├── exceptions.py            # Exception hierarchy + centralized handlers → {success,data/error} envelope
│   │   └── constants.py             # App-wide constants (currently: VERSION in main.py:18)
│   │
│   ├── config/                      # Environment-specific config (dev/staging/prod), separate from core/config.py's Settings class
│   │   ├── dev.py
│   │   ├── staging.py
│   │   └── prod.py
│   │
│   ├── middleware/                   # ASGI middleware — none exists today
│   │   ├── cors.py                   # Required once frontend/backend are separate origins (docs/09 §3)
│   │   ├── rate_limit.py             # Closes TECH_DEBT.md #11 (unmetered Groq spend)
│   │   ├── request_logging.py        # Correlation-ID / structured request logs (docs/02 §19)
│   │   └── tenant_context.py         # Resolves organization/branch context per request — new for multi-tenant scope
│   │
│   ├── api/                          # HTTP layer — routes only, no business logic (docs/07 §7)
│   │   └── v1/
│   │       ├── routers/
│   │       │   ├── health.py         # ← main.py:34-46 (/health, /version)
│   │       │   ├── auth.py           # New — see AUTH_MIGRATION_PLAN.md
│   │       │   ├── organizations.py  # New
│   │       │   ├── branches.py       # New
│   │       │   ├── members.py        # New
│   │       │   ├── staff.py          # New
│   │       │   ├── workouts.py       # ← main.py's /start_session, /stats, /webcam_feed, /upload_video, /uploaded_feed
│   │       │   ├── reports.py        # New
│   │       │   ├── dashboard.py      # New
│   │       │   ├── billing.py        # New
│   │       │   └── admin.py          # New
│   │       └── dependencies/         # Depends()-based DI: current user, current org, DB session, services
│   │           ├── auth.py
│   │           ├── tenancy.py
│   │           └── db.py
│   │
│   ├── services/                     # Business logic — coordinates repositories + AI + rules (docs/02 §16)
│   │   ├── auth_service.py
│   │   ├── organization_service.py
│   │   ├── member_service.py
│   │   ├── staff_service.py
│   │   ├── workout_service.py        # ← absorbs main.py's inline session-lifecycle logic (main.py:51-120)
│   │   ├── coaching_service.py       # ← wraps app/coaching/ (see below); orchestrates prompt build + call + validate
│   │   ├── analytics_service.py
│   │   ├── billing_service.py
│   │   └── attendance_service.py
│   │
│   ├── repositories/                 # Persistence only — CRUD/queries/pagination, no business rules (docs/02 §15)
│   │   ├── user_repository.py
│   │   ├── organization_repository.py
│   │   ├── member_repository.py
│   │   ├── workout_session_repository.py
│   │   ├── exercise_metric_repository.py
│   │   ├── ai_report_repository.py
│   │   └── refresh_token_repository.py
│   │
│   ├── models/                       # SQLAlchemy 2 ORM models
│   │   ├── user.py
│   │   ├── organization.py
│   │   ├── branch.py
│   │   ├── member.py
│   │   ├── staff.py
│   │   ├── role.py
│   │   ├── permission.py
│   │   ├── workout_session.py        # ← docs/05 §5, currently the in-memory gym_trainer.session shape
│   │   ├── exercise_metric.py        # ← docs/05 §6 — see DOCUMENTATION_GAP_ANALYSIS.md §2.2 on schema shape conflict
│   │   ├── ai_report.py              # ← docs/05 §7
│   │   ├── refresh_token.py          # ← docs/05 §8
│   │   ├── attendance.py
│   │   ├── membership_plan.py
│   │   ├── invoice.py / payment.py
│   │   └── audit_log.py
│   │
│   ├── schemas/                      # Pydantic v2 request/response DTOs — none exist today (main.py:52 uses a raw dict)
│   │   ├── auth.py
│   │   ├── organization.py
│   │   ├── member.py
│   │   ├── workout.py
│   │   ├── report.py
│   │   └── dashboard.py
│   │
│   ├── dependencies/                 # Shared, non-auth DI providers (settings, external clients)
│   │   └── providers.py
│   │
│   ├── database/                     # Engine/session/migrations
│   │   ├── session.py
│   │   ├── base.py
│   │   └── migrations/               # Alembic
│   │
│   ├── computer_vision/              # ← gym_trainer.py, preserved, relocated (MODULE_MIGRATION_MAP.md §1)
│   │   ├── engine.py                 # process_frame(), state machine — logic unchanged
│   │   ├── exercises.py              # EXERCISES, FORM_CHECKS config
│   │   └── metrics.py                # _compute_form_metrics_* functions
│   │
│   ├── coaching/                     # ← ai_trainer.py, refactored (MODULE_MIGRATION_MAP.md §1)
│   │   ├── llm_client.py             # Groq client wrapper
│   │   ├── prompts.py                # Prompt templates, versioned per docs/06 §17
│   │   └── validators.py             # JSON schema validation + retry/fallback — new, closes AI_REVIEW.md §2/§4
│   │
│   ├── analytics/                    # Dashboard aggregation, trend computation
│   │
│   ├── notifications/                # Out of original MVP scope (docs/01 §10); new for enterprise target
│   │
│   ├── billing/                      # Payments, invoices, membership plans — new, out of original MVP scope
│   │
│   ├── organizations/                # Org/branch domain logic if not folded into services/ above
│   │
│   ├── members/                      # Member domain logic (profiles, membership status)
│   │
│   ├── workouts/                     # Workout domain logic — the persistence-and-orchestration layer around computer_vision/
│   │
│   ├── integrations/                 # Future third-party integrations (payment processors, wearables — docs/01 §14 Phase 3)
│   │
│   └── admin/                        # Internal admin/ops tooling, audit log viewing
│
├── frontend/                         # ← templates/index.html, replaced (MODULE_MIGRATION_MAP.md §1)
│   └── src/  (per docs/02 §12 — app/, components/, features/, hooks/, lib/, services/, store/, types/, utils/)
│
├── tests/
│   ├── regression/                   # ← tests/regression/, unchanged
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── requirements-regression.txt       # Unchanged if pyproject.toml migration (MODULE_MIGRATION_MAP.md §1) is deferred
└── pyproject.toml                    # Target single dependency manifest
```

## Package responsibility summary

| Package | Responsibility | Must NOT contain |
|---|---|---|
| `core/` | Config, logging, exceptions, constants — infrastructure only | Business logic, route definitions |
| `middleware/` | Cross-cutting request processing (CORS, rate limiting, tenant resolution) | Business rules specific to one domain |
| `api/` | HTTP routing, request/response marshaling, calling into `services/` | Database queries, AI calls, business rules — per `docs/07` §7 |
| `services/` | Business logic, orchestration across repositories/AI/rules | HTTP responses, request objects, UI rendering — per `docs/07` §8 |
| `repositories/` | Persistence only: CRUD, queries, pagination, transactions | AI prompting, business decisions, validation unrelated to persistence — per `docs/07` §9 |
| `models/` | ORM table definitions and relationships | Query logic (belongs in `repositories/`) |
| `schemas/` | Pydantic request/response contracts | Persistence logic |
| `computer_vision/` | Pose estimation, rep counting, form scoring — **the preserved engine** | Any AI/LLM calls (enforced boundary — `AI_REVIEW.md` §1) |
| `coaching/` | LLM prompt construction, calls, response validation | Any CV/pose/frame logic (enforced boundary, same rule, opposite direction) |
| `organizations/`, `members/`, `staff/`, `billing/`, `attendance/` | Gym-management domain logic — new enterprise scope | CV or AI logic; these are unrelated domains and should have zero import dependency on `computer_vision/`/`coaching/` |

## Why this structure, not another

This follows `docs/02` §11's `app/` layout as the base (already user-approved as the target for the individual-coaching MVP) and extends it additively for the gym-management scope rather than inventing a new pattern — `organizations/`, `members/`, `staff/`, `billing/`, `attendance/` are peers to `workouts/`/`analytics/`, not a parallel architecture. This keeps `docs/02`'s dependency-flow rule (`API → Services → Repositories → Database`) uniform across both the original MVP scope and the new enterprise scope, so there's one set of layering rules to enforce, not two.
