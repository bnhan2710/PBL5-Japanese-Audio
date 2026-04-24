"""add_competency_analysis

Revision ID: cc281bdd0a68
Revises: 19264cd7d89b
Create Date: 2026-04-10 23:45:12.405729

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'cc281bdd0a68'
down_revision: Union[str, None] = '19264cd7d89b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("competency_analysis"):
        op.create_table(
            "competency_analysis",
            sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("result_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("overview", sa.Text(), nullable=True),
            sa.Column("strengths", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("weaknesses_analysis", sa.Text(), nullable=True),
            sa.Column("actionable_advice", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
            sa.ForeignKeyConstraint(["result_id"], ["user_results.result_id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("analysis_id"),
            sa.UniqueConstraint("result_id"),
        )

    existing_indexes = {index["name"] for index in inspector.get_indexes("competency_analysis")}
    index_name = op.f("ix_competency_analysis_analysis_id")
    if index_name not in existing_indexes:
        op.create_index(index_name, "competency_analysis", ["analysis_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("competency_analysis"):
        existing_indexes = {index["name"] for index in inspector.get_indexes("competency_analysis")}
        index_name = op.f("ix_competency_analysis_analysis_id")
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name="competency_analysis")
        op.drop_table("competency_analysis")
