# REQUEST_FLOW.md

Target request lifecycle for the enterprise architecture, contrasted at each stage with what actually happens today. Two flows are documented: the standard CRUD-ish flow (e.g. "list my workout history") and the workout-live-feedback flow (which involves the CV/AI stages and is architecturally different — a streaming/WebSocket flow, not a request/response one).

---

## 1. Standard flow (e.g. `GET /api/v1/reports/{id}`, `POST /api/v1/organizations`)

```
Client (Next.js / browser)
        │  HTTPS request, Authorization: Bearer <token>
        ▼
API Router (app/api/v1/routers/*.py)
        │  Parses/validates request against a Pydantic schema (app/schemas/)
        ▼
Dependency Injection (app/api/v1/dependencies/)
        │  Resolves: current authenticated user, current org/tenant context,
        │  DB session, and the specific service needed — via FastAPI Depends()
        ▼
Service Layer (app/services/)
        │  Enforces business rules, coordinates 1+ repositories,
        │  may call app/coaching/ for AI-dependent operations
        ▼
Repository Layer (app/repositories/)
        │  Executes typed queries against app/models/ via SQLAlchemy 2 session
        ▼
Database (PostgreSQL)
        │  Returns rows
        ▼
Repository Layer
        │  Maps rows → domain objects, returns to Service
        ▼
Service Layer
        │  Applies business logic to results (aggregation, authorization checks
        │  on returned data, e.g. "does this report belong to this org")
        ▼
Response DTO (app/schemas/)
        │  Service result serialized into the response schema
        ▼
API Router
        │  Wraps in {"success": true, "data": {...}} envelope (docs/02 §18)
        ▼
Client
        │  Receives typed, versioned, consistently-shaped JSON
```

### Stage-by-stage explanation

1. **Client → API Router.** The client never talks to a service or repository directly — this boundary is currently violated in spirit (not literally, since there's no service layer to bypass yet) by `main.py`'s routes calling `gt.state`/`gt.session` globals directly (`main.py:70-86`). In the target flow, routers only translate HTTP ↔ Pydantic schemas.
2. **API Router → Dependency Injection.** `Depends()` resolves cross-cutting needs once per request: who is calling (auth), which tenant they belong to (multi-tenancy — see `middleware/tenant_context.py` in `PACKAGE_RESTRUCTURE_PLAN.md`), and a DB session scoped to the request's lifetime. None of this exists today; `main.py` has zero `Depends()` usage.
3. **DI → Service Layer.** Services receive already-resolved dependencies, never raw `Request` objects (`docs/02` §16: "Services should not access request objects"). The service is where `docs/07` §8's business-logic rules live — e.g. `WorkoutService` deciding whether a session can be started, not the router.
4. **Service → Repository.** Repositories are the *only* place SQL/ORM queries appear (`docs/07` §9). A service asking for "this user's last 10 workouts" calls a typed repository method, never constructs a query itself.
5. **Repository → Database.** Standard SQLAlchemy 2 async session usage against PostgreSQL.
6. **Database → Repository → Service.** Rows come back as ORM objects; the repository's job ends at returning domain objects, not DTOs — DTO shaping is a Service/Router concern, not a Repository one, to keep repositories reusable across different response shapes.
7. **Service → Response DTO.** The service's return value is mapped into a Pydantic response schema — this is also where the `{success, data}` vs `{success: false, error}` envelope decision is made, centrally, not per-route.
8. **Router → Client.** The router's only remaining job is returning the DTO with the correct HTTP status code.

---

## 2. Live workout flow (webcam/AI path) — a different shape

This flow is NOT a simple request/response and should not be forced into the diagram above. It's the one flow where `docs/06_AI_SPEC.md`'s two-layer AI architecture (CV Engine → AI Coach) is actually exercised, and where `docs/10`'s WebSocket rework (Phase 1/2 of `ROADMAP.md`) changes the transport entirely.

```
Client (browser)
   │  getUserMedia() captures local camera; canvas encodes JPEG frames
   ▼
WebSocket connection (app/api/v1/routers/workouts.py — persistent, not request/response)
   │  Each frame: decoded server-side (cv2.imdecode)
   ▼
Dependency Injection (resolved ONCE at connection open, not per frame)
   │  Current user, current session key (docs/10 Track1 Phase 3's session-isolation store)
   ▼
Service Layer (WorkoutService / CoachingService)
   │  Routes the frame to the CV engine; NEVER routes raw frames to the AI Coach
   ▼
computer_vision/engine.py  (≡ today's gym_trainer.process_frame(), UNCHANGED logic)
   │  Pose detection → angle calc → rep state machine → form scoring
   │  Output: structured metrics only (reps, stage, form_metrics, violations)
   ▼
Repository Layer (per-frame; batched, not written every frame — docs/05 §11)
   │  In-memory session store today; PostgreSQL write on session completion (Phase 6)
   ▼
[On set/session completion only — NOT every frame]
   ▼
coaching/ (≡ today's ai_trainer.py, refactored)
   │  Receives ONLY structured metrics dict — never the frame, never landmarks
   │  Calls Groq, validates JSON response (target state — see AI_REVIEW.md §2), retries/falls back
   ▼
Repository Layer
   │  Persists AIReport
   ▼
Response DTO
   │  Sent back over the SAME WebSocket connection (not a new HTTP response)
   ▼
Client
   │  Renders annotated frame / live metrics + eventually the AI report
```

### Why this flow is different, and why that's correct

- **Per-frame, the loop never touches a database or the LLM** — this matches `docs/05` §11's explicit guidance ("avoid excessive database writes during real-time processing... prioritize smooth real-time performance over immediate persistence") and `docs/06` §2's CV-then-AI layering.
- **The CV engine's function signature and internal logic are unchanged** from `gym_trainer.process_frame()` today — this flow diagram is describing new plumbing *around* an old, preserved core, not a rewrite of the core itself. This is the concrete way `REFACTORING_BLUEPRINT.md`'s "preserve working systems" principle plays out in the request-flow design.
- **Session-key resolution happens once per connection, not once per frame** — a performance-relevant detail: repeatedly resolving tenant/auth context per video frame (30+ times/second) would be wasteful; resolving it once at WebSocket handshake and reusing it for the connection's lifetime is the correct DI pattern here, distinct from the per-request DI resolution in the standard flow.

## 3. What exists today, mapped onto these diagrams

| Target stage | Today's equivalent |
|---|---|
| API Router | `main.py`'s route functions directly |
| Dependency Injection | None — routes read `gt.state`/`gt.session` module globals directly |
| Service Layer | None — route bodies contain the little business logic that exists (e.g. `main.py:106-117`'s all-sets-done check) |
| Repository Layer | None — no persistence exists |
| Database | None |
| computer_vision/ | `gym_trainer.process_frame()` — functionally equivalent already, just not relocated |
| coaching/ | `ai_trainer.py` — functionally present but with the free-text output gap noted in `AI_REVIEW.md` §2 |
| Response DTO / envelope | None — routes return ad hoc JSON shapes (`API_REVIEW.md` §2) |
