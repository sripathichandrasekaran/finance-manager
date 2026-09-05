import enum
from sqlalchemy import Column, Integer, Float, String, Boolean, Date, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class BillingCycle(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class RecurringInvoice(Base, TimestampMixin):
    """A recurring invoice template that generates invoices on a schedule."""

    __tablename__ = "recurring_invoices"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    billing_cycle = Column(SAEnum(BillingCycle), nullable=False)
    next_generation = Column(Date, nullable=False, index=True)
    tax_rate = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    auto_send = Column(Boolean, default=False, nullable=False)

    company = relationship("Company", back_populates="recurring_invoices")
    project = relationship("Project", back_populates="recurring_invoices")
    items = relationship(
        "RecurringInvoiceLineItem",
        back_populates="recurring_invoice",
        cascade="all, delete-orphan",
        order_by="RecurringInvoiceLineItem.id",
    )


class RecurringInvoiceLineItem(Base):
    """A line item template for recurring invoices."""

    __tablename__ = "recurring_invoice_line_items"

    id = Column(Integer, primary_key=True)
    recurring_invoice_id = Column(Integer, ForeignKey("recurring_invoices.id"), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False, default=0.0)

    recurring_invoice = relationship("RecurringInvoice", back_populates="items")


class Subscription(Base, TimestampMixin):
    """A recurring payment (Netflix, Spotify, rent, ...) that generates
    reminders ahead of each billing date."""

    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    amount = Column(Float, nullable=False)
    billing_cycle = Column(SAEnum(BillingCycle), nullable=False)
    next_billing = Column(Date, nullable=False, index=True)
    category = Column(String(80), default="Subscriptions", nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    auto_renew = Column(Boolean, default=True, nullable=False)
    reminder_days_before = Column(Integer, default=3, nullable=False)
    paid = Column(Boolean, default=False, nullable=False)

    company = relationship("Company", back_populates="subscriptions")
