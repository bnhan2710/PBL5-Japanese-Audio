"""Add skill metrics

Revision ID: 96adaa7179bf
Revises: cc281bdd0a68
Create Date: 2026-04-11 01:09:32.863344

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '96adaa7179bf'
down_revision: Union[str, None] = 'cc281bdd0a68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {column["name"] for column in inspector.get_columns("competency_analysis")}
    if "skill_metrics" not in columns:
        op.add_column(
            "competency_analysis",
            sa.Column("skill_metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {column["name"] for column in inspector.get_columns("competency_analysis")}
    if "skill_metrics" in columns:
        op.drop_column("competency_analysis", "skill_metrics")
