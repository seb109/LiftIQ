# ADR-001: Target Architecture for LiftIQ's Enterprise Evolution

**Status:** Proposed
**Date:** 2026-08-07
**Deciders:** Joel Sebastian (project owner)
**Related documents:** `PROJECT_AUDIT.md`, `MODULE_MIGRATION_MAP.md`, `PACKAGE_RESTRUCTURE_PLAN.md`, `ROADMAP.md`, `IMPLEMENTATION_DEPENDENCY_GRAPH.md`

---

## Context

LiftIQ exists today as a single-process Python prototype (`main.py` + `gym_trainer.py` + `ai_trainer.py` + `templates/index.html`) with a genuinely well-engineered computer-vision rep-counting/form-scoring engine and a working, if spec-diverging, Groq-based coaching integration. `docs/01`-`09` and `CODEX.md` describe a target architecture for an *individual-consumer* AI fitness coaching SaaS (FastAPI+SQLAlchemy2+Alembic+PostgreSQL+JWT backend, Next.js frontend, Docker/Render/Vercel/Supabase deployment) — none of which has been built yet, per `PROJECT_AUDIT.md`'s full audit.

This session introduces a **scope expansion beyond `docs/01`-`09`**: the target is now explicitly a **Gym Management + AI Fitness Coaching platform** — multi-tenant (organizations, branches), with staff/roles/permissions, member attendance, billing/payments, in addition to the original individual-coaching AI engine. This is a materially larger domain than any existing `docs/0N` file specifies. Authentication, separately, is planned to be migrated from an existing "Internship Gym Management" project rather than built fresh (`AUTH_MIGRATION_PLAN.md`).

A decision is needed on how to reconcile: (a) the original `docs/01`-`09` individual-coaching spec, (b) this session's new gym-management scope, and (c) the one genuinely mature, regression-protected asset that must survive all of this unchanged — the CV engine.

## Decision

**Adopt a layered enterprise architecture (`app/api → services → repositories → database`, per `docs/02` §11) as the single structural pattern for both the original individual-coaching domain and the new gym-management domain, with the Computer Vision engine and AI Coaching integration preserved as isolated, boundary-enforced packages (`computer_vision/`, `coaching/`) that no other module — old or new — is permitted to bypass.**

Concretely:
1. The gym-management modules (`organizations/`, `members/`, `staff/`, `billing/`, `attendance/`, etc. — full list in `ENTERPRISE_MODULE_MAP.md`) are peers to the original coaching-domain modules (`workouts/`, `analytics/`), not a separate architecture bolted alongside it. One dependency-flow rule governs both.
2. `gym_trainer.py`'s logic is preserved verbatim, relocated (not rewritten) into `computer_vision/`, per `MODULE_MIGRATION_MAP.md`'s "Preserve" decision — this is non-negotiable given the file's regression-protected status and the CV/AI boundary rule `CODEX.md` treats as mandatory.
3. Authentication is migrated, not designed fresh, per the explicit instruction and `AUTH_MIGRATION_PLAN.md`'s reusable/adapt/net-new breakdown.
4. The scope conflict between `docs/01`-`09` (individual-coaching only) and this session's instructions (gym-management platform) is resolved by **treating gym-management as additive scope**, not a replacement — the individual end-user doing an AI-coached workout (the entire audience `docs/01`'s PRD was written for) becomes one role (`Member`) within the larger organizational structure, rather than being designed out.

## Alternatives considered

### Alternative A: Two separate codebases/services (a "Gym Management" service and an "AI Coaching" service)
Rejected. This would cleanly separate the two domains but would require the gym-management service to call the AI-coaching service over the network for every workout session, adding latency and operational complexity (service discovery, inter-service auth) with no corresponding benefit — the two domains share a database-adjacency need (a workout session belongs to a member, who belongs to an organization) tight enough that a single well-layered monolith serves better at this stage. Revisit only if either domain's team/deployment/scaling needs diverge enough to justify the operational cost — not indicated by anything in this audit today.

### Alternative B: Rewrite the CV engine as part of adopting the new architecture
Rejected outright, per `CODEX.md`'s "preserve existing systems" rule and the fact that `gym_trainer.py` is the single most mature, well-tested asset in the repository (`PROJECT_AUDIT.md` §4). No finding anywhere in this audit suggests the CV engine's *logic* needs to change to support multi-tenancy — only its *surrounding* state management does (`SCALABILITY_REVIEW.md`), which `REFACTORING_BLUEPRINT.md` §1/§5 already scopes as a relocation-plus-parameterization, not a rewrite.

### Alternative C: Build gym-management features as a thin layer that doesn't fully adopt `docs/02`'s layered architecture (e.g. keep routes calling repositories directly for the "simple" new CRUD modules)
Rejected. Tempting because modules like `Branches`/`Settings` are simple enough that full layering might look like overhead — but a mixed-rigor codebase (some modules layered, some not) is harder to maintain than a uniformly-layered one, and `docs/07`'s code-quality standards don't carve out an exception for "simple" modules. The marginal cost of layering a simple CRUD module is low; the cost of an inconsistent codebase compounds.

### Alternative D: Defer the gym-management scope entirely and finish `docs/01`-`09`'s original individual-coaching MVP first, treating gym-management as a distinct future phase
Considered seriously — this is the more conservative, lower-risk path, and arguably what `CODEX.md`'s Implementation Scope Rule would suggest by default. Not adopted as the decision here because the user's explicit instruction for this session established gym-management as the actual target scope, and `AUTH_MIGRATION_PLAN.md` §2's finding (the source auth project's own gym-management domain may be a better structural fit for the new scope than for the original individual-coaching one) suggests the two efforts are more complementary than sequential. **This alternative remains available** — `ROADMAP.md`'s existing phase sequence (Phases 1-3: hosting fixes, backend foundation) is unaffected either way, since those phases are prerequisite to *both* the original and expanded scope. The divergence only matters starting at `ROADMAP.md` Phase 4 onward, which `IMPLEMENTATION_DEPENDENCY_GRAPH.md` now supersedes with the fuller module ordering.

## Tradeoffs

| Choosing the adopted decision (unified layered architecture, additive gym-management scope) | Cost |
|---|---|
| One consistent set of layering rules to teach, review, and enforce across the whole codebase | Higher upfront design cost for "simple" modules that would've shipped faster unlayered |
| CV engine's regression protection extends cleanly into the new architecture with no special-casing | Requires discipline to keep every future contributor from taking a shortcut that bypasses `computer_vision/`'s boundary |
| Gym-management and individual-coaching domains share infrastructure (auth, DB, deployment) rather than duplicating it | The two domains' data models must be reconciled explicitly (`AUTH_MIGRATION_PLAN.md` §3's `User`/`Member` reconciliation) rather than kept cleanly separate |
| `ROADMAP.md`'s existing Phase 1-3 work remains valid regardless of scope decision | The full `IMPLEMENTATION_DEPENDENCY_GRAPH.md` sequence is longer and more complex than the original `docs/03` plan alone — more phases, more modules, more surface area before "done" |

## Consequences

- Every future module built (`ENTERPRISE_MODULE_MAP.md`'s full list) inherits the same `api → services → repositories → database` structure — no module gets to skip layering because it seems simple.
- `computer_vision/` and `coaching/`'s zero-cross-import boundary becomes a candidate for automated enforcement (a lint rule, per `DEPENDENCY_GRAPH.md` §3), not just a documented convention, because the new module count makes an accidental violation more likely over time, not less.
- The original `docs/01`-`09` documents now need an explicit scope-expansion note added (not performed by this ADR — a follow-up documentation task) so future readers don't mistake them for the current target; this ADR is that decision's system-of-record until those documents are updated.
- `AUTH_MIGRATION_PLAN.md`'s assumptions must be verified against the real source project before Phase 4 begins — this ADR's Alternative-C analysis (that the source project's gym-management domain may be substantially reusable, not just its auth) raises the possibility that Phase 4's scope is larger than "just auth," which should be confirmed early rather than discovered mid-migration.

## Future implications

- If the gym-management scope later proves to be a poor fit alongside the individual-coaching domain (e.g. genuinely different scaling profiles, different teams, different release cadences), Alternative A (service split) becomes the fallback — the layered-monolith decision here doesn't foreclose that option, since clean internal module boundaries (per `PACKAGE_RESTRUCTURE_PLAN.md`) are also what makes a later service extraction tractable if ever needed.
- Any future exercise or AI-coaching capability added must go through `computer_vision/`/`coaching/` respectively, preserving the boundary this ADR treats as foundational — this constraint should be stated explicitly in `docs/07_CODE_STYLE.md` or a successor code-style document, not left only in this ADR and `CODEX.md`.
- This ADR should be revisited (as ADR-002 or a superseding record, not a silent edit) if the source-project inspection recommended in `AUTH_MIGRATION_PLAN.md` §4 reveals the gym-management domain migration is substantially larger or smaller than assumed here.
