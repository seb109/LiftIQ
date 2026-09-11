# AI_REVIEW.md

## 1. Two-layer architecture, correctly separated

`CODEX.md`'s AI Rules and `docs/06_AI_SPEC.md` §2-3 both mandate a hard boundary: the Computer Vision Engine owns pose estimation, joint angles, rep counting, and posture analysis; the LLM only ever receives structured numeric metrics and is responsible for coaching language, never raw images and never CV logic. **This boundary is correctly implemented today.**

- `gym_trainer.py` never imports or references `ai_trainer.py`, Groq, or anything AI-related. All CV/rep-counting/form-scoring logic (`process_frame()`, `compute_form_metrics()`, `evaluate_form_violations()`, `compute_rep_form_score()`) is self-contained.
- `ai_trainer.py` never imports `cv2`, `mediapipe`, or touches a frame. Its two functions, `get_set_feedback(session)` (`ai_trainer.py:13-39`) and `get_session_summary(session)` (`ai_trainer.py:42-87`), each receive a plain Python dict built entirely from `gym_trainer.session`/a locally-constructed `feedback_session` dict (`main.py:94-102`) — exercise name, set numbers, depth-angle lists, rep-time lists. No image bytes, no landmarks, no frame data crosses this boundary at any point.
- No PII crosses the boundary either — `docs/06` §6 and §15 require this, and the payload genuinely contains nothing but exercise metrics.

This is the strongest compliance finding in the audit: a real architectural rule, actively enforced by the code as written, not just documented.

## 2. Where the implementation diverges from `docs/06_AI_SPEC.md`

`docs/06` §8 mandates the LLM "must always return valid JSON" matching a specific schema (`overall_score`, `form_score`, `strengths[]`, `mistakes[]`, `improvements[]`, `coach_summary`, `next_session_focus`, `motivation`), validated before storage (§9), with retry-then-fallback error handling (§13), prompt versioning (§17), and 0-100 numeric scoring (§10).

The actual prompts (`ai_trainer.py:15-29` and `ai_trainer.py:56-77`) request **free-form natural-language coaching text**, explicitly telling the model to "Format your response naturally like a trainer talking to their client" and to start the session summary with a literal string like `"Performance Score: X/10"` — a human-readable sentence, not a numeric JSON field. There is:

- No JSON parsing anywhere in `ai_trainer.py` or `main.py`.
- No schema validation.
- No retry logic (a failed call now, uncommitted, logs and immediately re-raises — see `main.py:103` calling it with no surrounding try/except, so the exception propagates all the way to an unhandled 500).
- No fallback report template.
- No prompt versioning field recorded anywhere (there's also nowhere to record it, since nothing is persisted — see `DATABASE_REVIEW.md`).
- Scores are out of 10 in the session-summary prompt (`"Performance Score: X/10"`, `ai_trainer.py:76`), not 0-100 as `docs/06` §10 specifies.

**This is a genuine conflict between documentation and implementation, not a partial implementation of the same thing.** Per `CLAUDE.md`'s instruction ("if a doc conflicts with the repo, surface the conflict instead of silently picking one"), this needs an explicit decision before Phase 5 (AI Report System) work begins: either (a) `ai_trainer.py`'s prompts are rewritten to request and parse structured JSON per `docs/06`, which is a real behavior change to the AI layer and should go through the same "before/after" scrutiny as any other production logic change, or (b) `docs/06` is revised to reflect that free-text coaching is an intentional product decision. This audit takes no position on which is correct — only that the gap is total, not partial, and should not be silently resolved during unrelated Phase-5 implementation work.

## 3. Prompt engineering quality (independent of the JSON question)

- Both prompts are concise, specific, and instruct the model toward actionable coaching ("Look for depth consistency, pace changes, and whether they hit target reps" — `ai_trainer.py:27`), consistent with `docs/06` §7's "avoid unnecessary verbosity, focus on actionable coaching."
- `max_tokens` is capped (150 for set feedback, 300 for session summary) — reasonable given `docs/06` §14's <5s response-time target, though no actual latency measurement exists anywhere in the repo to confirm the target is met.
- Model used: `llama-3.1-8b-instant` (both functions) — a real, currently-available Groq model; not a placeholder.
- No hallucination-prevention guardrails are explicit in the prompt text (`docs/06` §12 forbids inventing injuries, diagnosing conditions, recommending medication) — the prompts don't explicitly instruct the model to avoid these, relying entirely on the model's own training rather than a defensive system-prompt constraint. Low risk given the prompt's narrow scope (depth/pace/rep-count feedback), but worth adding as an explicit instruction if this prompt is revised for the JSON-schema question above anyway.

## 4. Error handling — the one concrete bug

As covered in `BACKEND_REVIEW.md` §4: `ai_trainer.py`'s functions now log and re-raise on Groq failure (uncommitted change), but `main.py:103`'s call site (`feedback = await ai.get_set_feedback(feedback_session)`) has no try/except around it. The net effect of the uncommitted change is actually a *regression in user-facing resilience* relative to before the change: previously, an unhandled exception from an un-wrapped `await` would have behaved identically (Python doesn't swallow exceptions on `await` calls by default) — so this isn't a new regression, but it is a pre-existing gap that the recent logging work made *visible* (via `logger.exception`) without actually closing it. `docs/06` §13 and `docs/09` §17 both require retry-then-fallback so "the workout session must never fail because the AI failed." Recommended fix shape (not implemented by this audit, per instructions not to modify code): wrap both call sites in `main.py` with a try/except that logs, retries once, and falls back to a static message (e.g. `"Nice work — feedback is temporarily unavailable."`) rather than propagating.

## 5. Supported exercises vs. `docs/06` §4

`docs/06` §4 lists Squat, Push-up, Deadlift, Shoulder Press, Bicep Curl, Lunge as MVP-supported. All six are configured in `gym_trainer.EXERCISES` and `gym_trainer.FORM_CHECKS` (`gym_trainer.py:34-77`, `92-287`) — full parity here. The gap is regression-test coverage (`shoulder_press` has no baseline video — see `TECH_DEBT.md` #10), not feature coverage.

## 6. Summary

The CV/LLM separation — the one rule `CODEX.md` treats as non-negotiable — is fully respected. The output-contract mismatch against `docs/06`'s JSON schema is total and needs an explicit decision, not a quiet implementation choice, before Phase 5 work starts. The missing error-handling wrap at the `main.py` call site is a small, well-understood, low-risk fix that directly closes a documented requirement (`docs/06` §13 / `docs/09` §17) and doesn't require touching the regression-protected `gym_trainer.py` at all.
