"""add verification_code to users

Revision ID: 0004_add_verif_code_users
Revises: 0003_add_is_active_to_users
Create Date: 2025-12-18
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_add_verif_code_users"
down_revision = "0003_add_is_active_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("verification_code", sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "verification_code")
