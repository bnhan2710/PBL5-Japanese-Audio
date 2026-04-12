"""add script_text to questions

Revision ID: aa11bb22cc33
Revises: f8a1b2c3d4e5
Create Date: 2026-04-12 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa11bb22cc33'
down_revision: Union[str, None] = 'f8a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('questions')}
    if 'script_text' not in columns:
        op.add_column('questions', sa.Column('script_text', sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('questions')}
    if 'script_text' in columns:
        op.drop_column('questions', 'script_text')
