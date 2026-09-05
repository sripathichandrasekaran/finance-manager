from sqlalchemy import Column, Integer, Float, String, Boolean, Text, DateTime

from app.core.timezone import utcnow_aware as _now


class TimestampMixin:
    """Common created/updated audit columns used by every table."""

    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)
