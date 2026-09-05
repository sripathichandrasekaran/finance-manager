import enum
from sqlalchemy import Column, Integer, String, Text, Boolean
from datetime import datetime

from app.db.session import Base
from app.models.base import TimestampMixin


class NotificationType(str, enum.Enum):
    REMINDER = "reminder"
    BUDGET = "budget"
    AI = "ai"
    SYSTEM = "system"


class Notification(Base, TimestampMixin):
    """A realtime notification surfaced in the in-app bell and (optionally) as
    a browser notification. Persisted so unread items survive a browser reload,
    and broadcast over WebSocket to any connected clients for instant delivery."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    type = Column(String(20), nullable=False, default=NotificationType.SYSTEM.value)
    link = Column(String(120), nullable=True, default=None)
    read = Column(Boolean, default=False, nullable=False)
