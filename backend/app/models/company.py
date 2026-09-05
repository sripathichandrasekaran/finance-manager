from sqlalchemy import Column, Integer, String, Float, Text, Boolean, Date
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Company(Base, TimestampMixin):
    """A company/client you freelance for."""

    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    industry = Column(String(80), nullable=True)
    contact_email = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    hourly_rate = Column(Float, nullable=True)
    fixed_price = Column(Float, nullable=True)
    contract_type = Column(String(20), nullable=True, default="hourly")
    contract_start = Column(Date, nullable=True)
    contract_end = Column(Date, nullable=True)
    payment_terms = Column(String(80), nullable=True)
    gstin = Column(String(15), nullable=True)
    billing_address = Column(Text, nullable=True)
    city = Column(String(80), nullable=True)
    state = Column(String(50), nullable=True)
    state_code = Column(String(2), nullable=True)
    pincode = Column(String(10), nullable=True)
    invoice_prefix = Column(String(10), nullable=True, default="INV")
    invoice_next_number = Column(Integer, nullable=False, default=1)
    invoice_digits = Column(Integer, nullable=False, default=4)

    transactions = relationship("Transaction", back_populates="company")
    subscriptions = relationship("Subscription", back_populates="company")
    time_entries = relationship("TimeEntry", back_populates="company")
    projects = relationship("Project", back_populates="company")
    invoices = relationship("Invoice", back_populates="company")
    recurring_invoices = relationship("RecurringInvoice", back_populates="company")
