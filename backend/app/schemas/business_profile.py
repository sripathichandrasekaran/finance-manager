from typing import Optional
from pydantic import BaseModel, ConfigDict


class BusinessProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_setup: bool = False


class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None