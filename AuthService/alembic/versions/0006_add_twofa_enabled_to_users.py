"""add twofa_enabled to users

Revision ID: 0006_add_twofa_enabled_users
Revises: 0005_add_name_fields_users
Create Date: 2026-01-16
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_add_twofa_enabled_users"
down_revision = "0005_add_name_fields_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("twofa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.alter_column("users", "twofa_enabled", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "twofa_enabled")

