from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.business_profile_repository import BusinessProfileRepository
from app.schemas.business_profile import BusinessProfileRead, BusinessProfileUpdate

router = APIRouter()


def _to_read(profile) -> BusinessProfileRead:
    read = BusinessProfileRead.model_validate(profile)
    read.is_setup = bool(profile and (profile.business_name or profile.address or profile.gstin))
    return read


@router.get("", response_model=BusinessProfileRead)
def get_business_profile(db: Session = Depends(get_db)):
    """Return the seller/business profile (empty defaults if not configured)."""
    account = BusinessProfileRepository(db).get()
    if not account:
        return BusinessProfileRead(is_setup=False)
    return _to_read(account)


@router.put("", response_model=BusinessProfileRead)
def update_business_profile(payload: BusinessProfileUpdate, db: Session = Depends(get_db)):
    """Create or update the seller/business profile shown on invoices."""
    fields = payload.model_dump(exclude_unset=True)
    account = BusinessProfileRepository(db).update(fields)
    return _to_read(account)