"""add notifications table and user_id to ai_exam_cache

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6, b3c4d5e6f7g8
Create Date: 2026-04-24 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = ("c1d2e3f4a5b6", "b3c4d5e6f7g8")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    ai_exam_cache_columns = {column["name"] for column in inspector.get_columns("ai_exam_cache")}
    if "user_id" not in ai_exam_cache_columns:
        op.add_column(
            "ai_exam_cache",
            sa.Column("user_id", sa.Integer(), nullable=True),
        )

    ai_exam_cache_fks = {fk["name"] for fk in inspector.get_foreign_keys("ai_exam_cache")}
    if "fk_ai_exam_cache_user_id" not in ai_exam_cache_fks:
        op.create_foreign_key(
            "fk_ai_exam_cache_user_id",
            "ai_exam_cache",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    ai_exam_cache_indexes = {index["name"] for index in inspector.get_indexes("ai_exam_cache")}
    if "ix_ai_exam_cache_user_id" not in ai_exam_cache_indexes:
        op.create_index("ix_ai_exam_cache_user_id", "ai_exam_cache", ["user_id"])

    if not inspector.has_table("notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("type", sa.String(20), nullable=False, server_default="info"),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("link", sa.String(512), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    notification_indexes = {index["name"] for index in inspector.get_indexes("notifications")}
    if "ix_notifications_id" not in notification_indexes:
        op.create_index("ix_notifications_id", "notifications", ["id"])
    if "ix_notifications_user_id" not in notification_indexes:
        op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("notifications"):
        notification_indexes = {index["name"] for index in inspector.get_indexes("notifications")}
        if "ix_notifications_user_id" in notification_indexes:
            op.drop_index("ix_notifications_user_id", table_name="notifications")
        if "ix_notifications_id" in notification_indexes:
            op.drop_index("ix_notifications_id", table_name="notifications")
        op.drop_table("notifications")

    ai_exam_cache_indexes = {index["name"] for index in inspector.get_indexes("ai_exam_cache")}
    if "ix_ai_exam_cache_user_id" in ai_exam_cache_indexes:
        op.drop_index("ix_ai_exam_cache_user_id", table_name="ai_exam_cache")

    ai_exam_cache_fks = {fk["name"] for fk in inspector.get_foreign_keys("ai_exam_cache")}
    if "fk_ai_exam_cache_user_id" in ai_exam_cache_fks:
        op.drop_constraint("fk_ai_exam_cache_user_id", "ai_exam_cache", type_="foreignkey")

    ai_exam_cache_columns = {column["name"] for column in inspector.get_columns("ai_exam_cache")}
    if "user_id" in ai_exam_cache_columns:
        op.drop_column("ai_exam_cache", "user_id")
