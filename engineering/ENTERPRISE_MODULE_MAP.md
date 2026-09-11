# ENTERPRISE_MODULE_MAP.md

Every future module in the enterprise target, in the order a new team member should learn them (foundation outward). Grounded in `docs/05_DATABASE_SPEC.md` where a module already has a spec (Workout Engine, AI Coach), otherwise scoped fresh for this session's gym-management expansion (flagged explicitly per module, consistent with `ADR_001_TARGET_ARCHITECTURE.md`).

---

## Core

| | |
|---|---|
| **Purpose** | Cross-cutting infrastructure: config, logging, exceptions, constants. No business logic. |
| **Dependencies** | None — every other module depends on this, it depends on nothing internal. |
| **Public interfaces** | `Settings` (Pydantic), `get_logger(name)`, exception base classes |
| **Data ownership** | None |
| **Expected APIs** | None — not exposed via HTTP |
| **Database tables** | None |
| **Scalability considerations** | N/A — stateless configuration, no scaling concern of its own |

## Authentication

| | |
|---|---|
| **Purpose** | Identity verification, token issuance, session validation. Migrated per `AUTH_MIGRATION_PLAN.md`, not built fresh. |
| **Dependencies** | `Core` (config for JWT secrets), `Database` |
| **Public interfaces** | `get_current_user()` (FastAPI dependency), `AuthService.login/register/refresh/logout` |
| **Data ownership** | `User`, `RefreshToken` |
| **Expected APIs** | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (`docs/04` §5) |
| **Database tables** | `users`, `refresh_tokens` (`docs/05` §4, §8) |
| **Scalability considerations** | Stateless JWT means auth itself scales horizontally with no shared state; refresh-token revocation checks add one DB read per refresh — acceptable given `docs/02` §31's <100ms auth target, but worth caching if it becomes a hot path |

## Organizations *(new — gym-management scope, not in original `docs/01`-`09`)*

| | |
|---|---|
| **Purpose** | Represents a gym business/tenant — the top of the multi-tenancy hierarchy. |
| **Dependencies** | `Core`, `Database`, `Authentication` (org owner is a `User`) |
| **Public interfaces** | `OrganizationService.create/update/get`, `OrganizationRepository` |
| **Data ownership** | `Organization` |
| **Expected APIs** | `POST /organizations`, `GET /organizations/{id}`, `PUT /organizations/{id}` |
| **Database tables** | `organizations` (new — no equivalent in `docs/05`) |
| **Scalability considerations** | Every tenant-scoped query in the system will filter by `organization_id` — this table's primary key is the most heavily-referenced foreign key in the whole schema; index accordingly from day one, not after profiling |

## Branches *(new)*

| | |
|---|---|
| **Purpose** | Physical gym locations under one Organization. |
| **Dependencies** | `Organizations` |
| **Public interfaces** | `BranchService.create/update/list` |
| **Data ownership** | `Branch` |
| **Expected APIs** | `POST /organizations/{org_id}/branches`, `GET /branches/{id}` |
| **Database tables** | `branches` (FK → `organizations`) |
| **Scalability considerations** | One-to-many with Organizations; low write volume, standard indexing on `organization_id` |

## Members *(new)*

| | |
|---|---|
| **Purpose** | End users who belong to an Organization as gym members — distinct from `User` (an authentication identity) the way `docs/05`'s original `User` never needed to be, since the MVP had no organization concept. |
| **Dependencies** | `Organizations`, `Authentication` (a Member has a `User` identity) |
| **Public interfaces** | `MemberService.enroll/list/get`, `MemberRepository` |
| **Data ownership** | `Member` (links `User` ↔ `Organization`, plus membership-specific fields) |
| **Expected APIs** | `GET /organizations/{org_id}/members`, `POST /organizations/{org_id}/members` |
| **Database tables** | `members` (FK → `users`, `organizations`) |
| **Scalability considerations** | This is the join point between the original individual-coaching `User` and the new org structure — see `AUTH_MIGRATION_PLAN.md` §3's note on reconciling these; expect this table to be queried alongside `workout_sessions` frequently (member's workout history), so a compound index on `(member_id, started_at)` on the workout side matters here too |

## Staff *(new)*

| | |
|---|---|
| **Purpose** | Employees of an Organization — trainers, front-desk, managers. |
| **Dependencies** | `Organizations`, `Authentication`, `Roles` |
| **Public interfaces** | `StaffService.hire/update/assign_role` |
| **Data ownership** | `Staff` |
| **Expected APIs** | `POST /organizations/{org_id}/staff`, `GET /staff/{id}` |
| **Database tables** | `staff` (FK → `users`, `organizations`) |
| **Scalability considerations** | Low volume relative to Members; no special concerns |

## Roles / Permissions *(new)*

| | |
|---|---|
| **Purpose** | RBAC primitives — what a Staff/Member is allowed to do. |
| **Dependencies** | `Organizations` (roles are typically org-scoped, not global) |
| **Public interfaces** | `has_permission(user, permission, org_context)`, `RoleService` |
| **Data ownership** | `Role`, `Permission`, join table `role_permissions` |
| **Expected APIs** | `GET /organizations/{org_id}/roles`, `POST /roles/{id}/permissions` |
| **Database tables** | `roles`, `permissions`, `role_permissions` |
| **Scalability considerations** | Permission checks happen on nearly every request once built — cache the resolved permission set per (user, org) pair per request rather than re-querying the join table every time |

## Attendance *(new)*

| | |
|---|---|
| **Purpose** | Check-in/check-out tracking for gym visits, independent of AI-coached workout sessions. |
| **Dependencies** | `Members`, `Branches` |
| **Public interfaces** | `AttendanceService.check_in/check_out` |
| **Data ownership** | `AttendanceRecord` |
| **Expected APIs** | `POST /attendance/check-in`, `GET /members/{id}/attendance` |
| **Database tables** | `attendance_records` |
| **Scalability considerations** | High write volume at peak gym hours (many simultaneous check-ins) — should not block on anything beyond a simple insert; keep this module free of synchronous calls into `Workout Engine`/`AI Coach` |

## Memberships / Billing / Payments *(new — explicitly out of original MVP scope per `docs/01` §10)*

| | |
|---|---|
| **Purpose** | Membership plans, invoicing, payment processing. |
| **Dependencies** | `Organizations`, `Members` |
| **Public interfaces** | `BillingService.create_invoice/process_payment`, integrates with an external payment processor (not yet chosen) |
| **Data ownership** | `MembershipPlan`, `Invoice`, `Payment` |
| **Expected APIs** | `GET /organizations/{org_id}/plans`, `POST /members/{id}/subscribe`, `POST /payments/webhook` |
| **Database tables** | `membership_plans`, `invoices`, `payments` |
| **Scalability considerations** | Payment webhooks need idempotency handling (a processor may retry a webhook) — this is a correctness requirement, not just a scale one; flag prominently when this module is actually scoped in detail, since it's financial data |

## Workout Engine *(existing — preserved core, wrapped in new persistence)*

| | |
|---|---|
| **Purpose** | Orchestrates the CV engine + session lifecycle; the persistence-and-orchestration layer around `computer_vision/`. |
| **Dependencies** | `computer_vision/` (preserved, see `MODULE_MIGRATION_MAP.md`), `Members`, `Database` |
| **Public interfaces** | `WorkoutService.start_session/process_frame/complete_set/complete_session` — largely a typed wrapper around today's `gym_trainer.start_session()`/`process_frame()`/`complete_set()` |
| **Data ownership** | `WorkoutSession`, `ExerciseMetric` |
| **Expected APIs** | `POST /sessions/start`, `POST /sessions/{id}/stop`, `GET /sessions`, `GET /sessions/{id}`, `DELETE /sessions/{id}` (`docs/04` §7) |
| **Database tables** | `workout_sessions`, `exercise_metrics` (`docs/05` §5-6 — subject to the schema-shape resolution in `DOCUMENTATION_GAP_ANALYSIS.md` §2.2) |
| **Scalability considerations** | The one module with a hard, already-analyzed scaling ceiling — see `SCALABILITY_REVIEW.md` and `PERFORMANCE_REVIEW.md` in full; this is CPU-bound per active session, not a typical CRUD-scaling problem |

## Exercise Library *(new — not currently config-driven beyond code)*

| | |
|---|---|
| **Purpose** | Externalizes `gym_trainer.EXERCISES`/`FORM_CHECKS` (currently hardcoded Python dicts, `gym_trainer.py:34-287`) into a queryable, potentially admin-editable catalog. |
| **Dependencies** | `Organizations` (an org might eventually customize/extend the base library — future consideration, not required for MVP parity) |
| **Public interfaces** | `ExerciseLibraryService.list/get` |
| **Data ownership** | `Exercise` (if externalized — see scalability note) |
| **Expected APIs** | `GET /exercises` |
| **Database tables** | `exercises` (optional — see note) |
| **Scalability considerations** | **Recommendation, not a requirement:** keep `EXERCISES`/`FORM_CHECKS` as code-defined config for as long as possible rather than moving them into the database. They're read constantly (every frame) and change rarely (adding a new exercise is a deliberate, reviewed, regression-tested event per `CLAUDE.md`) — moving them to a DB table trades compile-time safety and regression-test coverage for editability nobody has asked for yet. Only build this module if/when non-engineers genuinely need to edit exercise definitions without a code deploy. |

## AI Coach *(existing — refactored, not replaced)*

| | |
|---|---|
| **Purpose** | Post-workout/post-set coaching via LLM. |
| **Dependencies** | `Workout Engine` (receives structured metrics only — never `computer_vision/` directly, per the enforced boundary) |
| **Public interfaces** | `CoachingService.get_set_feedback/get_session_summary` |
| **Data ownership** | `AIReport` |
| **Expected APIs** | `GET /reports`, `GET /reports/{id}`, `POST /reports/generate` (`docs/04` §9) |
| **Database tables** | `ai_reports` (`docs/05` §7) |
| **Scalability considerations** | External API latency (Groq) is the bottleneck, not compute — `docs/06` §14's <5s target and the retry/fallback logic in `REFACTORING_BLUEPRINT.md` §2 are the relevant scaling concerns, not concurrency |

## Analytics

| | |
|---|---|
| **Purpose** | Dashboard aggregation — streaks, trends, org-level rollups. |
| **Dependencies** | `Workout Engine`, `Members`, `Organizations` |
| **Public interfaces** | `AnalyticsService.get_dashboard/get_org_summary` |
| **Data ownership** | None directly — reads from `Workout Engine`/`AI Coach` tables; may own materialized/cached aggregate tables if performance requires |
| **Expected APIs** | `GET /dashboard` (`docs/04` §10), plus new org-level analytics endpoints for the gym-management scope |
| **Database tables** | Possibly `dashboard_cache` or materialized views — not required initially |
| **Scalability considerations** | `docs/05` §19's <100ms dashboard-query target likely requires pre-aggregation once data volume grows past what a live `GROUP BY` handles comfortably — worth planning for, not building pre-emptively |

## Notifications *(new — explicitly out of original MVP scope per `docs/01` §10)*

| | |
|---|---|
| **Purpose** | Push/email/in-app notifications (workout reminders, billing alerts). |
| **Dependencies** | `Members`, `Billing` (billing-triggered notifications), `Workout Engine` (workout-triggered notifications) |
| **Public interfaces** | `NotificationService.send` |
| **Data ownership** | `Notification` (delivery log) |
| **Expected APIs** | `GET /notifications`, `POST /notifications/mark-read` |
| **Database tables** | `notifications` |
| **Scalability considerations** | Should be async/queued (not a synchronous request-path dependency) from day one — this is the one module where adding a task queue (Celery/RQ/similar) is justified even at moderate scale, since notification delivery must never block a request that triggered it |

## Reports

Overlaps with `AI Coach`'s `AIReport` ownership — kept as a conceptually separate module here because `docs/02` §27-28 treats "Reports" (rich, printable, PDF-exportable) as a presentation/aggregation concern distinct from the raw AI-generated content. **Recommendation:** do not build this as a separate data-owning module; it should be a presentation layer over `AI Coach` + `Workout Engine` data, avoiding the ownership duplication a literal reading of the original spec's module list might suggest.

## Audit Logs *(new — standard enterprise requirement, not previously specified in any `docs/0N` file)*

| | |
|---|---|
| **Purpose** | Immutable record of significant actions (staff role changes, billing events, data deletions) for compliance/debugging. |
| **Dependencies** | Every module that performs a loggable action — this is a write-only sink, not a module other modules call *into* for logic |
| **Public interfaces** | `AuditLogger.record(actor, action, target, metadata)` |
| **Data ownership** | `AuditLog` |
| **Expected APIs** | `GET /organizations/{org_id}/audit-logs` (admin-only) |
| **Database tables** | `audit_logs` |
| **Scalability considerations** | Append-only, high volume over time — plan for partitioning/archival earlier than most tables, since this one has no natural pruning point (audit logs are kept, not rotated out, in most compliance contexts) |

## Settings

| | |
|---|---|
| **Purpose** | Per-organization and per-user preferences (not to be confused with `Core`'s application-level `Settings` class). |
| **Dependencies** | `Organizations`, `Members`/`Staff` |
| **Public interfaces** | `SettingsService.get/update` |
| **Data ownership** | `OrganizationSettings`, `UserPreferences` |
| **Expected APIs** | `GET /organizations/{org_id}/settings`, `PUT /users/me/preferences` |
| **Database tables** | `organization_settings`, `user_preferences` |
| **Scalability considerations** | Low volume, low risk — a good candidate for aggressive caching since settings change rarely relative to how often they're read |

## Media

| | |
|---|---|
| **Purpose** | Managed storage for org logos, member avatars, and — notably — the currently-unwired `assets/` directory's eventual home (`MODULE_MIGRATION_MAP.md` §2). |
| **Dependencies** | `Organizations`, `Members` |
| **Public interfaces** | `MediaService.upload/get_url` |
| **Data ownership** | `MediaAsset` (metadata; actual bytes belong in object storage, not the database) |
| **Expected APIs** | `POST /media/upload`, `GET /media/{id}` |
| **Database tables** | `media_assets` (metadata only) |
| **Scalability considerations** | Do not store binary blobs in PostgreSQL — object storage (S3-compatible) from the start; this module is metadata-only by design, which is also the fix for `upload_video()`'s current unbounded-local-disk problem (`TECH_DEBT.md` #8) once video uploads are routed through it |

## Integrations *(future — `docs/01` §14 Phase 3)*

| | |
|---|---|
| **Purpose** | Third-party connections — payment processors, wearables, future partner APIs. |
| **Dependencies** | Varies per integration; `Billing` for payment processors |
| **Public interfaces** | Per-integration adapter interfaces |
| **Data ownership** | Integration-specific credential/config storage |
| **Expected APIs** | Varies |
| **Database tables** | `integration_configs` |
| **Scalability considerations** | Not yet scoped in detail — explicitly deferred per `docs/01` §14; listed here only for completeness of the module map |

## Admin

| | |
|---|---|
| **Purpose** | Internal ops tooling — cross-org visibility, audit log review, feature flags. |
| **Dependencies** | Everything (by nature of being an admin surface) — but should call through the same `Services` layer as any other client, not bypass it |
| **Public interfaces** | `AdminService.*` |
| **Data ownership** | None new — reads across other modules' data |
| **Expected APIs** | `/admin/*` routes, restricted to a platform-admin role (distinct from org-level Staff roles) |
| **Database tables** | None new |
| **Scalability considerations** | Low traffic by nature (internal-only); the main risk is scope creep — keep this a thin read/ops layer, not a place business logic accumulates because "it's just for admins" |
