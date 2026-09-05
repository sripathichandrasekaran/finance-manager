from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.recurring_invoice_repository import RecurringInvoiceRepository
from app.models.company import Company
from app.models.project import Project
from app.schemas.invoice import (
    RecurringInvoiceCreate,
    RecurringInvoiceUpdate,
    RecurringInvoiceRead,
    RecurringInvoiceLineItemRead,
)
from app.core.timezone import today as ist_today, iso as _iso

router = APIRouter()


def _norm_date(v):
    if v is None:
        return None
    if isinstance(v, date):
        return v
    return datetime.fromisoformat(str(v)).date()


def _to_read(db: Session, ri) -> RecurringInvoiceRead:
    company = db.query(Company).filter(Company.id == ri.company_id).first()
    project = None
    if ri.project_id:
        project = db.query(Project).filter(Project.id == ri.project_id).first()
    totals = RecurringInvoiceRepository.totals(ri)
    items = [
        RecurringInvoiceLineItemRead(
            id=it.id,
            recurring_invoice_id=it.recurring_invoice_id,
            description=it.description,
            quantity=it.quantity,
            unit_price=it.unit_price,
            total=round((it.quantity or 0) * (it.unit_price or 0), 2),
        )
        for it in ri.items
    ]
    return RecurringInvoiceRead(
        id=ri.id,
        name=ri.name,
        company_id=ri.company_id,
        company_name=company.name if company else None,
        project_id=ri.project_id,
        project_name=project.name if project else None,
        billing_cycle=ri.billing_cycle,
        next_generation=ri.next_generation,
        tax_rate=ri.tax_rate,
        notes=ri.notes,
        auto_send=ri.auto_send,
        active=ri.active,
        items=items,
        subtotal=totals["subtotal"],
        tax=totals["tax"],
        total=totals["total"],
    )


def _items_payload(items):
    return [
        {
            "description": it.description,
            "quantity": it.quantity,
            "unit_price": it.unit_price,
        }
        for it in items
    ]


@router.get("", response_model=list[RecurringInvoiceRead])
def list_recurring_invoices(
    company_id: int | None = None,
    active_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    rows = RecurringInvoiceRepository(db).list(company_id=company_id, active_only=active_only)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return [_to_read(db, r) for r in page_rows]


@router.post("", response_model=RecurringInvoiceRead, status_code=201)
def create_recurring_invoice(payload: RecurringInvoiceCreate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    if payload.project_id:
        project = db.query(Project).filter(Project.id == payload.project_id).first()
        if not project:
            raise HTTPException(404, "Project not found")
    repo = RecurringInvoiceRepository(db)
    ri = repo.create(
        name=payload.name,
        company_id=payload.company_id,
        project_id=payload.project_id,
        billing_cycle=payload.billing_cycle,
        next_generation=_norm_date(payload.next_generation) or ist_today(),
        tax_rate=payload.tax_rate or 0.0,
        notes=payload.notes,
        auto_send=payload.auto_send,
        items=_items_payload(payload.items),
        active=payload.active,
    )
    return _to_read(db, ri)


@router.get("/{recurring_id}", response_model=RecurringInvoiceRead)
def get_recurring_invoice(recurring_id: int, db: Session = Depends(get_db)):
    ri = RecurringInvoiceRepository(db).get(recurring_id)
    if not ri:
        raise HTTPException(404, "Recurring invoice not found")
    return _to_read(db, ri)


@router.patch("/{recurring_id}", response_model=RecurringInvoiceRead)
def update_recurring_invoice(recurring_id: int, payload: RecurringInvoiceUpdate, db: Session = Depends(get_db)):
    repo = RecurringInvoiceRepository(db)
    fields = payload.model_dump(exclude_unset=True)
    if "next_generation" in fields:
        fields["next_generation"] = _norm_date(fields["next_generation"])
    if "items" in fields and fields["items"] is not None:
        fields["items"] = _items_payload(fields["items"])
    ri = repo.update(recurring_id, fields)
    if not ri:
        raise HTTPException(404, "Recurring invoice not found")
    return _to_read(db, ri)


@router.delete("/{recurring_id}")
def delete_recurring_invoice(recurring_id: int, db: Session = Depends(get_db)):
    if not RecurringInvoiceRepository(db).delete(recurring_id):
        raise HTTPException(404, "Recurring invoice not found")
    return {"success": True}


@router.post("/{recurring_id}/generate", response_model=RecurringInvoiceRead)
def generate_invoice_now(recurring_id: int, db: Session = Depends(get_db)):
    """Manually generate an invoice from this recurring template."""
    repo = RecurringInvoiceRepository(db)
    ri = repo.get(recurring_id)
    if not ri:
        raise HTTPException(404, "Recurring invoice not found")
    if not ri.active:
        raise HTTPException(400, "Recurring invoice is not active")

    # Create the invoice
    from app.repositories.invoice_repository import InvoiceRepository
    inv_repo = InvoiceRepository(db)
    totals = RecurringInvoiceRepository.totals(ri)
    inv = inv_repo.create(
        company_id=ri.company_id,
        project_id=ri.project_id,
        issue_date=ist_today(),
        due_date=ist_today(),
        status="draft",
        tax_rate=ri.tax_rate,
        paid_amount=0.0,
        notes=ri.notes,
        items=_items_payload(ri.items),
    )

    # Advance next generation date
    repo.advance_next_generation(ri, ri.billing_cycle)

    return _to_read(db, ri)