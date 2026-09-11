# IMPLEMENTATION_DEPENDENCY_GRAPH.md

The safest build order across the *full* enterprise scope (gym-management + AI coaching), reconciling this session's module list (`ENTERPRISE_MODULE_MAP.md`) with the already-established `ROADMAP.md` (which covered the individual-coaching MVP path). Where the two overlap, this document is the more complete one — `ROADMAP.md` remains valid as the near-term execution plan for Phases 1-3; this document extends it outward to the full module set and should be read as ROADMAP's superset, not a competing plan.

```
Foundation
   ↓
Core
   ↓
Database
   ↓
Repositories
   ↓
Services
   ↓
Authentication
   ↓
Organizations
   ↓
Members
   ↓
Attendance
   ↓
Billing
   ↓
AI  (Workout Engine + AI Coach)
   ↓
Analytics
   ↓
Frontend
   ↓
Deployment
```

## Why each phase depends on the previous one

**Foundation → Core.** Foundation (`ROADMAP.md` Phase 1-2: hosting-blocker fixes, session isolation) must land first because it fixes correctness bugs (webcam capture, global state) that would otherwise corrupt *every* later phase's testing — building Organizations on top of a system that can only hold one session at a time (`SCALABILITY_REVIEW.md`) would mean every subsequent integration test is testing against a foundation that's already known-broken for concurrent use.

**Core → Database.** `Core`'s config/logging/exception infrastructure must exist before `Database` connections are wired in, because the database layer's own startup validation (`STARTUP_SEQUENCE.md` step 3 — fail fast if unreachable) depends on `Core`'s config system to know *what* to connect to and `Core`'s logging to report *why* it failed.

**Database → Repositories.** Trivial dependency — repositories are typed query wrappers around tables that must exist first. Order here also matters *within* Database: per `DOCUMENTATION_GAP_ANALYSIS.md` §2.2/§2.3, the `ExerciseMetric` schema-shape conflict and the transaction-atomicity conflict must be resolved on paper *before* migrations are written, not after — a schema migration to fix a resolved-too-late design conflict is expensive; a documentation decision made first is free.

**Repositories → Services.** Services coordinate repositories; building services against repositories that don't exist yet just means mocking them temporarily and re-wiring later — better to have the real repository layer first.

**Services → Authentication.** This ordering is the one place this graph deliberately diverges from a naive "auth first" instinct. Authentication needs a service/DI layer to attach `Depends(get_current_user)` to (`PACKAGE_RESTRUCTURE_PLAN.md`), and it needs session isolation (already covered under Foundation) to protect real per-user state rather than a still-global one (`AUTHENTICATION_REVIEW.md` §5). Building auth any earlier means either building it twice (once against globals, once against real isolation) or building real isolation without auth's protection in the interim — the latter is what this graph and `ROADMAP.md` both choose, since an *unauthenticated* isolated-session prototype is still strictly safer than an *authenticated* globally-shared-state one.

**Authentication → Organizations.** Every Organization has an owning `User` (`ENTERPRISE_MODULE_MAP.md`'s Organizations entry) — the identity layer must exist before the tenancy layer that references it.

**Organizations → Members.** `Member` is explicitly modeled as the join between `User` (identity) and `Organization` (tenant) — cannot exist before either side does.

**Members → Attendance.** Attendance records reference `Member` and `Branch` — `Branch` is a peer dependency of `Organizations` (created alongside it, not shown as a separate graph node here only because `docs/03`'s original phase list didn't separate them; see `ENTERPRISE_MODULE_MAP.md`'s Branches entry for its own place in the hierarchy, effectively concurrent with Organizations).

**Attendance → Billing.** Not a hard technical dependency (Billing doesn't query Attendance data directly) but a *product* sequencing choice: billing/payment integration is the highest-liability module to get wrong (real money, real compliance exposure — `ENTERPRISE_MODULE_MAP.md`'s idempotency note) and benefits from the org/member/attendance data model being stable and tested first, so billing isn't built against a tenancy model that's still shifting underneath it.

**Billing → AI.** Another product-sequencing choice, not a strict technical one: `Workout Engine`/`AI Coach` (the "AI" phase here) are largely independent of Billing technically — `computer_vision/` and `coaching/` don't need to know about membership plans. This ordering exists because AI is the highest-*engineering*-risk module (it's the one with a preserved, regression-protected core that must not regress — `REFACTORING_BLUEPRINT.md` §1, §5), and doing it after the tenancy/billing foundation is stable means the team isn't context-switching between "extremely careful CV refactor" and "new tenancy model churn" in the same period.

**AI → Analytics.** Analytics/dashboards aggregate `Workout Engine` and `AI Coach` data (`ENTERPRISE_MODULE_MAP.md`'s Analytics entry) — nothing to aggregate before the source data exists.

**Analytics → Frontend.** The frontend rebuild (`REFACTORING_BLUEPRINT.md` §4) needs a reasonably complete API surface to build against — building it earlier means either building against a moving target repeatedly or building against the old, spec-diverging prototype API and re-doing the integration later. Waiting until Analytics lands means the frontend is built once, against a near-final contract.

**Frontend → Deployment.** Standard — deployment packaging/hardening is the final phase because it should validate the *whole* assembled system, not a partial one (`ROADMAP.md` Phase 10's acceptance criteria already require full end-to-end functionality).

## Cross-references to phase-level detail

This graph shows *module* dependency order; `ROADMAP.md` shows the same territory as *numbered, scoped sessions* with acceptance criteria, complexity, and risk per phase, and additionally covers the Foundation-phase hosting-blocker work in the detail this document intentionally doesn't repeat. Read them together: this document answers "what must exist before what," `ROADMAP.md` answers "how do we safely execute that in bounded sessions."

## Where this graph would break if reordered

The two highest-cost potential mis-orderings, worth naming explicitly:

1. **Building Authentication before session isolation.** Already covered above — produces authenticated users protected by nothing, since the state they'd be "authenticated into" is still global.
2. **Building Billing before Organizations/Members are stable.** A payment/invoice schema built against a tenancy model that later changes shape (e.g. discovering mid-build that Members need a many-to-many relationship with Branches, not one-to-one) means re-migrating financial data, which carries real operational risk (`ENTERPRISE_MODULE_MAP.md`'s Billing entry already flags financial-data care) beyond the usual cost of a schema change.
