from datetime import date
from typing import Optional
from sqlalchemy.orm import Session

from app.models.time_entry import TimeEntry


def _parse_date(value):
    if value is None or isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return value


class TimeEntryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, company_id=None, description=None, hours=0,
               hourly_rate=None, date=None) -> TimeEntry:
        entry = TimeEntry(
            company_id=company_id, description=description,
            hours=hours, hourly_rate=hourly_rate, date=_parse_date(date),
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get(self, entry_id: int) -> Optional[TimeEntry]:
        return self.db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()

    def list(self, company_id=None, start_date=None, end_date=None) -> list[TimeEntry]:
        q = self.db.query(TimeEntry)
        if company_id:
            q = q.filter(TimeEntry.company_id == company_id)
        if start_date:
            q = q.filter(TimeEntry.date >= start_date)
        if end_date:
            q = q.filter(TimeEntry.date <= end_date)
        return q.order_by(TimeEntry.date.desc()).all()

    def update(self, entry_id: int, fields: dict) -> Optional[TimeEntry]:
        entry = self.get(entry_id)
        if not entry:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            if key == "date":
                value = _parse_date(value)
            setattr(entry, key, value)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete(self, entry_id: int) -> bool:
        entry = self.get(entry_id)
        if not entry:
            return False
        self.db.delete(entry)
        self.db.commit()
        return True
