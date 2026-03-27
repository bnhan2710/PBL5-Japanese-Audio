"""add ai exam cache and audio hash

Revision ID: 7c3e1f9d5a2b
Revises: db278d96b3c8
Create Date: 2026-03-27 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c3e1f9d5a2b"
down_revision: Union[str, None] = "db278d96b3c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audios", sa.Column("content_hash", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_audios_content_hash"), "audios", ["content_hash"], unique=True)

    op.create_table(
        "ai_exam_cache",
        sa.Column("cache_id", sa.UUID(), nullable=False),
        sa.Column("cache_key", sa.String(length=128), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("audio_id", sa.UUID(), nullable=True),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("jlpt_level", sa.String(length=10), nullable=False),
        sa.Column("mondai_config_json", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=True),
        sa.Column("ai_model", sa.String(length=100), nullable=False),
        sa.Column("pipeline_version", sa.String(length=100), nullable=False),
        sa.Column("cloudinary_public_id", sa.String(length=255), nullable=True),
        sa.Column("cloudinary_format", sa.String(length=20), nullable=True),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["audio_id"], ["audios.audio_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("cache_id"),
    )
    op.create_index(op.f("ix_ai_exam_cache_cache_id"), "ai_exam_cache", ["cache_id"], unique=False)
    op.create_index(op.f("ix_ai_exam_cache_cache_key"), "ai_exam_cache", ["cache_key"], unique=True)
    op.create_index(op.f("ix_ai_exam_cache_content_hash"), "ai_exam_cache", ["content_hash"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_exam_cache_content_hash"), table_name="ai_exam_cache")
    op.drop_index(op.f("ix_ai_exam_cache_cache_key"), table_name="ai_exam_cache")
    op.drop_index(op.f("ix_ai_exam_cache_cache_id"), table_name="ai_exam_cache")
    op.drop_table("ai_exam_cache")

    op.drop_index(op.f("ix_audios_content_hash"), table_name="audios")
    op.drop_column("audios", "content_hash")
