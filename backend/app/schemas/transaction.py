from datetime import date as date_type
from typing import Optional, Union
from pydantic import BaseModel, ConfigDict, Field

from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    type: TransactionType
    category: Optional[str] = None
    category_id: Optional[int] = None
    company_id: Optional[int] = None
    project_id: Optional[int] = None
    description: Optional[str] = None
    date: Optional[Union[date_type, str]] = None
    is_ai_categorized: bool = False


class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[TransactionType] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    company_id: Optional[int] = None
    project_id: Optional[int] = None
    description: Optional[str] = None
    date: Optional[Union[date_type, str]] = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    type: TransactionType
    category: Optional[str] = None
    company_id: Optional[int] = None
    project_id: Optional[int] = None
    description: Optional[str] = None
    date: Optional[date_type] = None
    is_ai_categorized: bool = False
    created_at: Optional[object] = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
