from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.core.timezone import today as ist_today
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category


class TransactionRepository:
    """Data-access layer for transactions. Single-user, so no org scoping."""

    def __init__(self, db: Session):
        self.db = db

    def _resolve_category(self, category_name: Optional[str], category_id: Optional[int]) -> Optional[int]:
        if category_id:
            return category_id
        if category_name:
            cat = self.db.query(Category).filter(Category.name == category_name).first()
            if not cat:
                cat = Category(name=category_name)
                self.db.add(cat)
                self.db.flush()
            return cat.id
        return None

    def create(self, amount: float, type_: TransactionType, category: Optional[str] = None,
               category_id: Optional[int] = None, company_id: Optional[int] = None,
               project_id: Optional[int] = None,
               description: Optional[str] = None,
               date_: Optional[date] = None, is_ai_categorized: bool = False) -> Transaction:
        cat_id = self._resolve_category(category, category_id)
        tx = Transaction(
            amount=amount,
            type=type_,
            category_id=cat_id,
            company_id=company_id,
            project_id=project_id,
            description=description,
            date=date_ or ist_today(),
            is_ai_categorized=is_ai_categorized,
        )
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def get(self, tx_id: int) -> Optional[Transaction]:
        return self.db.query(Transaction).filter(Transaction.id == tx_id).first()

    def list(self, type_: Optional[TransactionType] = None, category: Optional[str] = None,
             company_id: Optional[int] = None,
             start_date: Optional[date] = None, end_date: Optional[date] = None,
             limit: int = 100) -> list[Transaction]:
        q = self.db.query(Transaction)
        if type_:
            q = q.filter(Transaction.type == type_)
        if category:
            q = q.join(Category).filter(Category.name == category)
        if company_id:
            q = q.filter(Transaction.company_id == company_id)
        if start_date:
            q = q.filter(Transaction.date >= start_date)
        if end_date:
            q = q.filter(Transaction.date <= end_date)
        return q.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit).all()

    def update(self, tx_id: int, fields: dict) -> Optional[Transaction]:
        tx = self.get(tx_id)
        if not tx:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            if key == "category":
                cat_id = self._resolve_category(value, None)
                tx.category_id = cat_id
            elif key == "category_id":
                tx.category_id = value
            elif key == "company_id":
                tx.company_id = value
            elif key == "project_id":
                tx.project_id = value
            elif key == "type":
                tx.type = value
            elif key == "amount":
                tx.amount = value
            elif key == "description":
                tx.description = value
            elif key == "date":
                tx.date = value
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def delete(self, tx_id: int) -> bool:
        tx = self.get(tx_id)
        if not tx:
            return False
        self.db.delete(tx)
        self.db.commit()
        return True

    def daily_summary(self, target: date) -> dict:
        row = self.db.query(
            func.coalesce(func.sum(case((Transaction.type == TransactionType.CREDIT, Transaction.amount), else_=0)), 0).label("credit"),
            func.coalesce(func.sum(case((Transaction.type == TransactionType.DEBIT, Transaction.amount), else_=0)), 0).label("debit"),
        ).filter(Transaction.date == target).one()
        return {
            "date": target.isoformat(),
            "total_credit": float(row.credit),
            "total_debit": float(row.debit),
            "balance": float(row.credit - row.debit),
        }

    def monthly_summary(self, year: int, month: int) -> dict:
        from sqlalchemy import extract
        row = self.db.query(
            func.coalesce(func.sum(case((Transaction.type == TransactionType.CREDIT, Transaction.amount), else_=0)), 0).label("credit"),
            func.coalesce(func.sum(case((Transaction.type == TransactionType.DEBIT, Transaction.amount), else_=0)), 0).label("debit"),
        ).filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        ).one()

        by_category = self.db.query(
            Category.name, func.sum(Transaction.amount).label("total")
        ).join(Transaction, Transaction.category_id == Category.id).filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.type == TransactionType.DEBIT,
        ).group_by(Category.name).order_by(func.sum(Transaction.amount).desc()).all()

        return {
            "year": year,
            "month": month,
            "total_credit": float(row.credit),
            "total_debit": float(row.debit),
            "balance": float(row.credit - row.debit),
            "by_category": [{"category": c, "total": float(t)} for c, t in by_category],
        }
