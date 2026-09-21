# SECURITY_REVIEW.md

Evaluated against `docs/09_DEPLOYMENT_AND_TESTING.md` §14's security checklist and `CODEX.md`'s Security section.

> **Status note (2026-09-21).** This review was written against the single-process prototype. The findings below are kept as originally written; where the current code differs, a **Current status** block follows the finding. Only the authentication findings for the legacy workout endpoints (`/start_session`, `/end_session`, `/webcam_feed`, `/upload_video`, `/uploaded_feed`) and the upload-handling finding have been re-reviewed. The checklist rows for HTTPS, JWT, refresh tokens, password hashing, SQL injection, CORS and rate limiting predate the JWT/database work and have **not** been re-evaluated here.

## 1. Checklist against `docs/09` §14

| Item | Status |
|---|---|
| HTTPS enabled | ☐ Not applicable yet — no deployment exists; local dev only |
| JWT validated | ☐ No auth exists at all |
| Refresh tokens hashed | ☐ No auth exists |
| Passwords hashed | ☐ No auth exists |
| SQL injection prevented | ☐ N/A — no database exists yet, so no SQL surface to protect |
| XSS mitigated | ⚠️ Partial — `templates/index.html`'s JS writes some server-influenced strings (`data.feedback`, `data.ai_feedback`, `data.set_feedback`, `data.session_summary`) into the DOM via `.textContent` (safe) in most places, but `updateSetsTracker()` (`templates/index.html:543-558`) builds rows via `row.innerHTML = \`...${completed.reps_completed}...\`` — the interpolated values are numbers from trusted internal state today, not user input, so this is not currently exploitable, but it's a pattern that would become an XSS vector the moment any of that data becomes user-influenced (e.g. once workout history free-text notes exist) |
| CORS configured | ☐ No CORS middleware configured anywhere — fine today since frontend and backend share an origin, will need explicit configuration the moment a separate frontend origin exists |
| Environment variables secured | ✅ `.env` is gitignored (`.gitignore`); no secrets found hardcoded in any tracked file |
| No secrets in repository | ✅ Confirmed by inspection of all tracked files |
| Rate limiting enabled | ☐ None exists anywhere |

## 2. Findings, ranked

### High — Unauthenticated, unmetered access to a paid external API
`GET /get_set_feedback` (`main.py:89-120`) triggers Groq calls with no authentication and no rate limit. Any visitor to a public deployment can call this endpoint repeatedly (it doesn't even require an active session to return `{"feedback": ""}` cheaply, but with an active session it will call Groq on every invocation) to run up API spend against `GROQ_API_KEY`. This is the most concrete, exploitable issue in the current codebase in the event of a public deployment. See `docs/10` §3.9 and `TECH_DEBT.md` #11.

**Current status:** the authentication half of this finding is closed. `GET /get_set_feedback` now requires a valid Bearer token and ownership of the `session_id` (`Depends(get_current_user)` plus `_require_owned_session`). The absence of a rate limit is unchanged: an authenticated user with an active session can still trigger a Groq call on every request.

### High — Every endpoint is open
No route in `main.py` requires authentication, including the ones that mutate global state (`/start_session`, `/upload_video`) — any visitor can reset or hijack whatever workout another visitor has in progress (compounded by `TECH_DEBT.md` #2's lack of multi-tenancy — there's only one workout to hijack, which makes this worse, not better).

**Current status: closed for the workout endpoints.** Sessions are now isolated per workout (`WorkoutSessionState` keyed by `session_id`), and every legacy workout route requires authentication and session ownership:

| Endpoint | Method | Protection |
|---|---|---|
| `/start_session` | POST | Bearer token + owned `session_id` (JSON body). Requires an existing `WorkoutSession` row from `POST /api/v1/sessions/start`; it no longer mints its own id. |
| `/end_session` | POST | Bearer token + owned `session_id` (JSON body). Also deletes that session's temporary upload. |
| `/webcam_feed` | GET | Bearer token + owned `session_id` (query). |
| `/upload_video` | POST | Bearer token + owned `session_id` (query); see the upload finding below for the size and type limits. |
| `/uploaded_feed` | GET | Bearer token + owned `session_id` (query). |

- Missing credentials return `401`. A missing, malformed or other user's `session_id` returns `404` (the same "not found" as elsewhere, so ownership cannot be probed).
- The ownership check is a synchronous dependency (`_owned_session_id`, or a plain `def` handler), so its database query runs on the thread pool and does not block the event loop.
- Covered by `tests/test_legacy_endpoints.py`.
- Still intentionally public: `GET /` (the legacy page), `GET /health`, `GET /version`. `/get_set_feedback` and `/stats` were already protected, and `/ws/webcam` authenticates via its `token` query parameter and session ownership.

Remaining caveats:
- `/webcam_feed` and `/uploaded_feed` are streams that the legacy `templates/index.html` loads through `<img src>`, which cannot send an `Authorization` header. The legacy page therefore cannot use them, and it was already unable to use `/stats`, `/get_set_feedback` or `/ws/webcam` without a token. The Next.js frontend does not call any of these five endpoints.
- `video_stream()` (used by `/uploaded_feed`) runs `process_frame` without taking the per-session lock that the WebSocket path holds. An owner who streams an upload and a live camera into the same session at once could race on the shared MediaPipe tracker. This is a robustness issue for the owner's own session, not a cross-user one.

### Medium — Unvalidated file upload
`upload_video()` (`main.py:190-198`) accepts any `UploadFile` with no size cap and no content-type/MIME validation, writing it to a temp file whose suffix is taken directly from the client-supplied filename (`os.path.splitext(file.filename)[1]`, `main.py:193`). `tempfile.NamedTemporaryFile` generates a safe random base name, so this is not a path-traversal vector, but the lack of a size limit is a straightforward resource-exhaustion vector (a visitor can upload arbitrarily large files, each written fully to local disk before any processing occurs), and the lack of content-type validation means a non-video file will only fail later, inside `cv2.VideoCapture`, rather than being rejected immediately with a clear error.

**Current status: mitigated, with residual risk.** `/upload_video` is now authenticated (see above) and:
- The filename extension must be one of `.mp4 .mov .m4v .avi .mkv .webm` (case-insensitive), otherwise `415`.
- The file is read in 1 MB chunks and capped at 100 MB (`MAX_UPLOAD_BYTES`), otherwise `413`; any failure deletes the partial temp file, and a replacement upload deletes the previous temp file.
- Because FastAPI parses and spools a multipart body to disk *before* any handler runs, a small ASGI guard (`app/core/upload_limit.py`) sits in front of this one route. It answers `401` when there is no `Authorization` header and `413` when the body exceeds the limit (by `Content-Length`, or by counting streamed bytes) without reading the rest. WebSocket and all other routes bypass it.

Residual risk:
- The guard checks that an `Authorization` header is *present*, not that the token is valid, so a caller holding any bearer string can still make the server read up to about 100 MB before the real token check returns `401`.
- The type check is by extension only; content is not sniffed, so a non-video file still fails later inside `cv2.VideoCapture`, and untrusted media reaches OpenCV's decoders.
- There is no per-user quota or rate limit on uploads.

### Medium — No CORS policy
Not exploitable today (same-origin), but must be explicitly configured, not left as FastAPI's default, the moment a separate frontend origin exists (Next.js on Vercel, per the target architecture) — an overly permissive default (`allow_origins=["*"]`) combined with any future cookie-based auth would be a real cross-origin risk.

### Low — No startup validation of required secrets
`ai_trainer.py:10` constructs `AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))` unconditionally — if the env var is unset, this succeeds silently and only fails on the first actual API call. `docs/09` §16 requires the app to "fail fast if critical configuration is missing." Not a vulnerability by itself, but it delays discovery of a misconfigured deployment until a user-facing request fails.

### Low — XSS pattern worth hardening pre-emptively
See the `innerHTML` usage noted in the checklist table above — not currently exploitable, but worth switching to `textContent`/`createTextNode` before any user-generated content (workout notes, custom exercise names, etc.) is added to that same code path.

### Informational — Good practices already in place
- Secrets are correctly kept out of the repository and out of version control.
- The recently added (uncommitted) structured logging does not log secrets, tokens, or request bodies containing sensitive data — consistent with `docs/02` §19 and `docs/09` §15.
- The CV/AI boundary (see `AI_REVIEW.md` §1) already prevents the highest-value data (raw video/images) from ever reaching a third-party API, which is itself a meaningful data-minimization security property, not just an architecture nicety.

## 3. Priority for remediation

If a public deployment were imminent, the two High findings (§2) would need to be closed first — specifically, some minimal rate limit on `/get_set_feedback` and *some* form of session/access gating (even a lightweight one, ahead of full JWT auth) — before anything else in this list, because they're the only two with a direct, immediate cost/abuse impact rather than a latent one.

**Current status:** the access-gating half is done (see the two **Current status** blocks above). A rate limit on `/get_set_feedback` and on uploads is still outstanding.
