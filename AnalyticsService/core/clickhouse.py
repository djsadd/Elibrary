import json
from typing import Any
import clickhouse_connect

from core.config import settings


def get_client(database: str | None = None):
    if not settings.CLICKHOUSE_ENABLED:
        return None
    try:
        return clickhouse_connect.get_client(
            url=settings.CLICKHOUSE_URL,
            database=database,
            connect_timeout=1,
            send_receive_timeout=2,
        )
    except Exception:
        return None


def ensure_schema() -> None:
    client = get_client()
    if not client:
        return
    if not client:
        return
    try:
        client.command(f"CREATE DATABASE IF NOT EXISTS {settings.CLICKHOUSE_DATABASE}")
        client = get_client(settings.CLICKHOUSE_DATABASE)
        if not client:
            return
        client.command(
            """
            CREATE TABLE IF NOT EXISTS events (
                event_time DateTime,
                event_date Date,
                event_type String,
                user_id UInt64,
                anon_id String,
                session_id String,
                path String,
                method String,
                status_code UInt16,
                user_agent String,
                referrer String,
                ip String,
                ip_hash String,
                request_id String,
                service String,
                is_authenticated UInt8,
                meta String
            )
            ENGINE = MergeTree()
            PARTITION BY toYYYYMM(event_date)
            ORDER BY (event_date, event_type, path)
            """
        )
        try:
            client.command("ALTER TABLE events ADD COLUMN IF NOT EXISTS ip String AFTER referrer")
        except Exception:
            pass
    except Exception:
        return


def insert_event(row: dict[str, Any]) -> None:
    client = get_client(settings.CLICKHOUSE_DATABASE)
    if not client:
        return
    meta = row.get("meta")
    if meta is None:
        meta_json = ""
    else:
        try:
            meta_json = json.dumps(meta, ensure_ascii=True)
        except Exception:
            meta_json = ""
    data = [
        row.get("event_time"),
        row.get("event_date"),
        str(row.get("event_type") or ""),
        int(row.get("user_id") or 0),
        str(row.get("anon_id") or ""),
        str(row.get("session_id") or ""),
        str(row.get("path") or ""),
        str(row.get("method") or ""),
        int(row.get("status_code") or 0),
        str(row.get("user_agent") or ""),
        str(row.get("referrer") or ""),
        str(row.get("ip") or ""),
        str(row.get("ip_hash") or ""),
        str(row.get("request_id") or ""),
        str(row.get("service") or ""),
        int(row.get("is_authenticated") or 0),
        meta_json,
    ]
    client.insert("events", [data], column_names=[
        "event_time",
        "event_date",
        "event_type",
        "user_id",
        "anon_id",
        "session_id",
        "path",
        "method",
        "status_code",
        "user_agent",
        "referrer",
        "ip",
        "ip_hash",
        "request_id",
        "service",
        "is_authenticated",
        "meta",
    ])
