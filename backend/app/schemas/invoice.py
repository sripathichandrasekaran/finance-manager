from datetime import date as date_type, datetime
from typing import Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class InvoiceLineItemCreate(BaseModel):
    description: str = Field(..., max_length=255)
    quantity: Optional[float] = 1.0
    unit_price: Optional[float] = 0.0
    hsn_sac: Optional[str] = None
    tax_rate: Optional[float] = 0.0
    cgst_rate: Optional[float] = 0.0
    sgst_rate: Optional[float] = 0.0
    igst_rate: Optional[float] = 0.0


class InvoiceLineItemRead(BaseModel):
    id: int
    invoice_id: int
    description: str
    quantity: float
    unit_price: float
    total: float = 0.0
    hsn_sac: Optional[str] = None
    tax_rate: float = 0.0
    cgst_rate: float = 0.0
    sgst_rate: float = 0.0
    igst_rate: float = 0.0
    cgst_amount: float = 0.0
    sgst_amount: float = 0.0
    igst_amount: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(BaseModel):
    invoice_number: Optional[str] = Field(None, max_length=40)
    company_id: int
    project_id: Optional[int] = None
    issue_date: Optional[Union[date_type, str]] = None
    due_date: Optional[Union[date_type, str]] = None
    status: Optional[str] = "draft"
    tax_rate: Optional[float] = 0.0
    paid_amount: Optional[float] = 0.0
    notes: Optional[str] = None
    place_of_supply: Optional[str] = None
    tax_type: Optional[str] = None  # gst -> CGST+SGST, igst -> IGST (auto-set from states when omitted)
    items: list[InvoiceLineItemCreate] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    company_id: Optional[int] = None
    project_id: Optional[int] = None
    issue_date: Optional[Union[date_type, str]] = None
    due_date: Optional[Union[date_type, str]] = None
    status: Optional[str] = None
    tax_rate: Optional[float] = None
    paid_amount: Optional[float] = None
    notes: Optional[str] = None
    place_of_supply: Optional[str] = None
    tax_type: Optional[str] = None
    items: Optional[list[InvoiceLineItemCreate]] = None
    active: Optional[bool] = None


class InvoiceRead(BaseModel):
    id: int
    invoice_number: str
    sequence_number: Optional[int] = None
    company_id: int
    company_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    issue_date: Optional[date_type] = None
    due_date: Optional[date_type] = None
    status: Optional[str] = None
    tax_rate: float = 0.0
    paid_amount: float = 0.0
    notes: Optional[str] = None
    active: bool = True
    place_of_supply: Optional[str] = None
    tax_type: Optional[str] = None
    items: list[InvoiceLineItemRead] = Field(default_factory=list)
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    balance_due: float = 0.0
    cgst_total: float = 0.0
    sgst_total: float = 0.0
    igst_total: float = 0.0


class InvoiceStatusUpdate(BaseModel):
    status: str = Field(..., max_length=20)
    paid_amount: Optional[float] = None


class RecurringInvoiceLineItemCreate(BaseModel):
    description: str = Field(..., max_length=255)
    quantity: Optional[float] = 1.0
    unit_price: Optional[float] = 0.0


class RecurringInvoiceLineItemRead(BaseModel):
    id: int
    recurring_invoice_id: int
    description: str
    quantity: float
    unit_price: float
    total: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class RecurringInvoiceCreate(BaseModel):
    name: str = Field(..., max_length=120)
    company_id: int
    project_id: Optional[int] = None
    billing_cycle: str
    next_generation: Optional[Union[date_type, str]] = None
    tax_rate: Optional[float] = 0.0
    notes: Optional[str] = None
    auto_send: Optional[bool] = False
    items: list[RecurringInvoiceLineItemCreate] = Field(default_factory=list)
    active: Optional[bool] = True


class RecurringInvoiceUpdate(BaseModel):
    name: Optional[str] = None
    company_id: Optional[int] = None
    project_id: Optional[int] = None
    billing_cycle: Optional[str] = None
    next_generation: Optional[Union[date_type, str]] = None
    tax_rate: Optional[float] = None
    notes: Optional[str] = None
    auto_send: Optional[bool] = None
    items: Optional[list[RecurringInvoiceLineItemCreate]] = None
    active: Optional[bool] = None


class RecurringInvoiceRead(BaseModel):
    id: int
    name: str
    company_id: int
    company_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    billing_cycle: str
    next_generation: Optional[date_type] = None
    tax_rate: float = 0.0
    notes: Optional[str] = None
    auto_send: bool = False
    active: bool = True
    items: list[RecurringInvoiceLineItemRead] = Field(default_factory=list)
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class InvoicePaymentCreate(BaseModel):
    amount: float = Field(..., gt=0)
    payment_date: Optional[Union[date_type, str]] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class InvoicePaymentRead(BaseModel):
    id: int
    invoice_id: int
    amount: float
    payment_date: Optional[date_type] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceEventRead(BaseModel):
    id: int
    invoice_id: int
    event_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)