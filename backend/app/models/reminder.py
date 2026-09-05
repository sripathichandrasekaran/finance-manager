import enum
from sqlalchemy import Column, Integer, String, Text, Date, Time, Enum as SAEnum, DateTime, ForeignKey
from datetime import datetime

from app.db.session import Base
from app.models.base import TimestampMixin


class ReminderType(str, enum.Enum):
    SUBSCRIPTION = "subscription"
    BUDGET = "budget"
    SUMMARY = "summary"
    CUSTOM = "custom"


class ReminderStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DISMISSED = "dismissed"


class Reminder(Base, TimestampMixin):
    """A scheduled notification (subscription due, daily summary, custom)."""

    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    trigger_date = Column(Date, nullable=False, index=True)
    trigger_time = Column(Time, nullable=True)
    type = Column(SAEnum(ReminderType), nullable=False)
    related_id = Column(Integer, nullable=True)
    status = Column(SAEnum(ReminderStatus), default=ReminderStatus.PENDING, nullable=False)
    sent_at = Column(DateTime, nullable=True)
