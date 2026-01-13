"""add first_name and last_name to users

Revision ID: 0005_add_name_fields_users
Revises: 0004_add_verif_code_users
Create Date: 2026-01-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_add_name_fields_users"
down_revision = "0004_add_verif_code_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
