from sqlalchemy.engine import make_url
import psycopg2
from psycopg2 import sql

from core.config import settings


def ensure_database_exists() -> None:
    url = make_url(settings.DATABASE_URL)
    if url.drivername.split("+")[0] != "postgresql":
        return

    db_name = url.database
    if not db_name:
        return

    admin_url = url.set(database="postgres")
    conn = psycopg2.connect(
        dbname=admin_url.database,
        user=admin_url.username,
        password=admin_url.password,
        host=admin_url.host,
        port=admin_url.port,
    )
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (db_name,))
            exists = cur.fetchone()
            if not exists:
                cur.execute(sql.SQL("CREATE DATABASE {}" ).format(sql.Identifier(db_name)))
    finally:
        conn.close()
