"""add iin to users

Revision ID: 0002_add_iin_to_users
Revises:
Create Date: 2025-12-17
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_add_iin_to_users"
down_revision = "0001_create_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS to be safe if column already added manually.
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS iin VARCHAR(12)"
    )


def downgrade() -> None:
    op.drop_column("users", "iin")
