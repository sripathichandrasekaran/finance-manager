from sqlalchemy import Column, Integer, Float, String, Date, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class TimeEntry(Base, TimestampMixin):
    """Billable hours logged against a company/project."""

    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    description = Column(Text, nullable=True)
    hours = Column(Float, nullable=False)
    hourly_rate = Column(Float, nullable=True)
    date = Column(Date, nullable=False, index=True)

    company = relationship("Company", back_populates="time_entries")
