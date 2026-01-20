"""add events ip column

Revision ID: 0002_add_events_ip
Revises: 0001_create_events
Create Date: 2026-01-20 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_add_events_ip"
down_revision = "0001_create_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("ip", sa.String(length=64), nullable=True))
    op.create_index("ix_events_ip", "events", ["ip"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_events_ip", table_name="events")
    op.drop_column("events", "ip")

