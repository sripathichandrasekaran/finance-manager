from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AIAction(BaseModel):
    tool: str
    args: Optional[dict] = None
    result: Optional[dict] = None


class AIMessage(BaseModel):
    id: Optional[str] = None
    role: str
    content: str
    createdAt: Optional[str] = None
    error: Optional[bool] = None
    actions: Optional[list[AIAction]] = None


class AISessionUpsert(BaseModel):
    id: str = Field(..., description="Client-generated session uid.")
    title: Optional[str] = None
    messages: list[AIMessage] = Field(default_factory=list)


class AISessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: Optional[str] = None
    messages: list = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None