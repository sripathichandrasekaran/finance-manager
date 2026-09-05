from datetime import date, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.core.timezone import today as ist_today
from app.db.session import get_db
from app.models.transaction import Transaction, TransactionType
from app.models.subscription import Subscription, BillingCycle
from app.models.category import Category
from app.models.invoice import Invoice
from app.repositories.invoice_repository import InvoiceRepository

router = APIRouter()


@router.get("/pnl")
def profit_and_loss(year: int = None, month: int = None, db: Session = Depends(get_db)):
    """Generate P&L data for a given period."""
    today = ist_today()
    year = year or today.year
    month = month or today.month

    # Income
    income = float(db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(
        Transaction.type == TransactionType.CREDIT,
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
    ).scalar() or 0)

    # Expenses by category
    categories = db.query(Category).all()
    cat_map = {c.id: c.name for c in categories}

    expense_rows = db.query(
        Transaction.category_id,
        func.coalesce(func.sum(Transaction.amount), 0).label("total"),
    ).filter(
        Transaction.type == TransactionType.DEBIT,
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
    ).group_by(Transaction.category_id).all()

    expenses = []
    total_expenses = 0
    for cat_id, total in expense_rows:
        amt = float(total)
        total_expenses += amt
        expenses.append({
            "category": cat_map.get(cat_id, "Uncategorized"),
            "amount": amt,
        })
    expenses.sort(key=lambda x: x["amount"], reverse=True)

    # Subscriptions
    paid_subs = float(db.query(
        func.coalesce(func.sum(Subscription.amount), 0)
    ).filter(
        Subscription.active == True,
        Subscription.paid == True,
        extract("year", Subscription.next_billing) == year,
        extract("month", Subscription.next_billing) == month,
    ).scalar() or 0)

    net_profit = income - total_expenses - paid_subs

    return {
        "period": f"{year:04d}-{month:02d}",
        "income": income,
        "expenses": expenses,
        "total_expenses": total_expenses,
        "paid_subscriptions": paid_subs,
        "net_profit": net_profit,
    }


@router.get("/annual")
def annual_summary(year: int = None, db: Session = Depends(get_db)):
    """Monthly breakdown for the entire year."""
    today = ist_today()
    year = year or today.year

    months = []
    for m in range(1, 13):
        income = float(db.query(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).filter(
            Transaction.type == TransactionType.CREDIT,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == m,
        ).scalar() or 0)

        expenses = float(db.query(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).filter(
            Transaction.type == TransactionType.DEBIT,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == m,
        ).scalar() or 0)

        months.append({
            "month": m,
            "income": income,
            "expenses": expenses,
            "profit": income - expenses,
        })

    return {"year": year, "months": months}


@router.get("/cashflow")
def cashflow_projection(months: int = 90, db: Session = Depends(get_db)):
    """Projected cash position over rolling horizons (default 90 days).

    ``current_cash`` is realized cash from transactions only (credit - debit -
    paid subscriptions) so it never double-counts invoice payments. Projected
    inflow is the outstanding ``balance_due`` of sent/overdue invoices bucketed
    by due date; projected outflow is active subscriptions bucketed by their
    next billing date. Running balances are net of everything up to each bucket.
    """
    today = ist_today()
    horizon = max(min(months, 365), 30)  # clamp to [30, 365]

    # Realized cash position from transactions + paid subscriptions.
    credit = float(db.query(func.coalesce(func.sum(Transaction.amount), 0))
                   .filter(Transaction.type == TransactionType.CREDIT).scalar() or 0)
    debit = float(db.query(func.coalesce(func.sum(Transaction.amount), 0))
                  .filter(Transaction.type == TransactionType.DEBIT).scalar() or 0)
    paid_subs = float(db.query(func.coalesce(func.sum(Subscription.amount), 0))
                      .filter(Subscription.active == True, Subscription.paid == True).scalar() or 0)  # noqa: E712
    current_cash = credit - debit - paid_subs

    # Projected inflow: outstanding balance on sent/overdue invoices.
    incoming = []
    invoices = db.query(Invoice).filter(
        Invoice.status.in_(["sent", "overdue"]),
        Invoice.active == True,  # noqa: E712
    ).all()
    for inv in invoices:
        totals = InvoiceRepository.totals(inv)
        if totals["balance_due"] <= 0:
            continue
        due = inv.due_date or inv.issue_date or today
        incoming.append({"date": due, "amount": totals["balance_due"], "invoice_number": inv.invoice_number})

    # Projected outflow: active subscriptions across the horizon.
    outgoing = []
    subs = db.query(Subscription).filter(
        Subscription.active == True,  # noqa: E712
        Subscription.next_billing.isnot(None),
    ).all()
    for s in subs:
        date_iter = s.next_billing.date() if hasattr(s.next_billing, "date") else s.next_billing
        guard = 0
        while date_iter <= today + timedelta(days=horizon) and guard < (horizon // 1 + 12):
            if date_iter >= today:
                outgoing.append({"date": date_iter, "amount": float(s.amount or 0), "name": s.name})
            interval = _billing_days(s.billing_cycle)
            date_iter = _advance(s, date_iter, interval)
            guard += 1
            if not interval:
                break

    buckets = []
    running = current_cash
    for days in (30, 60, 90):
        if days > horizon:
            break
        cutoff = today + timedelta(days=days)
        inc_in = sum(i["amount"] for i in incoming if today <= i["date"] <= cutoff)
        out_in = sum(o["amount"] for o in outgoing if today <= o["date"] <= cutoff)
        running = running + inc_in - out_in
        buckets.append({
            "days": days,
            "cutoff": cutoff.isoformat(),
            "incoming": round(inc_in, 2),
            "outgoing": round(out_in, 2),
            "projected_balance": round(running, 2),
        })

    all_incoming = [{**i, "date": i["date"].isoformat()} for i in incoming if i["date"] <= today + timedelta(days=horizon)]
    all_outgoing = [{**o, "date": o["date"].isoformat()} for o in outgoing]

    return {
        "as_of": today.isoformat(),
        "horizon": horizon,
        "current_cash": round(current_cash, 2),
        "projected_incoming": round(sum(i["amount"] for i in incoming if i["date"] <= today + timedelta(days=horizon)), 2),
        "projected_outgoing": round(sum(o["amount"] for o in outgoing), 2),
        "buckets": buckets,
        "incoming": all_incoming,
        "outgoing": all_outgoing,
    }


def _billing_days(billing_cycle: str) -> int:
    return {
        BillingCycle.DAILY: 1,
        BillingCycle.WEEKLY: 7,
        BillingCycle.MONTHLY: 30,
        BillingCycle.YEARLY: 365,
    }.get(billing_cycle, 0)


def _advance(s, d: date, days: int):
    if days <= 0:
        return d
    nxt = d + timedelta(days=days)
    try:
        return nxt.replace(day=min(nxt.day, _days_in_month(nxt.year, nxt.month)))
    except ValueError:
        return nxt


def _days_in_month(year: int, month: int) -> int:
    import calendar
    return calendar.monthrange(year, month)[1]


@router.get("/tax-estimate")
def tax_estimate(year: int = None, month: int = None, rate: float = 0.0,
                 income_tax_rate: float | None = None, db: Session = Depends(get_db)):
    """Estimated GST and income tax for a period.

    GST collectible is derived from the tax already captured on invoices issued
    in the period (their ``total - subtotal``). The income-tax estimate uses a
    simplified model: receipts (credit transactions in the period) plus
    invoiced-but-unreceived delta minus deductible expenses (debit transactions
    + paid subscriptions), optionally taxed at flatsum ``rate`` (a percent).
    Provide ``income_tax_rate`` to override ``rate`` for clarity.
    """
    today = ist_today()
    year = year or today.year
    month = month or today.month

    invoices = db.query(Invoice).filter(
        Invoice.active == True,  # noqa: E712
        extract("year", Invoice.issue_date) == year,
        extract("month", Invoice.issue_date) == month,
    ).all()
    invoiced_total = sum(InvoiceRepository.totals(i)["total"] for i in invoices)
    gst_collectible = sum(
        InvoiceRepository.totals(i)["tax"] for i in invoices
    )

    receipts = float(db.query(func.coalesce(func.sum(Transaction.amount), 0))
                     .filter(Transaction.type == TransactionType.CREDIT,
                             extract("year", Transaction.date) == year,
                             extract("month", Transaction.date) == month).scalar() or 0)
    expenses = float(db.query(func.coalesce(func.sum(Transaction.amount), 0))
                     .filter(Transaction.type == TransactionType.DEBIT,
                             extract("year", Transaction.date) == year,
                             extract("month", Transaction.date) == month).scalar() or 0)
    paid_subs = float(db.query(func.coalesce(func.sum(Subscription.amount), 0))
                      .filter(Subscription.active == True, Subscription.paid == True,  # noqa: E712
                              extract("year", Subscription.next_billing) == year,
                              extract("month", Subscription.next_billing) == month).scalar() or 0)

    deductible = expenses + paid_subs
    taxable = max(0.0, receipts - deductible)
    eff_rate = income_tax_rate if income_tax_rate is not None else rate
    income_tax = taxable * eff_rate / 100.0

    return {
        "period": f"{year:04d}-{month:02d}",
        "invoiced": round(invoiced_total, 2),
        "gst_collectible": round(gst_collectible, 2),
        "receipts": round(receipts, 2),
        "deductible_expenses": round(deductible, 2),
        "taxable_income": round(taxable, 2),
        "income_tax_rate": eff_rate,
        "estimated_income_tax": round(income_tax, 2),
    }
