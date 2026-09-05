from datetime import date
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.db.session import get_db
from app.repositories.company_repository import CompanyRepository
from app.models.transaction import Transaction, TransactionType
from app.models.subscription import Subscription
from app.core.pagination import apply_sequence_pagination, set_pagination_headers

router = APIRouter()


@router.get("/client-health")
def client_health(
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """Calculate payment health score for each company based on
    transaction history and subscription payment behavior."""
    companies = CompanyRepository(db).list()
    results = []

    for comp in companies:
        # Income transactions
        income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.company_id == comp.id,
            Transaction.type == TransactionType.CREDIT,
        ).scalar() or 0

        # Expense transactions
        expenses = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.company_id == comp.id,
            Transaction.type == TransactionType.DEBIT,
        ).scalar() or 0

        # Transaction count
        tx_count = db.query(func.count(Transaction.id)).filter(
            Transaction.company_id == comp.id,
        ).scalar() or 0

        # Active subscriptions
        sub_count = db.query(func.count(Subscription.id)).filter(
            Subscription.company_id == comp.id,
            Subscription.active == True,
        ).scalar() or 0

        # Paid subscriptions
        paid_count = db.query(func.count(Subscription.id)).filter(
            Subscription.company_id == comp.id,
            Subscription.active == True,
            Subscription.paid == True,
        ).scalar() or 0

        # Health score: based on payment reliability
        # More income + paid subs = healthier
        payment_ratio = paid_count / sub_count if sub_count > 0 else 1.0
        score = min(100, int(
            (payment_ratio * 40) +
            (min(tx_count, 20) * 2) +
            (40 if income > 0 else 0)
        ))

        results.append({
            "company_id": comp.id,
            "name": comp.name,
            "total_income": float(income),
            "total_expenses": float(expenses),
            "transaction_count": tx_count,
            "subscription_count": sub_count,
            "paid_subscription_count": paid_count,
            "payment_ratio": round(payment_ratio * 100, 1),
            "health_score": score,
        })

    results.sort(key=lambda x: x["health_score"], reverse=True)
    page_rows, total = apply_sequence_pagination(results, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return page_rows
