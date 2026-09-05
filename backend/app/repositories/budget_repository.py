from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.models.budget import Budget
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category


class BudgetRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, category_id: int, amount: float, year: int, month: int) -> Budget:
        budget = Budget(category_id=category_id, amount=amount, year=year, month=month)
        self.db.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def get(self, budget_id: int) -> Optional[Budget]:
        return self.db.query(Budget).filter(Budget.id == budget_id).first()

    def list(self, year: int, month: int) -> list[Budget]:
        return self.db.query(Budget).filter(
            Budget.year == year, Budget.month == month
        ).all()

    def update(self, budget_id: int, fields: dict) -> Optional[Budget]:
        budget = self.get(budget_id)
        if not budget:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            setattr(budget, key, value)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def delete(self, budget_id: int) -> bool:
        budget = self.db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            return False
        self.db.delete(budget)
        self.db.commit()
        return True

    def get_spent(self, category_id: int, year: int, month: int) -> float:
        """Calculate actual spending for a category in a given month."""
        result = self.db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.type == TransactionType.DEBIT,
            Transaction.category_id == category_id,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        ).scalar()
        return float(result or 0)
