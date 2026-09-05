from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class TimeEntryCreate(BaseModel):
    company_id: Optional[int] = None
    description: Optional[str] = None
    hours: float = Field(..., gt=0)
    hourly_rate: Optional[float] = None
    date: str


class TimeEntryUpdate(BaseModel):
    company_id: Optional[int] = None
    description: Optional[str] = None
    hours: Optional[float] = None
    hourly_rate: Optional[float] = None
    date: Optional[str] = None


class TimeEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: Optional[int] = None
    description: Optional[str] = None
    hours: float
    hourly_rate: Optional[float] = None
    date: date
    company_name: Optional[str] = None
