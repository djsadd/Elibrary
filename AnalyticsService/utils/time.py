from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from core.config import settings


def get_tz() -> ZoneInfo:
    return ZoneInfo(settings.TIMEZONE)


def range_for_dates(from_date: date | None, to_date: date | None) -> tuple[datetime, datetime]:
    tz = get_tz()
    if not to_date:
        to_date = datetime.now(tz).date()
    if not from_date:
        from_date = to_date - timedelta(days=30)

    start_local = datetime.combine(from_date, time.min, tzinfo=tz)
    end_local = datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=tz)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    return start_utc, end_utc
