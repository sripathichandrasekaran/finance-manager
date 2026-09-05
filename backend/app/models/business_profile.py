from sqlalchemy import Column, Integer, String, Text

from app.db.session import Base
from app.models.base import TimestampMixin


class BusinessProfile(Base, TimestampMixin):
    """The freelancer's own business details shown on invoices (seller block).

    A single-row profile (id=1). Everything on it is optional so the app keeps
    working before it is filled in; invoices fall back to sensible defaults.
    """

    __tablename__ = "business_profile"

    id = Column(Integer, primary_key=True)
    business_name = Column(String(120), nullable=True)
    owner_name = Column(String(120), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(80), nullable=True)
    state = Column(String(50), nullable=True)
    state_code = Column(String(2), nullable=True)
    pincode = Column(String(10), nullable=True)
    gstin = Column(String(15), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(120), nullable=True)