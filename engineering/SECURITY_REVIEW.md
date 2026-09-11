# SECURITY_REVIEW.md

Evaluated against `docs/09_DEPLOYMENT_AND_TESTING.md` §14's security checklist and `CODEX.md`'s Security section.

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

### High — Every endpoint is open
No route in `main.py` requires authentication, including the ones that mutate global state (`/start_session`, `/upload_video`) — any visitor can reset or hijack whatever workout another visitor has in progress (compounded by `TECH_DEBT.md` #2's lack of multi-tenancy — there's only one workout to hijack, which makes this worse, not better).

### Medium — Unvalidated file upload
`upload_video()` (`main.py:190-198`) accepts any `UploadFile` with no size cap and no content-type/MIME validation, writing it to a temp file whose suffix is taken directly from the client-supplied filename (`os.path.splitext(file.filename)[1]`, `main.py:193`). `tempfile.NamedTemporaryFile` generates a safe random base name, so this is not a path-traversal vector, but the lack of a size limit is a straightforward resource-exhaustion vector (a visitor can upload arbitrarily large files, each written fully to local disk before any processing occurs), and the lack of content-type validation means a non-video file will only fail later, inside `cv2.VideoCapture`, rather than being rejected immediately with a clear error.

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
