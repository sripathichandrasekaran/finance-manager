from sqlalchemy import Column, String, Text

from app.db.session import Base
from app.models.base import TimestampMixin


class AISession(Base, TimestampMixin):
    """A persisted AI assistant conversation.

    Sessions and their messages are stored server-side so history survives
    across browsers and devices. The primary key is the client-generated uid so
    the browser can upsert against the exact same session it shows in the UI.
    ``messages`` holds the full JSON array of user/assistant turns."""

    __tablename__ = "ai_sessions"

    id = Column(String(64), primary_key=True)
    title = Column(String(240), nullable=True, default=None)
    messages = Column(Text, nullable=False, default="[]")