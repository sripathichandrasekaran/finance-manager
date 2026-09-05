from typing import Optional

from sqlalchemy.orm import Session

from app.models.business_profile import BusinessProfile

_PROFILE_ID = 1


class BusinessProfileRepository:
    """Data-access layer for the single-row seller/business profile."""

    def __init__(self, db: Session):
        self.db = db

    def get(self) -> Optional[BusinessProfile]:
        return self.db.query(BusinessProfile).filter(BusinessProfile.id == _PROFILE_ID).first()

    def get_or_create(self) -> BusinessProfile:
        profile = self.get()
        if not profile:
            profile = BusinessProfile(id=_PROFILE_ID)
            self.db.add(profile)
            self.db.commit()
            self.db.refresh(profile)
        return profile

    def update(self, fields: dict) -> BusinessProfile:
        profile = self.get_or_create()
        for key, value in fields.items():
            if key in ("id", "is_setup"):
                continue
            if hasattr(profile, key):
                setattr(profile, key, value)
        self.db.commit()
        self.db.refresh(profile)
        return profile