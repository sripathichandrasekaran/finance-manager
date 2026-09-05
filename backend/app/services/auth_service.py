"""Single-user authentication backed by environmental configuration.

No user module: a single app password (`APP_PASSWORD`) from `.env` gates access.
Successful logins create a `LoginSession` record (token, UA, IP, expiry) so the
user can audit who logged in and when. If `APP_PASSWORD` is empty, auth is
bypassed (the app runs open) — set a password to enforce the login gate.
"""

from __future__ import annotations

import hmac
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timezone import utcnow_aware as _now
from app.db.session import get_db
from app.models.login_session import LoginSession

_bearer = HTTPBearer(auto_error=False)


def auth_enabled() -> bool:
    return bool(settings.APP_PASSWORD)


def verify_password(attempt: str) -> bool:
    stored = settings.APP_PASSWORD
    if not stored:
        return True
    return hmac.compare_digest(str(attempt), stored)


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def create_session(db: Session, username: str, user_agent: Optional[str] = None,
                   ip_address: Optional[str] = None) -> str:
    token = _new_token()
    expires = _now() + timedelta(hours=settings.SESSION_HOURS)
    db.add(LoginSession(
        token=token,
        username=username,
        user_agent=(user_agent or "")[:255],
        ip_address=(ip_address or "")[:64],
        expires_at=expires,
        active=True,
    ))
    db.commit()
    return token


def get_session(db: Session, token: str) -> Optional[LoginSession]:
    return db.query(LoginSession).filter(LoginSession.token == token).first()


def validate_session(db: Session, token: str) -> Optional[LoginSession]:
    s = get_session(db, token)
    if not s or not s.active:
        return None
    if s.expires_at and s.expires_at < _now():
        s.active = False
        db.commit()
        return None
    return s


def revoke_session(db: Session, token: str) -> bool:
    s = get_session(db, token)
    if not s:
        return False
    s.active = False
    db.commit()
    return True


def list_sessions(db: Session, limit: int = 50) -> list[LoginSession]:
    return db.query(LoginSession).order_by(
        LoginSession.created_at.desc(), LoginSession.id.desc()
    ).limit(limit).all()


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> None:
    """FastAPI dependency guarding protected routes. Bypassed when the app
    password is unset; otherwise requires a valid, unexpired session token."""
    if not auth_enabled():
        return
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Not authenticated")
    if not validate_session(db, credentials.credentials):
        raise HTTPException(401, "Session expired or invalid")
