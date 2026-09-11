# DATABASE_REVIEW.md

## 1. Current state: no database exists

There is no SQLAlchemy, no Alembic, no PostgreSQL driver (`psycopg2`/`asyncpg`), no ORM model of any kind anywhere in the repository — confirmed by absence in `requirements.txt`, `requirements-regression.txt`, and every `import` statement across `main.py`, `gym_trainer.py`, `ai_trainer.py`, and `tools/regression_baseline.py`.

## 2. What stands in for a database today

Three in-process Python containers hold everything the target schema (`docs/05_DATABASE_SPEC.md`) would persist:

| In-memory container | Location | Rough equivalent of |
|---|---|---|
| `gym_trainer.state` | `gym_trainer.py:402-417` | A single live row of `ExerciseMetric`-in-progress (counter, stage, form_metrics, form_violations) |
| `gym_trainer.session` | `gym_trainer.py:420-438` | A single live row of `WorkoutSession`-in-progress, plus its child `completed_sets` list |
| `main.uploaded_video_path` | `main.py:23` | Not modeled in `docs/05` at all — a transient file-system reference with no schema equivalent |
| Groq response text (`ai_trainer.py` return values) | Held only in `gt.session["set_feedback"]` / `gt.session["session_summary"]` for the lifetime of the process | The entire `AIReport` table |

None of this survives a process restart. There is no user, no history, no way to answer "what did I do last Tuesday" — because nothing is written anywhere durable.

## 3. Gap against `docs/05_DATABASE_SPEC.md`

| Target table | Exists? | Notes |
|---|---|---|
| `User` | No | No registration/login exists to populate it |
| `WorkoutSession` | No (in-memory equivalent only) | `gym_trainer.session` covers roughly the same fields (`exercise`, timing, sets) but as a transient dict, not a row, and with no `user_id` |
| `ExerciseMetric` | No | Per-rep depth/time/form-score data exists transiently in `session["current_set_depths"]`/`current_set_rep_times"]`/`current_set_form_scores"]` (`gym_trainer.py:427-429`) but is discarded at session end, not written per-rep as the spec's table implies |
| `AIReport` | No | Groq's free-text responses aren't stored anywhere beyond the current session's dict; there's also no `raw_response`/structured-field split since the response isn't structured JSON at all (see `AI_REVIEW.md`) |
| `RefreshToken` | No | No auth exists |

## 4. Design-principle compliance, evaluated in advance

Even though nothing is built, a few of `docs/05`'s principles are worth flagging now, before schema work starts, since they interact with facts already established elsewhere in this audit:

- **UUID primary keys** (`docs/05` §14): straightforward, no blockers.
- **`ExerciseMetric` "should support future expansion without schema redesign"** (`docs/05` §6): the current per-rep data already varies by exercise (squat/lunge track knee angles, deadlift tracks back angle, etc. — see `gym_trainer.py`'s six `_compute_form_metrics_*` functions). A rigid fixed-column `ExerciseMetric` table (as literally listed in `docs/05` §6, with named columns like `left_knee_angle`, `left_elbow_angle`) will not cleanly hold the per-exercise `form_metrics` dicts (`gym_trainer.state["form_metrics"]`) that already exist today, which have different keys per exercise (e.g. `{"forward_lean", "knee_cave"}` for squat vs `{"back_rounding", "bar_drift"}` for deadlift). A JSONB metrics column (matching the pattern `docs/05` §7 already uses for `AIReport.strengths`/`mistakes`/`improvements`) would map onto the real data shape far more directly than the fixed-column design currently specified. **This is a documentation-vs-reality conflict worth resolving explicitly before Phase 3 schema work begins**, per `CLAUDE.md`'s instruction to surface such conflicts rather than silently pick one.
- **"One report per completed session"** (`docs/05` §12): trivial to enforce once `AIReport.session_id` is `UNIQUE` as specified — no conflict.
- **Transactions around workout completion + AI report generation** (`docs/05` §16): today, `main.py:110-117`'s session-completion logic and the Groq call are not wrapped in any transaction (there's no DB yet to wrap), but the *sequencing* bug that would carry forward is worth noting now: `get_session_summary()` is awaited and its result stored *before* any persistence step would occur, so a future implementation must decide whether a Groq failure during session completion should roll back the "session complete" state or not — `docs/09` §17 says the workout should "complete normally" even if Groq fails, which implies session completion and AI-report generation should NOT be one atomic transaction, contradicting a literal reading of `docs/05` §16's list of atomic operations. Flagging this now so Phase 5 (AI Report System) and Phase 3 (Database) aren't implemented independently with incompatible assumptions.

## 5. Conclusion

The database layer is 0% built. The most useful pre-work available before Phase 3 starts isn't schema design in the abstract — it's reconciling `docs/05`'s fixed-column `ExerciseMetric` table against the variable, per-exercise metrics shape `gym_trainer.py` already produces, and reconciling `docs/05`'s "atomic workout completion" language against `docs/09`'s "AI failure must never fail the workout" requirement. Both are documentation-level conflicts, not implementation gaps — worth resolving on paper before the first migration is written.
