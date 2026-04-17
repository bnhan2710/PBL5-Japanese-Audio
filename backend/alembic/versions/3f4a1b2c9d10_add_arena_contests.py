"""add arena contests

Revision ID: 3f4a1b2c9d10
Revises: d81c9a0b7e11
Create Date: 2026-04-16 16:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "3f4a1b2c9d10"
down_revision: Union[str, None] = "d81c9a0b7e11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "contests" not in table_names:
        op.create_table(
            "contests",
            sa.Column("contest_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("min_jlpt_level", sa.String(length=10), nullable=False),
            sa.Column("max_participants", sa.Integer(), nullable=True),
            sa.Column("time_limit", sa.Integer(), nullable=False),
            sa.Column("start_time", sa.DateTime(), nullable=False),
            sa.Column("end_time", sa.DateTime(), nullable=False),
            sa.Column("creator_id", sa.Integer(), nullable=True),
            sa.Column("exam_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
            sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["exam_id"], ["exams.exam_id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("contest_id"),
        )

    contest_indexes = {index["name"] for index in inspector.get_indexes("contests")}
    contest_index_name = op.f("ix_contests_contest_id")
    if contest_index_name not in contest_indexes:
        op.create_index(contest_index_name, "contests", ["contest_id"], unique=False)

    user_result_columns = {column["name"] for column in inspector.get_columns("user_results")}
    if "contest_id" not in user_result_columns:
        op.add_column(
            "user_results",
            sa.Column("contest_id", postgresql.UUID(as_uuid=True), nullable=True),
        )

    user_result_fks = {fk["name"] for fk in inspector.get_foreign_keys("user_results")}
    if "fk_user_results_contest_id_contests" not in user_result_fks:
        op.create_foreign_key(
            "fk_user_results_contest_id_contests",
            "user_results",
            "contests",
            ["contest_id"],
            ["contest_id"],
            ondelete="SET NULL",
        )

    if "contest_participants" not in table_names:
        op.create_table(
            "contest_participants",
            sa.Column("contest_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("result_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("joined_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["contest_id"], ["contests.contest_id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["result_id"], ["user_results.result_id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("contest_id", "user_id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "contest_participants" in table_names:
        op.drop_table("contest_participants")

    if "user_results" in table_names:
        user_result_fks = {fk["name"] for fk in inspector.get_foreign_keys("user_results")}
        if "fk_user_results_contest_id_contests" in user_result_fks:
            op.drop_constraint("fk_user_results_contest_id_contests", "user_results", type_="foreignkey")

        user_result_columns = {column["name"] for column in inspector.get_columns("user_results")}
        if "contest_id" in user_result_columns:
            op.drop_column("user_results", "contest_id")

    if "contests" in table_names:
        contest_indexes = {index["name"] for index in inspector.get_indexes("contests")}
        contest_index_name = op.f("ix_contests_contest_id")
        if contest_index_name in contest_indexes:
            op.drop_index(contest_index_name, table_name="contests")
        op.drop_table("contests")
