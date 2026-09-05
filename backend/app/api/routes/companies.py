from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract

from app.core.timezone import today as ist_today
from app.db.session import get_db
from app.repositories.company_repository import CompanyRepository
from app.repositories.invoice_repository import InvoiceRepository
from app.models.transaction import Transaction, TransactionType
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyRead

router = APIRouter()


def _month_range(year: int, month: int):
    """Return (first_day, last_day) for the given year/month."""
    import calendar
    last = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


@router.get("", response_model=list[CompanyRead])
def list_companies(
    active: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    rows = CompanyRepository(db).list(active_only=active)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return page_rows


@router.post("", response_model=CompanyRead, status_code=201)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    return CompanyRepository(db).create(
        name=payload.name,
        industry=payload.industry,
        contact_email=payload.contact_email,
        notes=payload.notes,
        active=payload.active,
        hourly_rate=payload.hourly_rate,
        fixed_price=payload.fixed_price,
        contract_type=payload.contract_type,
        contract_start=payload.contract_start,
        contract_end=payload.contract_end,
        payment_terms=payload.payment_terms,
        gstin=payload.gstin,
        billing_address=payload.billing_address,
        city=payload.city,
        state=payload.state,
        state_code=payload.state_code,
        pincode=payload.pincode,
    )


@router.patch("/{company_id}", response_model=CompanyRead)
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)):
    comp = CompanyRepository(db).update(company_id, payload.model_dump(exclude_unset=True))
    if not comp:
        raise HTTPException(404, "Company not found")
    return comp


@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    repo = CompanyRepository(db)
    if not repo.delete(company_id):
        raise HTTPException(404, "Company not found")
    return {"success": True}


@router.get("/summary/profit")
def profit_summary(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
):
    """Per-company income, expenses and profit (optionally for a specific
    year/month, otherwise all time)."""
    today = ist_today()
    year = year or today.year
    month = month or today.month

    # Group income and expenses by company for the period.
    rows = db.query(
        Transaction.company_id,
        func.coalesce(func.sum(case((Transaction.type == TransactionType.CREDIT, Transaction.amount), else_=0)), 0).label("income"),
        func.coalesce(func.sum(case((Transaction.type == TransactionType.DEBIT, Transaction.amount), else_=0)), 0).label("expenses"),
    ).filter(
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
        Transaction.company_id.isnot(None),
    ).group_by(Transaction.company_id).all()

    companies = CompanyRepository(db).list()
    comp_map = {c.id: c for c in companies}

    # Recurring subscription cost per company for the selected month: committed
    # (all active) vs paid (realized cash outflow in that month). Profit uses
    # only paid subscriptions so it reflects money actually spent that month,
    # while `committed` shows what's on the hook during the period.
    month_start, month_end = _month_range(year, month)
    sub_rows = db.query(
        Subscription.company_id,
        func.coalesce(func.sum(Subscription.amount), 0).label("total"),
    ).filter(
        Subscription.active == True,  # noqa: E712
        Subscription.next_billing >= month_start,
        Subscription.next_billing <= month_end,
        Subscription.company_id.isnot(None),
    ).group_by(Subscription.company_id).all()
    committed_by_company = {cid: float(t) for cid, t in sub_rows}

    paid_rows = db.query(
        Subscription.company_id,
        func.coalesce(func.sum(Subscription.amount), 0).label("total"),
    ).filter(
        Subscription.active == True,  # noqa: E712
        Subscription.paid == True,  # noqa: E712
        Subscription.next_billing >= month_start,
        Subscription.next_billing <= month_end,
        Subscription.company_id.isnot(None),
    ).group_by(Subscription.company_id).all()
    paid_by_company = {cid: float(t) for cid, t in paid_rows}

    per_company = []
    for company_id, income, expenses in rows:
        comp = comp_map.get(company_id)
        if not comp:
            continue
        committed = committed_by_company.get(company_id, 0.0)
        paid = paid_by_company.get(company_id, 0.0)
        per_company.append({
            "company_id": company_id,
            "name": comp.name,
            "income": float(income),
            "expenses": float(expenses),
            "committed_subscriptions": committed,
            "paid_subscriptions": paid,
            "fees_profit": float(income - expenses),
            "profit": float(income - expenses - paid),
        })
    per_company.sort(key=lambda x: x["profit"], reverse=True)

    total_income = sum(r["income"] for r in per_company)
    total_company_expenses = sum(r["expenses"] for r in per_company)
    total_committed_subs = sum(r["committed_subscriptions"] for r in per_company)
    total_paid_subs = sum(r["paid_subscriptions"] for r in per_company)

    # Invoiced revenue for the period — billing numbers kept separate so they
    # don't double count against transaction income.
    period_invoices = db.query(Invoice).filter(
        extract("year", Invoice.issue_date) == year,
        extract("month", Invoice.issue_date) == month,
        Invoice.active == True,  # noqa: E712
    ).all()
    invoice_billed = round(sum(InvoiceRepository.totals(i)["total"] for i in period_invoices), 2)
    invoice_paid = round(sum(i.paid_amount or 0 for i in period_invoices), 2)
    invoice_balance = round(invoice_billed - invoice_paid, 2)

    overall_expenses = (
        float(db.query(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).filter(
            Transaction.type == TransactionType.DEBIT,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        ).scalar() or 0.0)
    )

    return {
        "month": f"{year:04d}-{month:02d}",
        "per_company": per_company,
        "total_income": total_income,
        "company_expenses": total_company_expenses,
        "total_expenses": overall_expenses,
        "other_expenses": overall_expenses - total_company_expenses,
        "committed_subscriptions": total_committed_subs,
        "paid_subscriptions": total_paid_subs,
        "fees_profit": total_income - overall_expenses,
        "profit": total_income - overall_expenses - total_paid_subs,
        "invoice_billed": invoice_billed,
        "invoice_paid": invoice_paid,
        "invoice_balance": invoice_balance,
        "active_companies": len([c for c in companies if c.active]),
        "total_companies": len(companies),
    }
