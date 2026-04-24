"""add system_feedbacks

Revision ID: c5f12a99d0ab
Revises: aa11bb22cc33
Create Date: 2026-04-12 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c5f12a99d0ab"
down_revision: Union[str, None] = "aa11bb22cc33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("system_feedbacks"):
        op.create_table(
            "system_feedbacks",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("rating_score", sa.Integer(), nullable=False),
            sa.Column("feedback_tags", sa.JSON(), nullable=True),
            sa.Column("comment_text", sa.Text(), nullable=True),
            sa.Column("source_page", sa.String(length=255), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = {index["name"] for index in inspector.get_indexes("system_feedbacks")}
    index_name = op.f("ix_system_feedbacks_id")
    if index_name not in existing_indexes:
        op.create_index(index_name, "system_feedbacks", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("system_feedbacks"):
        existing_indexes = {index["name"] for index in inspector.get_indexes("system_feedbacks")}
        index_name = op.f("ix_system_feedbacks_id")
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name="system_feedbacks")
        op.drop_table("system_feedbacks")
