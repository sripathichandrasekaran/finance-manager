from sqlalchemy import Column, Integer, String, Float, Text, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Project(Base, TimestampMixin):
    """An individual project delivered under a company.

    A company may run many projects; each project carries its own service
    sector and its own pricing (fixed price or hourly rate), independent of the
    company's contract/pricing. Transactions can be linked to a project so its
    income / expenses / profit can be computed independently."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(160), nullable=False)
    service_sector = Column(String(80), nullable=True)
    pricing_type = Column(String(20), nullable=True, default="fixed")
    fixed_price = Column(Float, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=True, default="active")
    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    company = relationship("Company", back_populates="projects")
    transactions = relationship("Transaction", back_populates="project")
    invoices = relationship("Invoice", back_populates="project")
    recurring_invoices = relationship("RecurringInvoice", back_populates="project")
