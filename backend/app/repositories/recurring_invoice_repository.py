"""Data-access layer for recurring invoices."""
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models.subscription import RecurringInvoice, RecurringInvoiceLineItem


class RecurringInvoiceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, company_id: int, billing_cycle: str,
               next_generation: date, tax_rate: float = 0.0,
               project_id: Optional[int] = None, notes: Optional[str] = None,
               auto_send: bool = False,
               items: Optional[list[dict]] = None,
               active: bool = True) -> RecurringInvoice:
        ri = RecurringInvoice(
            name=name,
            company_id=company_id,
            project_id=project_id,
            billing_cycle=billing_cycle,
            next_generation=next_generation,
            tax_rate=tax_rate or 0.0,
            notes=notes,
            auto_send=auto_send,
            active=active,
        )
        self.db.add(ri)
        self.db.flush()
        for it in items or []:
            self.db.add(RecurringInvoiceLineItem(
                recurring_invoice_id=ri.id,
                description=it.get("description"),
                quantity=it.get("quantity") or 1.0,
                unit_price=it.get("unit_price") or 0.0,
            ))
        self.db.commit()
        self.db.refresh(ri)
        return ri

    def get(self, recurring_id: int) -> Optional[RecurringInvoice]:
        return self.db.query(RecurringInvoice).filter(RecurringInvoice.id == recurring_id).first()

    def list(self, company_id: Optional[int] = None, active_only: bool = False) -> list[RecurringInvoice]:
        q = self.db.query(RecurringInvoice)
        if company_id:
            q = q.filter(RecurringInvoice.company_id == company_id)
        if active_only:
            q = q.filter(RecurringInvoice.active == True)
        return q.order_by(RecurringInvoice.id.desc()).all()

    def update(self, recurring_id: int, fields: dict) -> Optional[RecurringInvoice]:
        ri = self.get(recurring_id)
        if not ri:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            if hasattr(ri, key):
                setattr(ri, key, value)
        if "items" in fields and fields["items"] is not None:
            new_items = fields["items"]
            self.db.query(RecurringInvoiceLineItem).filter(
                RecurringInvoiceLineItem.recurring_invoice_id == recurring_id).delete()
            for it in new_items:
                self.db.add(RecurringInvoiceLineItem(
                    recurring_invoice_id=recurring_id,
                    description=it.get("description"),
                    quantity=it.get("quantity") or 1.0,
                    unit_price=it.get("unit_price") or 0.0,
                ))
            self.db.flush()
        self.db.commit()
        self.db.refresh(ri)
        return ri

    def delete(self, recurring_id: int) -> bool:
        ri = self.get(recurring_id)
        if not ri:
            return False
        self.db.delete(ri)
        self.db.commit()
        return True

    @staticmethod
    def subtotal(items: list[RecurringInvoiceLineItem]) -> float:
        return round(sum((i.quantity or 0) * (i.unit_price or 0) for i in items), 2)

    @staticmethod
    def totals(ri: RecurringInvoice) -> dict:
        subtotal = RecurringInvoiceRepository.subtotal(ri.items)
        tax = round(subtotal * (ri.tax_rate or 0.0) / 100.0, 2)
        total = round(subtotal + tax, 2)
        return {
            "subtotal": subtotal,
            "tax": tax,
            "total": total,
        }

    def get_due_today(self, today: date) -> list[RecurringInvoice]:
        """Get all active recurring invoices due for generation today or earlier."""
        return self.db.query(RecurringInvoice).filter(
            RecurringInvoice.active == True,
            RecurringInvoice.next_generation <= today
        ).all()

    def advance_next_generation(self, ri: RecurringInvoice, billing_cycle: str) -> None:
        """Advance the next_generation date based on billing cycle."""
        import calendar
        from datetime import timedelta
        from app.models.subscription import BillingCycle

        if billing_cycle == BillingCycle.DAILY.value:
            ri.next_generation = ri.next_generation + timedelta(days=1)
        elif billing_cycle == BillingCycle.WEEKLY.value:
            ri.next_generation = ri.next_generation + timedelta(weeks=1)
        elif billing_cycle == BillingCycle.MONTHLY.value:
            # One month ahead, clamping the day for shorter months (e.g. Jan 31 -> Feb 28).
            year = ri.next_generation.year
            month = ri.next_generation.month + 1
            if month > 12:
                month = 1
                year += 1
            day = min(ri.next_generation.day, calendar.monthrange(year, month)[1])
            ri.next_generation = ri.next_generation.replace(year=year, month=month, day=day)
        elif billing_cycle == BillingCycle.YEARLY.value:
            try:
                ri.next_generation = ri.next_generation.replace(year=ri.next_generation.year + 1)
            except ValueError:
                ri.next_generation = ri.next_generation.replace(
                    year=ri.next_generation.year + 1, day=28)
        else:
            ri.next_generation = ri.next_generation + timedelta(days=1)
        self.db.commit()