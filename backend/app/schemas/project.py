from datetime import date as date_type
from typing import Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    company_id: int
    name: str = Field(..., max_length=160)
    service_sector: Optional[str] = None
    pricing_type: Optional[str] = "fixed"
    fixed_price: Optional[float] = None
    hourly_rate: Optional[float] = None
    start_date: Optional[Union[date_type, str]] = None
    end_date: Optional[Union[date_type, str]] = None
    status: Optional[str] = "active"
    notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    company_id: Optional[int] = None
    service_sector: Optional[str] = None
    pricing_type: Optional[str] = None
    fixed_price: Optional[float] = None
    hourly_rate: Optional[float] = None
    start_date: Optional[Union[date_type, str]] = None
    end_date: Optional[Union[date_type, str]] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class ProjectAnalytics(BaseModel):
    project_id: int
    income: float
    expenses: float
    profit: float


class ProjectRead(BaseModel):
    id: int
    company_id: int
    company_name: Optional[str] = None
    name: str
    service_sector: Optional[str] = None
    pricing_type: Optional[str] = None
    fixed_price: Optional[float] = None
    hourly_rate: Optional[float] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True
    analytics: Optional[ProjectAnalytics] = None
