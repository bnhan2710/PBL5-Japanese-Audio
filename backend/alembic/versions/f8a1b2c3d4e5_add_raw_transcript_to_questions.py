"""add raw_transcript to questions

Revision ID: f8a1b2c3d4e5
Revises: 96adaa7179bf
Create Date: 2026-04-12 13:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a1b2c3d4e5'
down_revision: Union[str, None] = '96adaa7179bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('questions', sa.Column('raw_transcript', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('questions', 'raw_transcript')
