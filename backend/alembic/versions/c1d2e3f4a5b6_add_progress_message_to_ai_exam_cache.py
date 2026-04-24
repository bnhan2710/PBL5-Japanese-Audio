"""add progress message to ai exam cache

Revision ID: c1d2e3f4a5b6
Revises: 7c3e1f9d5a2b
Create Date: 2026-04-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "19264cd7d89b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_exam_cache", sa.Column("progress_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_exam_cache", "progress_message")
