from datetime import date, datetime, time
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.reminder import ReminderType, ReminderStatus


class ReminderCreate(BaseModel):
    title: str
    message: Optional[str] = None
    trigger_date: date
    trigger_time: Optional[time] = None
    type: ReminderType = ReminderType.CUSTOM
    related_id: Optional[int] = None


class ReminderStatusUpdate(BaseModel):
    status: ReminderStatus


class ReminderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: Optional[str] = None
    trigger_date: date
    trigger_time: Optional[time] = None
    type: ReminderType
    related_id: Optional[int] = None
    status: ReminderStatus
    sent_at: Optional[datetime] = None
