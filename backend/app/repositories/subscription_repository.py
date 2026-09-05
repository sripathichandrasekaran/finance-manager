from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.core.timezone import today as ist_today
from app.models.subscription import Subscription, BillingCycle


_CYCLE_DAYS = {
    BillingCycle.DAILY: 1,
    BillingCycle.WEEKLY: 7,
    BillingCycle.MONTHLY: 30,
    BillingCycle.YEARLY: 365,
}


class SubscriptionRepository:
    """Data-access layer for subscriptions."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, amount: float, billing_cycle: BillingCycle, next_billing: date,
               category: str = "Subscriptions", reminder_days_before: int = 3,
               company_id: Optional[int] = None, paid: bool = False) -> Subscription:
        sub = Subscription(
            name=name,
            amount=amount,
            billing_cycle=billing_cycle,
            next_billing=next_billing,
            category=category,
            reminder_days_before=reminder_days_before,
            company_id=company_id,
            paid=paid,
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)
        return sub

    def get(self, sub_id: int) -> Optional[Subscription]:
        return self.db.query(Subscription).filter(Subscription.id == sub_id).first()

    def list(self, active_only: bool = False) -> list[Subscription]:
        q = self.db.query(Subscription)
        if active_only:
            q = q.filter(Subscription.active == True)  # noqa: E712
        return q.order_by(Subscription.next_billing.asc()).all()

    def update(self, sub_id: int, fields: dict) -> Optional[Subscription]:
        sub = self.get(sub_id)
        if not sub:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            setattr(sub, key, value)
        self.db.commit()
        self.db.refresh(sub)
        return sub

    def delete(self, sub_id: int) -> bool:
        sub = self.get(sub_id)
        if not sub:
            return False
        self.db.delete(sub)
        self.db.commit()
        return True

    def upcoming(self, days: int = 30) -> list[Subscription]:
        today = ist_today()
        end = today + timedelta(days=days)
        return self.db.query(Subscription).filter(
            Subscription.active == True,  # noqa: E712
            Subscription.next_billing >= today,
            Subscription.next_billing <= end,
        ).order_by(Subscription.next_billing.asc()).all()

    def monthly_total(self) -> float:
        monthly_factor = {
            BillingCycle.DAILY: 30,
            BillingCycle.WEEKLY: 4.33,
            BillingCycle.MONTHLY: 1,
            BillingCycle.YEARLY: 1 / 12,
        }
        subs = self.db.query(Subscription).filter(
            Subscription.active == True  # noqa: E712
        ).all()
        total = sum(
            float(s.amount) * monthly_factor.get(s.billing_cycle, 1.0) for s in subs
        )
        return total or 0.0
