"""create ai_queries table

Revision ID: 0003_create_ai_queries
Revises: 0002_add_events_ip
Create Date: 2026-01-23 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0003_create_ai_queries"
down_revision = "0002_add_events_ip"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_queries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("anon_id", sa.String(length=64), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("path", sa.String(length=512), nullable=True),
        sa.Column("method", sa.String(length=16), nullable=True),
        sa.Column("status_code", sa.SmallInteger(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("service", sa.String(length=64), nullable=True),
        sa.Column("is_authenticated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("provider", sa.String(length=64), nullable=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("query_text", sa.Text(), nullable=True),
        sa.Column("query_hash", sa.String(length=64), nullable=True),
        sa.Column("query_len", sa.Integer(), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_ai_queries_user_id", "ai_queries", ["user_id"], unique=False)
    op.create_index("ix_ai_queries_anon_id", "ai_queries", ["anon_id"], unique=False)
    op.create_index("ix_ai_queries_session_id", "ai_queries", ["session_id"], unique=False)
    op.create_index("ix_ai_queries_path", "ai_queries", ["path"], unique=False)
    op.create_index("ix_ai_queries_request_id", "ai_queries", ["request_id"], unique=False)
    op.create_index("ix_ai_queries_query_hash", "ai_queries", ["query_hash"], unique=False)
    op.create_index("ix_ai_queries_time_user", "ai_queries", ["event_time", "user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_queries_time_user", table_name="ai_queries")
    op.drop_index("ix_ai_queries_query_hash", table_name="ai_queries")
    op.drop_index("ix_ai_queries_request_id", table_name="ai_queries")
    op.drop_index("ix_ai_queries_path", table_name="ai_queries")
    op.drop_index("ix_ai_queries_session_id", table_name="ai_queries")
    op.drop_index("ix_ai_queries_anon_id", table_name="ai_queries")
    op.drop_index("ix_ai_queries_user_id", table_name="ai_queries")
    op.drop_table("ai_queries")

