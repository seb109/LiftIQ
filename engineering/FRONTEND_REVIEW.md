# FRONTEND_REVIEW.md

## 1. What exists

One file: `templates/index.html`, 596 lines — inline `<style>` (lines 7-331), inline `<script>` (lines 452-591), no build step, no framework, no package.json, no bundler. Rendered server-side once via Jinja2 (`main.py:27-29`) with no template variables actually used (`templates.TemplateResponse(request, "index.html")` passes no context).

## 2. Screens implemented

Three screens, toggled via CSS class (`.screen.active`), no client-side router:

1. **Setup screen** (`#screen-setup`, lines 336-380) — exercise `<select>` (6 options matching `gym_trainer.EXERCISES` keys exactly), target reps/sets number inputs, webcam/upload mode toggle, file input (hidden unless upload mode selected), start button.
2. **Trainer screen** (`#screen-trainer`, lines 383-435) — `<img id="video-feed">` bound to `/webcam_feed` or `/uploaded_feed`, rest-timer overlay banner, sets-progress list, rep/stage stat cards, live-feedback box, AI-trainer-feedback box.
3. **Session-complete screen** (`#screen-complete`, lines 438-450) — set-by-set reps badges, AI session summary (polled until available), restart button.

Client logic (`<script>`, lines 452-591): `selectMode()`, `showScreen()`, `startSession()` (POSTs `/start_session`, then either sets `video-feed.src` or uploads a file before setting it), `startPolling()`/`updateStats()` (1-second interval hitting `GET /stats`), `updateSetsTracker()`, `showCompleteScreen()` (polls `/stats` again every 1.5s until `session_summary` appears), `newSession()`.

## 3. Comparison against `docs/08_UI_UX_SPEC.md`

| Spec requirement | Present? |
|---|---|
| Next.js / React / TypeScript | No — vanilla Jinja2 + inline JS |
| Color system (`#09090B` background, `#111827` surface, `#2563EB` primary, etc.) | No — actual palette is `#1a1a2e` body / `#16213e` cards / `#0f3460` borders / `#00d4ff` accent, a different design entirely |
| Typography (Geist/Inter, defined H1-Caption scale) | No — `font-family: Arial, sans-serif` (line 11), no defined type scale |
| 8px spacing system | Not formalized — spacing values in the CSS are ad hoc (e.g. `20px`, `32px`, `12px` mixed without a documented base unit) |
| Border radius system (14/14/20/24/24px by component) | Partially coincidental — cards use `16px`/`12px`/`10px`/`8px` variously, not the specified values |
| Framer Motion animations | No — zero animation/transition CSS beyond `transition: opacity 0.2s` on one button hover |
| Landing page (Hero/Features/How It Works/etc.) | No — the app opens directly on the setup screen |
| Auth pages (Login/Register) | No — no auth exists |
| Dashboard (streak, charts, recent workouts, AI recommendation) | No |
| Workout page layout (large camera left, controls right) | **Partially matches** — the trainer screen already uses a left-video/right-panel flex layout (`templates/index.html:386`), coincidentally aligned with `docs/08` §16's intent |
| Report page (charts, PDF download) | No — session summary is a plain text blob (`white-space: pre-wrap`), no charts, no PDF |
| Workout history / Profile page | No — no persistence exists to show history from |
| Recharts-based charts | No charts exist anywhere |
| Camera component overlays (pose landmarks, rep counter, form score baked into the video) | **Yes, but server-side** — `gym_trainer.process_frame()` draws landmarks/HUD directly onto the MJPEG frame with OpenCV (`gym_trainer.py:1074-1097`), rather than the frontend overlaying structured data on a client-rendered video as `docs/08` §21 implies |
| Loading states (skeleton loaders) | No — the "Analyzing your session..." text (line 445) is the only loading affordance in the whole app |
| Empty states | No — not applicable yet (no history/dashboard to be empty) |
| Error states (friendly message + retry) | No — e.g. if `/upload_video` is hit without a file, the only feedback is a native `alert()` (`templates/index.html:487`) |
| Toast notifications | No |
| Responsive breakpoints (Desktop ≥1280px / Tablet / Mobile) | No — `.trainer-layout` is a fixed `max-width: 1100px` flex row with a fixed `280px` side panel and no media queries anywhere in the stylesheet; this layout will not adapt below its content width and has no mobile treatment at all |
| Accessibility (keyboard nav, ARIA labels, contrast, screen readers) | No — no `aria-*` attributes, no semantic landmark elements beyond default `<div>`/`<button>`, exercise `<select>` and inputs have no associated `<label for>` wiring (labels are visually adjacent `<label>` tags without `for`/`id` pairing) |

## 4. What's actually good here

For a prototype whose job is to prove the CV pipeline works end-to-end, the frontend does its job cleanly: the three-screen flow maps exactly to the backend's session lifecycle (`start_session` → poll `/stats` → detect `session_complete` → poll for `session_summary`), the polling logic correctly avoids re-triggering `/get_set_feedback` for the same completed set (`lastSetCount` guard, line 534-537), and the exercise dropdown values are kept in lockstep with `gym_trainer.EXERCISES`' keys with no drift. This is a reasonable, working prototype UI — it is simply not the product described in `docs/08`, and shouldn't be mistaken for a partial implementation of it (it wasn't built against that spec at all).

## 5. Conclusion

`docs/08_UI_UX_SPEC.md` describes a ground-up Next.js/TypeScript rebuild, not an incremental evolution of `templates/index.html`. `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` §7 open decision #5 already flags this exact question ("does the current vanilla-JS UI ship as the public site, rebuilt only for the capture-pipeline change, or does a Next.js rebuild happen before any public launch?") — this review doesn't resolve that decision, it just confirms the gap is real and total. See `ROADMAP.md` Phase 9 for where this work is sequenced.
