from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BudgetCreate(BaseModel):
    category_id: int
    amount: float = Field(..., gt=0)
    year: int
    month: int = Field(..., ge=1, le=12)


class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    year: Optional[int] = None
    month: Optional[int] = None


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    amount: float
    year: int
    month: int
    category_name: Optional[str] = None
    spent: Optional[float] = None
