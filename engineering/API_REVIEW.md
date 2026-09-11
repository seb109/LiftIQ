# API_REVIEW.md

Every endpoint that exists in the repository today, as actually implemented in `main.py`. Compared against `docs/04_API_SPEC.md` where relevant — but note `docs/04` specifies an almost entirely different API surface (`/auth/*`, `/users/*`, `/sessions/*`, `/reports/*`, `/dashboard`, `/posture/*` under an `/api/v1` prefix) that does not exist yet. This table documents what *is* callable right now.

## 1. Endpoint table

| Method | Route | Auth | Request | Response | Error handling | Source |
|---|---|---|---|---|---|---|
| GET | `/` | None | — | `text/html` (Jinja2 render of `index.html`) | None needed | `main.py:27-29` |
| GET | `/health` | None | — | `{"status": "ok"|"error", "checks": {"mediapipe_pose_loaded": bool}}`, HTTP 200 or 503 | Trivial — see `BACKEND_REVIEW.md` §5 on check weakness | `main.py:34-41` |
| GET | `/version` | None | — | `{"version": "0.1.0"}` | None needed | `main.py:44-46` |
| POST | `/start_session` | None | `{"exercise": str, "target_reps": int, "target_sets": int}` — **untyped `dict`, no Pydantic model, no validation of `exercise` against the six supported values** | `{"status": "ok"}` | None — an invalid/unsupported `exercise` string will raise `KeyError` inside `gym_trainer.start_session()` → `EXERCISES[exercise]` (`gym_trainer.py:856`), producing an unhandled 500 | `main.py:51-57` |
| GET | `/stats` | None | — | Flat JSON: `counter`, `stage`, `feedback`, `ai_feedback`, `exercise`, `session_active`, `session_complete`, `current_set`, `target_sets`, `target_reps`, `completed_sets`, `is_resting`, `rest_remaining`, `set_feedback`, `session_summary` | None — reads global state, can't meaningfully fail except if called before any session starts (returns defaults, not an error) | `main.py:60-86` |
| GET | `/get_set_feedback` | None | — | `{"feedback": str}` (empty string if no completed sets yet) | **None around the Groq calls** — see `AI_REVIEW.md` §4 / `BACKEND_REVIEW.md` §4 | `main.py:89-120` |
| GET | `/webcam_feed` | None | — | `multipart/x-mixed-replace` MJPEG stream | Logs open failure, returns empty stream; no client-facing error status distinguishing "camera unavailable" from "stream ended normally" | `main.py:146-151`, `webcam_stream()` at `125-143` |
| POST | `/upload_video` | None | `multipart/form-data`, field `file` | `{"status": "ok"}` | **No size limit, no content-type/MIME validation, no exercise-of-video validation.** Filename extension is trusted for the temp-file suffix (`main.py:193`) | `main.py:190-198` |
| GET | `/uploaded_feed` | None | — | `multipart/x-mixed-replace` MJPEG stream, or `{"error": "No video uploaded"}` if none | The "no video" case returns 200 with an error body rather than a proper 4xx status — inconsistent with `docs/02` §18's error envelope and with plain HTTP convention | `main.py:201-208` |

## 2. Contract deviations from `docs/04_API_SPEC.md`

| `docs/04` requirement | Actual |
|---|---|
| `/api/v1` base path | No versioning prefix on any route |
| `{"success": true/false, "data"/"error": {...}}` envelope | Every route returns a bare, ad hoc JSON shape; no route uses this envelope |
| JWT `Authorization: Bearer` on protected endpoints | No auth exists; every route is open |
| Pydantic request/response models for every endpoint | Only FastAPI's automatic response serialization is used; `/start_session`'s request body is a raw `dict`, not validated |
| Standard status codes (400/401/403/404/409/422/429) | Only ever 200, 503 (`/health` only), and FastAPI's default 500/422 for unhandled exceptions — no route explicitly returns 400/401/403/404/409/429 |
| Pagination (`page`/`limit`/`total`/`total_pages`) | Not applicable yet — no list endpoints exist (no sessions/reports history) |
| OpenAPI documentation matching the spec | FastAPI's `/docs` auto-generates from the actual (undocumented-parameter) routes; it will reflect the real, spec-diverging API, not `docs/04`'s target — not itself a bug, just confirmation that no manual OpenAPI curation has happened |

## 3. Validation gaps worth flagging explicitly

1. `/start_session`'s `exercise` field is not validated against `gym_trainer.EXERCISES.keys()` before use — passing an unsupported string produces an unhandled `KeyError` → 500, not a clean 422/400 with a message. This is the most concrete "add input validation" fix available with zero risk to the regression-protected CV engine, since it only requires a check in `main.py`, not in `gym_trainer.py`.
2. `/upload_video` has no upload size cap and trusts the client-supplied filename's extension. `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` §3.7 already flags this as a Track 1 Phase 4 item; this review confirms it's still open.
3. `target_reps`/`target_sets` in `/start_session` are cast with `int(...)` (`main.py:54-55`) with no bounds checking — a client sending `target_reps: -5` or `target_reps: 999999999` will be accepted and passed straight into the rep-counting state machine, which has no defensive bounds of its own either.

## 4. Summary

The API today is a small, honest, unauthenticated prototype surface. It is not yet meaningfully comparable to `docs/04`'s target contract — that comparison will become actionable once `docs/03` Phase 1-3 backend foundation work begins. The three validation gaps in §3 are independent of that larger rebuild and could be closed at any time without touching `gym_trainer.py`.
