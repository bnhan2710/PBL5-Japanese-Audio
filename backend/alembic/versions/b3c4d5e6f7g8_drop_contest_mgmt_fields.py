"""drop contest mgmt fields

Revision ID: b3c4d5e6f7g8
Revises: a2b3c4d5e6f8
Create Date: 2026-04-17 20:03:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3c4d5e6f7g8'
down_revision = 'a2b3c4d5e6f8'
branch_labels = None
depends_on = None


def upgrade():
    # Drop columns image_url and is_active from contests table
    op.drop_column('contests', 'is_active')
    op.drop_column('contests', 'image_url')


def downgrade():
    # Re-add columns if needed
    op.add_column('contests', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('contests', sa.Column('image_url', sa.String(), nullable=True))
