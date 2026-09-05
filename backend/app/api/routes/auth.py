from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timezone import iso as _iso
from app.db.session import get_db
from app.models.login_session import LoginSession
from app.services import auth_service

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    password: str
    username: str | None = None


class LoginResponse(BaseModel):
    token: str
    username: str
    auth_enabled: bool


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def _token_from(credentials) -> str | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    if not auth_service.auth_enabled():
        # Auth disabled — let the client log in without a password.
        username = payload.username or settings.APP_USERNAME
        token = auth_service.create_session(
            db, username, request.headers.get("user-agent"), _client_ip(request))
        return LoginResponse(token=token, username=username, auth_enabled=False)
    if not auth_service.verify_password(payload.password):
        raise HTTPException(401, "Invalid password")
    username = payload.username or settings.APP_USERNAME
    token = auth_service.create_session(
        db, username, request.headers.get("user-agent"), _client_ip(request))
    return LoginResponse(token=token, username=username, auth_enabled=True)


@router.get("/me")
def me(credentials: HTTPAuthorizationCredentials = Depends(_bearer),
       db: Session = Depends(get_db)):
    if not auth_service.auth_enabled():
        return {"username": settings.APP_USERNAME, "auth_enabled": False}
    token = _token_from(credentials)
    s = auth_service.validate_session(db, token) if token else None
    if not s:
        raise HTTPException(401, "Not authenticated")
    return {"id": s.id, "username": s.username, "auth_enabled": True,
            "logged_in_at": _iso(s.created_at)}


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(_bearer),
           db: Session = Depends(get_db)):
    token = _token_from(credentials)
    if token:
        auth_service.revoke_session(db, token)
    return {"success": True}


@router.get("/sessions")
def sessions(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    token = _token_from(credentials)
    if not auth_service.validate_session(db, token):
        raise HTTPException(401, "Not authenticated")
    current = token
    rows = auth_service.list_sessions(db, limit=500)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    out = []
    for s in page_rows:
        out.append({
            "id": s.id,
            "username": s.username,
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
    "created_at": _iso(s.created_at),
    "expires_at": _iso(s.expires_at),
            "active": bool(s.active),
            "current": bool(s.token == current),
        })
    return out


@router.post("/sessions/{session_id}/revoke")
def revoke(session_id: int, credentials: HTTPAuthorizationCredentials = Depends(_bearer),
           db: Session = Depends(get_db)):
    token = _token_from(credentials)
    if not auth_service.validate_session(db, token):
        raise HTTPException(401, "Not authenticated")
    s = db.query(LoginSession).filter(LoginSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.token == token:
        raise HTTPException(400, "Use logout to end the current session")
    s.active = False
    db.commit()
    return {"success": True}
