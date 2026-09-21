"""Clear form scores that were stored as joint angles by the old workout-stop code

Revision ID: 003_null_legacy_form_scores
Revises: 002_add_terms_accepted_at
Create Date: 2026-09-21 22:00:00.000000

Background
----------
Before this revision, POST /api/v1/sessions/{id}/stop persisted each rep's minimum joint
angle in DEGREES (gym_trainer "depths") into ``exercise_metrics.form_score``, and the mean of
those angles into ``workout_sessions.average_form_score`` / ``overall_score``. It also wrote the
note ``Set N rep depth score X%``, presenting the angle as a percentage. None of that is a 0-100
form score (a perfect bicep curl reaches about 45 degrees), so every value written that way is
wrong. The real per-rep scores were never stored and cannot be reconstructed.

What this revision changes
--------------------------
* ``workout_sessions.average_form_score`` and ``overall_score`` -> NULL for affected sessions.
* ``exercise_metrics.form_score`` -> NULL for affected metric rows.
* ``exercise_metrics.correction_message`` for rows written by the old code only:
  ``Set N rep depth score X%``  ->  ``Set N rep depth X degrees (historical measurement)``.
  The number is carried over unchanged (same digits, same ``.1f`` formatting); only the unit
  and label change, so the old depth reading is no longer presented as a percentage.

Nothing else is touched: total_reps, duration_seconds, exercise, timestamps, every other metric
column, notes on rows that are already in the new format, and ``ai_reports`` rows are left
exactly as they are. Notes that do not have the old shape are left alone.

Which rows are "affected"
-------------------------
The fixed stop endpoint writes each metric note as ``Set N rep depth X degrees``. A metric is
legacy unless its note has that shape, and a session is legacy unless it has at least one metric
with that shape. The rewritten historical note ends in ``(historical measurement)``, so it is
never mistaken for a new-format note. Because the test is per row, running this revision *after*
the fixed backend has been deployed cannot erase correct scores that new sessions have already
produced.

Reversibility
-------------
The original values of every row that is changed are copied into two side tables first
(``workout_sessions_legacy_scores_003`` and ``exercise_metrics_legacy_scores_003``, the latter
holding both the original ``form_score`` and the original ``correction_message``).
``downgrade()`` restores them and drops the side tables. Note that this restores the old,
incorrect values: it exists so the change can be undone, not because they are valid. While the
side tables exist they hold those old values; drop them in a later revision once the change has
been accepted.
"""
import logging
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003_null_legacy_form_scores'
down_revision: Union[str, None] = '002_add_terms_accepted_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

SESSIONS_BACKUP = 'workout_sessions_legacy_scores_003'
METRICS_BACKUP = 'exercise_metrics_legacy_scores_003'

# Note written by the fixed code. '%' matches any text (Set number, angle).
NEW_NOTE_PATTERN = 'Set % rep depth % degrees'
# Note written by the old code, e.g. "Set 1 rep depth score 44.0%".
OLD_NOTE_PATTERN = 'Set % rep depth score %'
OLD_NOTE_RE = re.compile(r'^Set (\d+) rep depth score (-?\d+(?:\.\d+)?)%$')


def _historical_note(old_note: str):
    """Old note -> explicit historical-degrees wording, or None if it is not the old shape."""
    match = OLD_NOTE_RE.match(old_note)
    if match is None:
        return None
    set_number, depth = match.groups()
    return f"Set {set_number} rep depth {depth} degrees (historical measurement)"


def upgrade() -> None:
    bind = op.get_bind()
    params = {"new_note": NEW_NOTE_PATTERN, "old_note": OLD_NOTE_PATTERN}

    op.create_table(
        SESSIONS_BACKUP,
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('average_form_score', sa.Float(), nullable=True),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('session_id'),
    )
    op.create_table(
        METRICS_BACKUP,
        sa.Column('metric_id', sa.UUID(), nullable=False),
        sa.Column('form_score', sa.Float(), nullable=True),
        sa.Column('correction_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('metric_id'),
    )

    # 1. Save the original values of exactly the rows that are about to change.
    bind.execute(sa.text(f"""
        INSERT INTO {SESSIONS_BACKUP} (session_id, average_form_score, overall_score)
        SELECT ws.id, ws.average_form_score, ws.overall_score
        FROM workout_sessions ws
        WHERE (ws.average_form_score IS NOT NULL OR ws.overall_score IS NOT NULL)
          AND NOT EXISTS (
              SELECT 1 FROM exercise_metrics m
              WHERE m.session_id = ws.id AND m.correction_message LIKE :new_note
          )
    """), params)
    bind.execute(sa.text(f"""
        INSERT INTO {METRICS_BACKUP} (metric_id, form_score, correction_message)
        SELECT m.id, m.form_score, m.correction_message
        FROM exercise_metrics m
        WHERE (m.form_score IS NOT NULL
               AND (m.correction_message IS NULL OR m.correction_message NOT LIKE :new_note))
           OR m.correction_message LIKE :old_note
    """), params)

    # 2. Clear the scores. Every backed-up metric row is legacy: a row is only backed up if it
    #    has a non-new-format note, so a correct new-format score can never be in this set.
    sessions_cleared = bind.execute(sa.text(f"""
        UPDATE workout_sessions
        SET average_form_score = NULL, overall_score = NULL
        WHERE id IN (SELECT session_id FROM {SESSIONS_BACKUP})
    """)).rowcount
    metrics_cleared = bind.execute(sa.text(f"""
        UPDATE exercise_metrics
        SET form_score = NULL
        WHERE id IN (SELECT metric_id FROM {METRICS_BACKUP})
    """)).rowcount

    # 3. Reword the old notes. The originals were saved in step 1; the digits are preserved.
    metrics = sa.table('exercise_metrics', sa.column('id', sa.UUID()), sa.column('correction_message', sa.Text()))
    backup = sa.table(METRICS_BACKUP, sa.column('metric_id', sa.UUID()), sa.column('correction_message', sa.Text()))
    legacy_notes = bind.execute(
        sa.select(backup.c.metric_id, backup.c.correction_message)
        .where(backup.c.correction_message.like(OLD_NOTE_PATTERN))
    ).all()
    rewrites = []
    for metric_id, note in legacy_notes:
        new_note = _historical_note(note)
        if new_note is not None:
            rewrites.append({"b_id": metric_id, "b_note": new_note})
    if rewrites:
        bind.execute(
            sa.update(metrics)
            .where(metrics.c.id == sa.bindparam("b_id"))
            .values(correction_message=sa.bindparam("b_note")),
            rewrites,
        )

    logger.info(
        "003: cleared legacy form scores on %s workout_sessions and %s exercise_metrics rows; "
        "reworded %s of %s legacy metric notes",
        sessions_cleared, metrics_cleared, len(rewrites), len(legacy_notes),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table(SESSIONS_BACKUP):
        bind.execute(sa.text(f"""
            UPDATE workout_sessions
            SET average_form_score = (
                    SELECT b.average_form_score FROM {SESSIONS_BACKUP} b
                    WHERE b.session_id = workout_sessions.id),
                overall_score = (
                    SELECT b.overall_score FROM {SESSIONS_BACKUP} b
                    WHERE b.session_id = workout_sessions.id)
            WHERE id IN (SELECT session_id FROM {SESSIONS_BACKUP})
        """))
        op.drop_table(SESSIONS_BACKUP)
    else:
        logger.warning("003 downgrade: %s is missing, session scores cannot be restored", SESSIONS_BACKUP)

    if inspector.has_table(METRICS_BACKUP):
        # Restores both columns from the backup: rows whose score or note was not changed by the
        # upgrade were saved with their original (identical) values, so this is exact.
        bind.execute(sa.text(f"""
            UPDATE exercise_metrics
            SET form_score = (
                    SELECT b.form_score FROM {METRICS_BACKUP} b
                    WHERE b.metric_id = exercise_metrics.id),
                correction_message = (
                    SELECT b.correction_message FROM {METRICS_BACKUP} b
                    WHERE b.metric_id = exercise_metrics.id)
            WHERE id IN (SELECT metric_id FROM {METRICS_BACKUP})
        """))
        op.drop_table(METRICS_BACKUP)
    else:
        logger.warning("003 downgrade: %s is missing, metric scores and notes cannot be restored", METRICS_BACKUP)
