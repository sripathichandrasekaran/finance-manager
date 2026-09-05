from datetime import date, time
from typing import Optional
from sqlalchemy.orm import Session

from app.core.timezone import utcnow_aware as _now
from app.models.reminder import Reminder, ReminderType, ReminderStatus


class ReminderRepository:
    """Data-access layer for reminders."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, title: str, trigger_date: date, message: Optional[str] = None,
               type_: ReminderType = ReminderType.CUSTOM, related_id: Optional[int] = None,
               trigger_time: Optional[time] = None) -> Reminder:
        r = Reminder(
            title=title,
            message=message,
            trigger_date=trigger_date,
            trigger_time=trigger_time,
            type=type_,
            related_id=related_id,
        )
        self.db.add(r)
        self.db.commit()
        self.db.refresh(r)
        return r

    def get(self, reminder_id: int) -> Optional[Reminder]:
        return self.db.query(Reminder).filter(Reminder.id == reminder_id).first()

    def pending_due(self, before: Optional[date] = None) -> list[Reminder]:
        q = self.db.query(Reminder).filter(Reminder.status == ReminderStatus.PENDING)
        if before:
            q = q.filter(Reminder.trigger_date <= before)
        return q.order_by(Reminder.trigger_date.asc()).all()

    def pending_custom_due(self, before: Optional[date] = None) -> list[Reminder]:
        """Pending CUSTOM reminders whose trigger date has arrived (or earlier)."""
        q = self.db.query(Reminder).filter(
            Reminder.status == ReminderStatus.PENDING,
            Reminder.type == ReminderType.CUSTOM,
        )
        if before:
            q = q.filter(Reminder.trigger_date <= before)
        return q.order_by(Reminder.trigger_date.asc()).all()

    def list(self, status: Optional[ReminderStatus] = None, limit: int = 50) -> list[Reminder]:
        q = self.db.query(Reminder)
        if status:
            q = q.filter(Reminder.status == status)
        return q.order_by(Reminder.trigger_date.desc()).limit(limit).all()

    def set_status(self, reminder_id: int, status: ReminderStatus) -> Optional[Reminder]:
        r = self.get(reminder_id)
        if not r:
            return None
        r.status = status
        if status == ReminderStatus.SENT:
            r.sent_at = _now()
        self.db.commit()
        self.db.refresh(r)
        return r

    def delete(self, reminder_id: int) -> bool:
        r = self.get(reminder_id)
        if not r:
            return False
        self.db.delete(r)
        self.db.commit()
        return True

    def exists_today(self, type_: ReminderType, related_id: int, day: date) -> bool:
        return self.db.query(Reminder).filter(
            Reminder.type == type_,
            Reminder.related_id == related_id,
            Reminder.trigger_date == day,
        ).first() is not None
