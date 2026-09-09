from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.bank_account import BankAccountType


class BankAccountCreate(BaseModel):
    name: str = Field(..., min_length=1)
    type: BankAccountType = BankAccountType.CHECKING
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    swift_bic: Optional[str] = None
    currency: str = "INR"
    balance: float = 0.0
    is_active: bool = True
    notes: Optional[str] = None


class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[BankAccountType] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    swift_bic: Optional[str] = None
    currency: Optional[str] = None
    balance: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class BankAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: BankAccountType
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    swift_bic: Optional[str] = None
    currency: str
    balance: float
    is_active: bool
    notes: Optional[str] = None
    created_at: date
    updated_at: date