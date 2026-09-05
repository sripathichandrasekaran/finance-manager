from datetime import date, timedelta
from collections import OrderedDict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.core.timezone import today as ist_today
from app.db.session import get_db
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.reminder_repository import ReminderRepository
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category

router = APIRouter()


def _empty_daily_series(days: int) -> "OrderedDict[str, dict]":
    tznow = ist_today()
    start = tznow - timedelta(days=days - 1)
    return OrderedDict((d.isoformat(), {"date": d.isoformat(), "debit": 0, "credit": 0})
                       for d in (start + timedelta(days=i) for i in range(days)))


@router.get("/stats")
def stats(year: int | None = None, month: int | None = None, db: Session = Depends(get_db)):
    tx_repo = TransactionRepository(db)
    sub_repo = SubscriptionRepository(db)
    rem_repo = ReminderRepository(db)

    today = ist_today()
    year = year or today.year
    month = month or today.month
    daily = tx_repo.daily_summary(today)
    monthly = tx_repo.monthly_summary(year, month)
    pending_reminders = rem_repo.pending_due(before=today)

    # 14-day spending series for the dashboard chart.
    series = _empty_daily_series(14)
    rows = db.query(
        func.date(Transaction.date).label("day"),
        Transaction.type,
        func.sum(Transaction.amount).label("total"),
    ).filter(Transaction.date >= (today - timedelta(days=13))).group_by(func.date(Transaction.date), Transaction.type).all()
    for day, ttype, total in rows:
        key = str(day)
        if key in series:
            if ttype == TransactionType.DEBIT:
                series[key]["debit"] = float(total)
            else:
                series[key]["credit"] = float(total)

    # Category breakdown this month.
    by_category = db.query(
        Transaction.category_id, func.sum(Transaction.amount).label("total")
    ).filter(
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
        Transaction.type == TransactionType.DEBIT,
    ).group_by(Transaction.category_id).all()

    return {
        "period": f"{year:04d}-{month:02d}",
        "today_debit": daily["total_debit"],
        "today_credit": daily["total_credit"],
        "today_balance": daily["balance"],
        "month_debit": monthly["total_debit"],
        "month_credit": monthly["total_credit"],
        "month_balance": monthly["balance"],
        "subscription_monthly_total": sub_repo.monthly_total(),
        "upcoming_count": len(sub_repo.upcoming(days=30)),
        "pending_reminders": len(pending_reminders),
        "spending_series": list(series.values()),
        "category_totals": [{"category_id": c, "total": float(t)} for c, t in by_category],
        "categories": [
            {"id": c.id, "name": c.name, "color": c.color}
            for c in db.query(Category).all()
        ],
    }
