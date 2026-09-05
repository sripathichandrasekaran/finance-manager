"""Single source of truth for IST timestamps in the FinanceManager backend."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
IST_OFFSET = timedelta(hours=5, minutes=30)


def now() -> datetime:
    """Return the current datetime in IST (timezone-aware)."""
    return datetime.now(tz=IST)


def today() -> date:
    """Return today's date in IST."""
    return now().date()


def utcnow_aware() -> datetime:
    """Return current IST datetime as naive (for SQLAlchemy column defaults).

    SQLite stores no timezone info, so we store IST-local naive datetimes.
    """
    return now().replace(tzinfo=None)


def iso(dt) -> str | None:
    """Serialize a date or datetime to ISO string.

    Datetime values get +05:30 suffix so the frontend parses them as IST.
    Date-only values are returned as plain YYYY-MM-DD.
    """
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat() + "+05:30"
    return dt.isoformat()
