"""Client Pulse — recency/affinity intelligence for the businesses you
freelance for. Ranks every engaged client by how recently you invoiced them
and how much they have paid, and drafts a copy-paste revival message for the
ones that went quiet. Repeat business is the cheapest revenue a freelancer
has; this is the nudge to go collect it."""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.timezone import today as ist_today
from app.models.company import Company
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.project import Project

TIER_THRESHOLDS = (
    ("hot", 30),
    ("active", 90),
    ("dormant", 180),
    ("cold", float("inf")),
)

REVIVAL_THRESHOLD_DAYS = 120
REVIVAL_NEEDS_PAID = True


def _tier_for(days_since: int):
    for tier, limit in TIER_THRESHOLDS:
        if days_since <= limit:
            return tier
    return "cold"


def _fmt_money(value: float) -> str:
    return f"\u20b9{round(value or 0):,}"


def _build_revival_message(name: str, days_since: int, last_date, total_invoiced: float, total_paid: float) -> str:
    inv = _fmt_money(total_invoiced)
    paid = _fmt_money(total_paid)
    day_word = "day" if days_since == 1 else "days"
    last_str = last_date.strftime("%d %b %Y") if isinstance(last_date, date) else str(last_date)
    return (
        f"Hi {name} \u2014 it's been {days_since} {day_word} since we last "
        f"worked together ({last_str}); {inv} invoiced, {paid} settled, always "
        f"a smooth process on your end. I've kept your projects in good shape "
        f"and have capacity free this month. Anything you want refreshed, "
        f"fixed, or built next? Reply and I'll hold your slot."
    )


def client_pulse_rows(db: Session):
    """Compute pulse rows for every engaged (invoiced, non-draft) company.

    Returns a list of dicts sorted by severity (colder first), each holding:
    company_id, name, industry, contact_email, invoice_count, total_invoiced,
    total_paid, projects_count, last_invoice_date, days_since_last_invoice,
    tier (hot/active/dormant/cold), revival_message (dormant/cold only).
    """
    today = ist_today()
    companies = db.query(Company).filter(Company.active == True).all()  # noqa: E712
    results = []
    for comp in companies:
        inv_rows = (
            db.query(
                Invoice.id,
                Invoice.issue_date,
                Invoice.tax_rate,
                Invoice.paid_amount,
            )
            .filter(
                Invoice.company_id == comp.id,
                Invoice.status != "draft",
            )
            .all()
        )
        if not inv_rows:
            continue
        inv_ids = [r.id for r in inv_rows]
        subtotals = dict(
            db.query(
                InvoiceLineItem.invoice_id,
                func.sum(InvoiceLineItem.quantity * InvoiceLineItem.unit_price),
            )
            .filter(InvoiceLineItem.invoice_id.in_(inv_ids))
            .group_by(InvoiceLineItem.invoice_id)
            .all()
        )
        total_invoiced = 0.0
        total_paid = 0.0
        last_invoice_date = None
        for r in inv_rows:
            sub = subtotals.get(r.id) or 0
            total_invoiced += float(sub) * (1 + (r.tax_rate or 0) / 100.0)
            total_paid += float(r.paid_amount or 0)
            if r.issue_date and (last_invoice_date is None or r.issue_date > last_invoice_date):
                last_invoice_date = r.issue_date
        if last_invoice_date is None:
            continue
        days_since = (today - last_invoice_date).days
        if days_since < 0:
            days_since = 0
        tier = _tier_for(days_since)
        projects_count = (
            db.query(func.count(Project.id))
            .filter(Project.company_id == comp.id)
            .scalar()
            or 0
        )
        row = {
            "company_id": comp.id,
            "name": comp.name,
            "industry": comp.industry,
            "contact_email": comp.contact_email,
            "invoice_count": len(inv_rows),
            "total_invoiced": round(total_invoiced, 2),
            "total_paid": round(total_paid, 2),
            "projects_count": projects_count,
            "last_invoice_date": last_invoice_date.isoformat(),
            "days_since_last_invoice": days_since,
            "tier": tier,
            "revival_message": None,
        }
        if tier in ("dormant", "cold"):
            row["revival_message"] = _build_revival_message(
                comp.name,
                days_since,
                last_invoice_date,
                total_invoiced,
                total_paid,
            )
        results.append(row)
    severity = {"cold": 0, "dormant": 1, "active": 2, "hot": 3}
    results.sort(key=lambda r: (severity.get(r["tier"], 9), -r["days_since_last_invoice"]))
    return results


def clients_needing_revival(db: Session):
    """Engaged clients silent past our threshold — the main follow-up set."""
    rows = [
        r
        for r in client_pulse_rows(db)
        if r["tier"] in ("dormant", "cold")
        and r["days_since_last_invoice"] >= REVIVAL_THRESHOLD_DAYS
        and (r["total_paid"] > 0 or not REVIVAL_NEEDS_PAID)
    ]
    return rows