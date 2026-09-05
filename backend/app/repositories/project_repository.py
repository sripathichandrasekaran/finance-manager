from datetime import date
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.models.project import Project
from app.models.transaction import Transaction, TransactionType


class ProjectRepository:
    """Data-access layer for projects."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, company_id: int, name: str, service_sector: Optional[str] = None,
               pricing_type: Optional[str] = "fixed", fixed_price: Optional[float] = None,
               hourly_rate: Optional[float] = None, start_date: Optional[date] = None,
               end_date: Optional[date] = None, status: Optional[str] = "active",
               notes: Optional[str] = None, active: bool = True) -> Project:
        p = Project(
            company_id=company_id, name=name, service_sector=service_sector,
            pricing_type=pricing_type or "fixed", fixed_price=fixed_price,
            hourly_rate=hourly_rate, start_date=start_date, end_date=end_date,
            status=status or "active", notes=notes, active=active,
        )
        self.db.add(p)
        self.db.commit()
        self.db.refresh(p)
        return p

    def get(self, project_id: int) -> Optional[Project]:
        return self.db.query(Project).filter(Project.id == project_id).first()

    def list(self, company_id: Optional[int] = None) -> list[Project]:
        q = self.db.query(Project)
        if company_id:
            q = q.filter(Project.company_id == company_id)
        return q.order_by(Project.id.desc()).all()

    def update(self, project_id: int, fields: dict) -> Optional[Project]:
        p = self.get(project_id)
        if not p:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            if hasattr(p, key):
                setattr(p, key, value)
        self.db.commit()
        self.db.refresh(p)
        return p

    def delete(self, project_id: int) -> bool:
        p = self.get(project_id)
        if not p:
            return False
        # Unlink transactions so we don't orphan them.
        self.db.query(Transaction).filter(Transaction.project_id == project_id).update(
            {Transaction.project_id: None})
        self.db.delete(p)
        self.db.commit()
        return True

    def analytics(self, project_id: int) -> Optional[dict]:
        """Income, expenses and profit for a single project from its linked
        transactions (all time)."""
        p = self.get(project_id)
        if not p:
            return None
        income = self.db.query(func.coalesce(func.sum(
            case((Transaction.type == TransactionType.CREDIT, Transaction.amount), else_=0)), 0)
        ).filter(Transaction.project_id == project_id).scalar() or 0.0
        expenses = self.db.query(func.coalesce(func.sum(
            case((Transaction.type == TransactionType.DEBIT, Transaction.amount), else_=0)), 0)
        ).filter(Transaction.project_id == project_id).scalar() or 0.0
        return {
            "project_id": project_id,
            "income": float(income),
            "expenses": float(expenses),
            "profit": float(income - expenses),
        }

    def company_projects_with_analytics(self, company_id: int) -> list[dict]:
        projects = self.list(company_id=company_id)
        result = []
        for p in projects:
            a = self.analytics(p.id)
            result.append({
                "id": p.id,
                "name": p.name,
                "service_sector": p.service_sector,
                "pricing_type": p.pricing_type,
                "fixed_price": p.fixed_price,
                "hourly_rate": p.hourly_rate,
                "start_date": p.start_date.isoformat() if p.start_date else None,
                "end_date": p.end_date.isoformat() if p.end_date else None,
                "status": p.status,
                "active": p.active,
                "company_id": p.company_id,
                "analytics": a,
            })
        return result
