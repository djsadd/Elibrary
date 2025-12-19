"""create users table

Revision ID: 0001_create_users
Revises:
Create Date: 2025-12-18
"""

from alembic import op

revision = "0001_create_users"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS to avoid failing if the table was created outside Alembic.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            avatar_url VARCHAR(500),
            email_verified BOOLEAN,
            phone_verified BOOLEAN,
            role VARCHAR(50),
            permissions VARCHAR,
            institution VARCHAR(255),
            faculty VARCHAR(255),
            group_name VARCHAR(255),
            student_id VARCHAR(255),
            last_login_at TIMESTAMP,
            last_activity_at TIMESTAMP,
            reading_history_count INTEGER,
            subscription_type VARCHAR(50),
            subscription_expire_at TIMESTAMP,
            google_id VARCHAR(255),
            github_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS users")
