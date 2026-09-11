"""Initial schema: Users, WorkoutSessions, ExerciseMetrics, AIReports, RefreshTokens

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-11 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. workout_sessions
    op.create_table(
        'workout_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('exercise', sa.String(length=50), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('total_reps', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('average_form_score', sa.Float(), nullable=True),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('calories_estimate', sa.Float(), nullable=True),
        sa.Column('ai_report_generated', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workout_sessions_exercise'), 'workout_sessions', ['exercise'], unique=False)
    op.create_index(op.f('ix_workout_sessions_started_at'), 'workout_sessions', ['started_at'], unique=False)
    op.create_index(op.f('ix_workout_sessions_user_id'), 'workout_sessions', ['user_id'], unique=False)

    # 3. exercise_metrics
    op.create_table(
        'exercise_metrics',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('rep_number', sa.Integer(), nullable=True),
        sa.Column('stage', sa.String(length=20), nullable=True),
        sa.Column('form_score', sa.Float(), nullable=True),
        sa.Column('left_knee_angle', sa.Float(), nullable=True),
        sa.Column('right_knee_angle', sa.Float(), nullable=True),
        sa.Column('left_elbow_angle', sa.Float(), nullable=True),
        sa.Column('right_elbow_angle', sa.Float(), nullable=True),
        sa.Column('left_shoulder_angle', sa.Float(), nullable=True),
        sa.Column('right_shoulder_angle', sa.Float(), nullable=True),
        sa.Column('correction_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['workout_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_exercise_metrics_session_id'), 'exercise_metrics', ['session_id'], unique=False)
    op.create_index(op.f('ix_exercise_metrics_timestamp'), 'exercise_metrics', ['timestamp'], unique=False)

    # 4. ai_reports
    op.create_table(
        'ai_reports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('form_score', sa.Float(), nullable=True),
        sa.Column('strengths', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('mistakes', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('improvements', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('coach_summary', sa.Text(), nullable=True),
        sa.Column('next_session_focus', sa.Text(), nullable=True),
        sa.Column('motivation', sa.Text(), nullable=True),
        sa.Column('raw_response', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['workout_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id')
    )

    # 5. refresh_tokens
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.Text(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refresh_tokens_expires_at'), 'refresh_tokens', ['expires_at'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_expires_at'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')

    op.drop_table('ai_reports')

    op.drop_index(op.f('ix_exercise_metrics_timestamp'), table_name='exercise_metrics')
    op.drop_index(op.f('ix_exercise_metrics_session_id'), table_name='exercise_metrics')
    op.drop_table('exercise_metrics')

    op.drop_index(op.f('ix_workout_sessions_user_id'), table_name='workout_sessions')
    op.drop_index(op.f('ix_workout_sessions_started_at'), table_name='workout_sessions')
    op.drop_index(op.f('ix_workout_sessions_exercise'), table_name='workout_sessions')
    op.drop_table('workout_sessions')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
