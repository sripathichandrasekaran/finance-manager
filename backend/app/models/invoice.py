import enum
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"


class Invoice(Base, TimestampMixin):
    """An invoice billed to a company (client) for work delivered.

    Each invoice carries its own line items (description x quantity x unit
    price), a configurable tax/gst percentage, and payment tracking. An
    invoice can be linked to a project so billing ties back to deliverables.
    """

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    invoice_number = Column(String(40), nullable=False, unique=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    sequence_number = Column(Integer, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    issue_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=True, default=InvoiceStatus.DRAFT.value)
    tax_rate = Column(Float, nullable=False, default=0.0)
    paid_amount = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    # GST fields
    place_of_supply = Column(String(50), nullable=True)
    tax_type = Column(String(10), nullable=True, default="gst")  # gst, igst

    company = relationship("Company", back_populates="invoices")
    project = relationship("Project", back_populates="invoices")
    items = relationship(
        "InvoiceLineItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceLineItem.id",
    )
    payments = relationship(
        "InvoicePayment",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoicePayment.id",
    )
    events = relationship(
        "InvoiceEvent",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceEvent.id",
    )


class InvoiceLineItem(Base):
    """A single billable line on an invoice."""

    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    # GST fields
    hsn_sac = Column(String(20), nullable=True)
    tax_rate = Column(Float, nullable=False, default=0.0)
    cgst_rate = Column(Float, nullable=False, default=0.0)
    sgst_rate = Column(Float, nullable=False, default=0.0)
    igst_rate = Column(Float, nullable=False, default=0.0)

    invoice = relationship("Invoice", back_populates="items")


class InvoicePayment(Base, TimestampMixin):
    """Payment history for an invoice."""

    __tablename__ = "invoice_payments"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String(40), nullable=True)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    invoice = relationship("Invoice", back_populates="payments")


class InvoiceEvent(Base, TimestampMixin):
    """Audit trail for invoice events (status changes, sends, views, etc.)."""

    __tablename__ = "invoice_events"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    event_type = Column(String(40), nullable=False)  # status_change, payment, send, view, generate, etc.
    old_value = Column(String(100), nullable=True)
    new_value = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    invoice = relationship("Invoice", back_populates="events")