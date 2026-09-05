from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.repositories.reminder_repository import ReminderRepository
from app.schemas.reminder import ReminderCreate, ReminderStatusUpdate, ReminderRead
from app.core.pagination import apply_sequence_pagination, set_pagination_headers

from app.core.timezone import today as ist_today

router = APIRouter()


@router.get("", response_model=list[ReminderRead])
def pending_reminders(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    rows = ReminderRepository(db).pending_due(before=ist_today())
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return page_rows


@router.get("/all", response_model=list[ReminderRead])
def all_reminders(
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.models.reminder import ReminderStatus
    s = ReminderStatus(status) if status in {s.value for s in ReminderStatus} else None
    rows = ReminderRepository(db).list(status=s, limit=500)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return page_rows


@router.post("", response_model=ReminderRead, status_code=201)
def create_reminder(payload: ReminderCreate, db: Session = Depends(get_db)):
    from app.models.notification import NotificationType
    from app.services.notification_service import notify

    reminder = ReminderRepository(db).create(
        title=payload.title,
        message=payload.message,
        trigger_date=payload.trigger_date,
        trigger_time=payload.trigger_time,
        type_=payload.type,
        related_id=payload.related_id,
    )
    notify(
        db,
        title=reminder.title,
        message=reminder.message or f"Reminder set for {reminder.trigger_date}.",
        type_=NotificationType.REMINDER,
        link="/reminders",
    )
    return reminder


@router.patch("/{reminder_id}/status", response_model=ReminderRead)
def update_status(reminder_id: int, payload: ReminderStatusUpdate, db: Session = Depends(get_db)):
    r = ReminderRepository(db).set_status(reminder_id, payload.status)
    if not r:
        raise HTTPException(404, "Reminder not found")
    return r


@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    repo = ReminderRepository(db)
    if not repo.delete(reminder_id):
        raise HTTPException(404, "Reminder not found")
    return {"success": True}
