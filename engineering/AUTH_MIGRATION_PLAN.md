# AUTH_MIGRATION_PLAN.md

**Scope constraint, stated up front:** per instruction, no new authentication system is being designed here. Authentication is planned to be migrated from an existing "Internship Gym Management" project. **That project's code is not present in this repository and was not inspected as part of this audit or this blueprint.** Every item below is therefore either (a) grounded in what `docs/02_ENGINEERING_SPEC.md` §22 and `docs/05_DATABASE_SPEC.md` §8 already specify for LiftIQ's target auth shape, or (b) a standard-pattern assumption about what a JWT-based gym-management auth system typically contains, explicitly marked as an assumption. **Every assumption in this document must be verified against the actual source project before migration work begins** — nothing here should be treated as a confirmed fact about that codebase.

---

## 1. Directly reusable (assumed — verify against source project)

These are the components a mature JWT + refresh-token auth system for a gym-management platform would typically already have, and which `docs/02` §22 already specifies as LiftIQ's target shape — meaning if the source project matches that shape, these should port with minimal change:

| Component | Why it's likely portable as-is | What to verify on the source project |
|---|---|---|
| JWT lifecycle (issue/verify/expire access tokens) | `docs/02` §22 already specifies short-lived access tokens — a standard, library-driven pattern (e.g. `python-jose`/`pyjwt`) that's rarely gym-specific | Confirm the signing algorithm (HS256 vs RS256) and claims shape match or can be adapted without breaking existing issued tokens during any transition window |
| Refresh token issuance/rotation | `docs/05` §8's `RefreshToken` table (hashed token, `expires_at`, `revoked`) is a standard shape | Confirm the source project hashes refresh tokens (never stores raw) — `docs/02` §22 requires this; if the source project stores raw tokens, this is a security gap to close during migration, not to inherit |
| Auth middleware / route-protection dependency | A `Depends(get_current_user)`-style FastAPI dependency is framework-idiomatic, not business-specific | Confirm it doesn't hardcode gym-specific assumptions (e.g. assuming every user has exactly one gym membership) that would conflict with LiftIQ's own tenancy model |
| Auth Provider / frontend session context | If the source project's frontend is also Next.js/React, its auth context/provider pattern likely transfers with only branding changes | Confirm the source frontend's stack actually matches `docs/02` §12's target (Next.js/TypeScript) — if it's a different frontend stack, this row moves to "requires adaptation" |
| API client + interceptors (token attach/refresh-on-401) | Axios interceptor patterns for attaching `Authorization: Bearer` and silently refreshing on 401 are generic | Confirm error-handling conventions match `docs/02` §18's response envelope, or adapt the interceptor's error-parsing logic |
| Session persistence (httpOnly cookie or localStorage strategy) | `docs/02` §22 prefers "secure HTTP-only cookies for production" | Confirm which strategy the source project actually uses — cookie-based and header-based auth have different CORS/CSRF implications (`docs/02` §33) that affect the middleware config in `PACKAGE_RESTRUCTURE_PLAN.md` |
| RBAC (role-based access control) primitives | A generic `has_permission(user, permission)` check is business-agnostic at the mechanism level | The *roles themselves* (see §2 below) are very likely gym-specific and will need adaptation even if the *mechanism* is reusable |
| Security model (password hashing, rate limiting on auth endpoints, lockout policy) | bcrypt/Argon2 hashing and login-rate-limiting are standard, not gym-specific | Confirm the hashing algorithm and work factor meet current best practice before inheriting — an older project might use a weaker default that shouldn't be carried forward uncritically |

## 2. Requires adaptation (assumed — verify against source project)

These almost certainly exist in the source project in *some* form, but their specific shape is gym-management-specific in a way that won't map onto LiftIQ 1:1:

| Component | Expected adaptation |
|---|---|
| **User model** | The source project's `User` likely already has gym-relevant fields (e.g. membership status) that don't apply to LiftIQ's individual-coaching users, and LiftIQ's target `User` (`docs/05` §4) has fields (fitness stats, `is_verified`) the source project may not. Reconcile field-by-field rather than importing the model wholesale. |
| **Roles** | A gym-management project's roles (e.g. Owner/Manager/Trainer/Front-Desk/Member) don't map directly onto LiftIQ's original individual-coaching user model, but *do* map reasonably well onto the newly-introduced enterprise scope's org/branch/staff/member structure (`ENTERPRISE_MODULE_MAP.md`) — this is likely the *best-fitting* reusable piece precisely because this session's scope expansion (gym management, not just individual coaching) is closer to the source project's original domain than `docs/01`-`09` ever was. |
| **Gym entities** (the source project's own Organization/Branch/Gym concept, if any) | If the source project already models multi-location gyms, this may be substantially reusable for LiftIQ's new `organizations`/`branches` modules (`ENTERPRISE_MODULE_MAP.md`) — but this needs direct inspection, since "Gym Management" in the source project's name suggests it might, in fact, be the more valuable half of the migration, not just the auth half. **Flagging this as worth confirming explicitly** — the migration may end up being broader than "just auth." |
| **Tenant awareness** | If the source project is single-tenant (one gym per deployment) rather than multi-tenant (many organizations per deployment, as LiftIQ's enterprise scope requires), its auth/permission checks will need a tenant-scoping layer added, not just adapted — this is a structural gap, not a field rename. |

## 3. LiftIQ-specific work (net new, not migrated from anywhere)

| Component | Why it's new |
|---|---|
| **Organization model** | Multi-tenant SaaS concept (many gyms, one platform) — even if the source project has *a* gym/organization concept, LiftIQ's specific need (self-serve org signup, org-level billing, org-level analytics) is a platform-specific requirement the source project, built for one internship engagement's gym, likely didn't need to solve. |
| **Member roles** (as distinct from staff roles) | LiftIQ's individual-coaching heritage (the actual end-user doing AI-coached workouts) needs to coexist with the new gym-management roles — reconciling "a person who does workouts" (the original MVP's whole audience) with "a person who is a gym member under an organization" (the new scope) is LiftIQ-specific integration work, not something to inherit from either source. |
| **Trainer roles** integrated with the AI Coach | The source project's "Trainer" role is presumably a human-staff concept; LiftIQ additionally has an *AI* coach (`ai_trainer.py`/`coaching/`) — defining how a human Trainer role interacts with AI-generated reports (can a trainer override/annotate an AI report? see a member's AI history?) is new design work with no equivalent in either source. |
| **Multi-tenancy integration with the CV/AI engine** | `computer_vision/` and `coaching/` (`PACKAGE_RESTRUCTURE_PLAN.md`) were designed and audited as single-tenant-per-session concepts (`SCALABILITY_REVIEW.md`). Threading organization/branch context through the WebSocket session flow (`REQUEST_FLOW.md` §2) so a member's workout is correctly attributed to their org is LiftIQ-specific plumbing that doesn't exist in the source project (which, per its name, is gym-management-only — no computer-vision coaching engine to integrate with). |

## 4. Migration complexity estimate

| Category | Complexity | Rationale |
|---|---|---|
| §1 Directly reusable | **Low**, contingent on verification | Mechanism-level code (JWT, hashing, interceptors) is rarely the hard part of an auth migration; the risk is entirely in unverified assumptions, not in the code itself |
| §2 Requires adaptation | **Medium** | Field-level reconciliation and role-model mapping is real work but bounded and well-understood once the source project's actual shape is confirmed |
| §3 LiftIQ-specific | **Medium-High** | This is genuine new design work, particularly the AI/human-trainer role interaction and the multi-tenancy threading into the CV/WebSocket flow — neither source system solves this because neither source system is "gym management platform *and* AI computer-vision coach" simultaneously |

**Overall:** Medium complexity, weighted toward "verify assumptions early" as the dominant risk-reduction activity — not toward raw implementation effort. The single highest-value next step before writing any migration code is a direct inspection of the source project (not conducted here, out of this document's stated scope) to convert every "(assumed — verify)" tag above into either a confirmed fact or a corrected assumption.

## 5. Sequencing within `ROADMAP.md`

This plan slots into `ROADMAP.md` Phase 4, which already establishes the dependency: session isolation (Phase 2) must exist before auth lands, so that authenticated users attach to genuinely isolated sessions rather than a still-global one (`AUTHENTICATION_REVIEW.md` §5). Nothing in this document changes that sequencing — it only adds detail to what Phase 4's "reconcile the incoming project's auth shape" task actually involves.
