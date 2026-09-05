from sqlalchemy import Column, Integer, String, DateTime, Boolean

from app.core.timezone import utcnow_aware as _now
from app.db.session import Base


class LoginSession(Base):
    """Records a login session so the user can see who/logged in when.

    Token is stored as an opaque value (not the raw payload) and expires after
    SESSION_HOURS. `active` stays true until the user logs out or the token
    expires."""

    __tablename__ = "login_sessions"

    id = Column(Integer, primary_key=True)
    token = Column(String(128), unique=True, nullable=False, index=True)
    username = Column(String(120), nullable=False)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
