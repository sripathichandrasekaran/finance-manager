from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class OpportunityUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: Optional[str] = None


class OpportunityRead(BaseModel):
    id: int
    source: str
    source_label: Optional[str] = None
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    posted_at: Optional[datetime] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[str] = None
    score: int = 0
    fit_reason: Optional[str] = None
    draft: Optional[str] = None
    status: str = "new"
    notes: Optional[str] = None
    company_id: Optional[int] = None
    project_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OpportunityStats(BaseModel):
    total: int = 0
    new: int = 0
    applied: int = 0
    replied: int = 0
    won: int = 0
    lost: int = 0
    ignored: int = 0
    drafted: int = 0


class RefreshResult(BaseModel):
    added: int = 0
    updated: int = 0
    errored: list[str] = Field(default_factory=list)


class MarkWonPayload(BaseModel):
    company_name: Optional[str] = None
    project_name: Optional[str] = None
    amount: Optional[float] = None
    notes: Optional[str] = None