"""add is_active to users

Revision ID: 0003_add_is_active_to_users
Revises: 0002_add_iin_to_users
Create Date: 2025-12-18
"""

from alembic import op


revision = "0003_add_is_active_to_users"
down_revision = "0002_add_iin_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_active column with a safe default for existing users.
    op.execute(
        "ALTER TABLE users "
        "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.drop_column("users", "is_active")

