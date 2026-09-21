"""Record when a user accepted the Terms of Service and Privacy Policy

Revision ID: 002_add_terms_accepted_at
Revises: 001_initial_schema
Create Date: 2026-09-21 21:00:00.000000

Nullable on purpose: accounts created before acceptance was recorded have no
timestamp, and existing rows must not be back-filled with a consent that was
never given.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_terms_accepted_at'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'terms_accepted_at')
