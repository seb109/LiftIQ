# AUTHENTICATION_REVIEW.md

**Scope note:** per explicit instruction, this document only inspects existing work. No authentication is being implemented, planned in code, or scaffolded by this audit.

## 1. What exists today

Nothing. A repo-wide search confirms:

- No `jwt`, `bcrypt`, `passlib`, `argon2`, or any auth/crypto library in `requirements.txt`, `requirements-regression.txt`, or any `import` statement.
- No `User`, `RefreshToken`, session-token, or credential model anywhere.
- No `Authorization` header handling, no cookie handling, no `Depends`-based auth dependency in `main.py`.
- No login/register/logout route of any kind.
- Every one of the 8 routes inventoried in `API_REVIEW.md` is fully open to any caller.

## 2. What's reusable from the current codebase

Effectively nothing auth-specific — there's nothing to reuse because nothing was built. The closest thing to reusable groundwork is structural, not functional:

- `main.py`'s route-per-concern layout (`main.py:27-208`) is small and uncluttered enough that inserting `Depends(get_current_user)` on the routes that should become protected (`/start_session`, `/stats`, `/get_set_feedback`, `/webcam_feed`, `/upload_video`, `/uploaded_feed` — everything except `/`, `/health`, `/version`) will be a mechanical change once an auth dependency exists, not a redesign.
- The uncommitted logging setup (`main.py:12-16`) already gives auth work a place to log `login`/`logout`/`authentication failure` events per `docs/02` §19's requirement, without needing new logging infrastructure.
- `gym_trainer.session`/`gym_trainer.state` already separate "session" from "rep state" conceptually (`gym_trainer.py:402-438`) — this maps reasonably well onto a future per-user session model, though it will need the multi-tenancy rework described in `TECH_DEBT.md` #2 regardless of auth, since today's globals have no `user_id` concept to attach to at all.

## 3. What should eventually be replaced

- **Nothing existing needs to be *replaced*** — because nothing existing implements auth. This is a pure greenfield addition, not a migration-and-replace situation, from the current codebase's perspective.
- The one thing that will need to change *because of* auth arriving is the global-state model (`gym_trainer.state`/`session`, `main.uploaded_video_path`) — but that change is already required independently by `docs/10` Track 1 Phase 3 (multi-tenancy) before auth even enters the picture. Auth and multi-tenant session isolation should land together or in the order `docs/10` §6 already specifies (session isolation before auth), not auth first against still-global state.

## 4. Preparing for the planned migration

The user has indicated authentication will be migrated later from a separate, existing enterprise project rather than built fresh here. Given that plan, the most useful preparation available *now*, without building any auth code:

1. **Land `docs/10` Track 1 Phase 3 (per-session state isolation) first, independent of auth.** Whatever auth system arrives will need a `user_id` (or equivalent) to key a session store by; building that keyed-store shape now, keyed by an anonymous session ID, means the migration only has to swap the key's source (anonymous session ID → authenticated user ID) rather than build session isolation and auth simultaneously.
2. **Decide the target auth shape before migration day, not during it.** `docs/02` §22 specifies JWT access + refresh tokens with bcrypt/Argon2 password hashing and a `RefreshToken` table (`docs/05` §8) — if the enterprise project being migrated from uses a different shape (e.g., session cookies, OAuth-only, a different token library), that mismatch should be identified and `docs/02`/`docs/05` updated or the incoming code adapted *before* the migration lands, not discovered mid-migration.
3. **`docs/04_API_SPEC.md` §5's endpoint contracts (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`) are a reasonable target regardless of where the implementation code comes from** — they don't need to change to accommodate a migrated implementation, only the internal logic behind them does.

## 5. Risk if auth work starts before its prerequisites

Building JWT auth against the current global-state model would create authenticated users who can still stomp each other's workout state — authentication without per-session isolation is a false sense of security, not real multi-tenancy. This is the concrete reason `docs/10` §6 places its own Phase 3 ahead of `docs/03`'s Phase 2 in the corrected sequencing this audit's `ROADMAP.md` follows.

## 6. Conclusion

Zero existing auth code, zero migration blockers from the current codebase's side, and no reusable auth logic to carry forward. The only actionable pre-migration work is the session-isolation refactor this audit already recommends for independent reasons (see `TECH_DEBT.md` #2, `SCALABILITY_REVIEW.md`).
