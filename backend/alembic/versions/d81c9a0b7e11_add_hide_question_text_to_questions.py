"""add hide_question_text to questions

Revision ID: d81c9a0b7e11
Revises: c5f12a99d0ab
Create Date: 2026-04-12 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd81c9a0b7e11'
down_revision: Union[str, None] = 'c5f12a99d0ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('questions')}
    if 'hide_question_text' not in columns:
        op.add_column(
            'questions',
            sa.Column('hide_question_text', sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column('questions', 'hide_question_text', server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('questions')}
    if 'hide_question_text' in columns:
        op.drop_column('questions', 'hide_question_text')
