from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.subscription import BillingCycle


class SubscriptionCreate(BaseModel):
    name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    billing_cycle: BillingCycle
    next_billing: date
    category: str = "Subscriptions"
    company_id: Optional[int] = None
    reminder_days_before: int = 3
    paid: bool = False


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    billing_cycle: Optional[BillingCycle] = None
    next_billing: Optional[date] = None
    category: Optional[str] = None
    company_id: Optional[int] = None
    active: Optional[bool] = None
    auto_renew: Optional[bool] = None
    reminder_days_before: Optional[int] = None
    paid: Optional[bool] = None


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    amount: float
    billing_cycle: BillingCycle
    next_billing: date
    category: str
    company_id: Optional[int] = None
    active: bool
    auto_renew: bool
    reminder_days_before: int
    paid: bool
