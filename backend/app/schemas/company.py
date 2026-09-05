from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1)
    industry: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True
    hourly_rate: Optional[float] = None
    fixed_price: Optional[float] = None
    contract_type: Optional[str] = "hourly"
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None
    payment_terms: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None
    hourly_rate: Optional[float] = None
    fixed_price: Optional[float] = None
    contract_type: Optional[str] = None
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None
    payment_terms: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None


class CompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    industry: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    active: bool
    hourly_rate: Optional[float] = None
    fixed_price: Optional[float] = None
    contract_type: Optional[str] = None
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    payment_terms: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None