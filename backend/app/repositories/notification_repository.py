from typing import Optional
from datetime import timedelta
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.core.timezone import utcnow_aware


class NotificationRepository:
    """Data-access layer for notifications."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, title: str, message: Optional[str] = None,
               type_: NotificationType = NotificationType.SYSTEM,
               link: Optional[str] = None) -> Notification:
        n = Notification(title=title, message=message, type=type_.value, link=link)
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        return n

    def get(self, notification_id: int) -> Optional[Notification]:
        return self.db.query(Notification).filter(Notification.id == notification_id).first()

    def list(self, limit: int = 50, unread_only: bool = False) -> list[Notification]:
        q = self.db.query(Notification)
        if unread_only:
            q = q.filter(Notification.read == False)  # noqa: E712
        return q.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()

    def unread_count(self) -> int:
        return self.db.query(Notification).filter(Notification.read == False).count()  # noqa: E712

    def exists_recent(self, title: str, hours: int = 20) -> bool:
        """True if a notification with the same title was created in the last
        `hours` — used to keep scheduler-generated alerts idempotent per day."""
        cutoff = utcnow_aware() - timedelta(hours=hours)
        return (
            self.db.query(Notification)
            .filter(Notification.title == title, Notification.created_at >= cutoff)
            .first()
            is not None
        )

    def mark_read(self, notification_id: int) -> Optional[Notification]:
        n = self.get(notification_id)
        if not n:
            return None
        n.read = True
        self.db.commit()
        self.db.refresh(n)
        return n

    def mark_all_read(self) -> int:
        rows = self.db.query(Notification).filter(Notification.read == False).all()  # noqa: E712
        for n in rows:
            n.read = True
        self.db.commit()
        return len(rows)
