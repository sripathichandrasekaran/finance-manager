from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timezone import iso as _iso
from app.db.session import get_db
from app.repositories.notification_repository import NotificationRepository
from app.services.notification_service import hub
from app.services import auth_service
from app.core.pagination import apply_sequence_pagination, set_pagination_headers

router = APIRouter()


def _serialize(n) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "link": n.link,
        "read": n.read,
        "created_at": _iso(n.created_at),
    }


@router.get("")
def list_notifications(
    limit: int = Query(50, ge=1, le=500),
    page: int = Query(1, ge=1),
    page_size: int | None = Query(None, ge=1, le=2000),
    unread_only: bool = False,
    response: Response = None,
    db: Session = Depends(get_db),
):
    eff_size = page_size if page_size is not None else min(limit, 500)
    rows = NotificationRepository(db).list(limit=2000, unread_only=unread_only)
    page_rows, total = apply_sequence_pagination(rows, page, eff_size)
    set_pagination_headers(response, total, page, eff_size)
    return [_serialize(r) for r in page_rows]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db)):
    return {"count": NotificationRepository(db).unread_count()}


@router.patch("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    n = NotificationRepository(db).mark_read(notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")
    return _serialize(n)


@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    count = NotificationRepository(db).mark_all_read()
    return {"updated": count}


@router.websocket("/ws")
async def websocket_notifications(websocket: WebSocket, token: str | None = None):
    # WebSockets bypass CORSMiddleware. For local/single-user dev, accept the
    # configured dev origin or any origin (browser sends its own host header).
    from app.db.session import SessionLocal
    if auth_service.auth_enabled():
        _db = SessionLocal()
        try:
            ok = auth_service.validate_session(_db, token)
        finally:
            _db.close()
        if not ok:
            await websocket.close(code=4001)
            return
    await websocket.accept()
    hub.attach_loop(__import__("asyncio").get_running_loop())
    try:
        await hub.handle(websocket)
    except WebSocketDisconnect:
        pass
