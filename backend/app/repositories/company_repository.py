from datetime import date
from typing import Optional
from sqlalchemy.orm import Session

from app.models.company import Company


def _parse_date(value):
    """Convert an ISO date string to a Python date object."""
    if value is None or isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return value


class CompanyRepository:
    """Data-access layer for companies/clients."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, industry: Optional[str] = None,
               contact_email: Optional[str] = None, notes: Optional[str] = None,
               active: bool = True, hourly_rate: Optional[float] = None,
               fixed_price: Optional[float] = None, contract_type: Optional[str] = None,
               contract_start=None, contract_end=None,
               payment_terms: Optional[str] = None,
               gstin: Optional[str] = None,
               billing_address: Optional[str] = None,
               city: Optional[str] = None, state: Optional[str] = None,
               state_code: Optional[str] = None, pincode: Optional[str] = None) -> Company:
        comp = Company(name=name, industry=industry, contact_email=contact_email,
                       notes=notes, active=active, hourly_rate=hourly_rate,
                       fixed_price=fixed_price, contract_type=contract_type,
                       contract_start=_parse_date(contract_start),
                       contract_end=_parse_date(contract_end),
                       payment_terms=payment_terms,
                       gstin=gstin, billing_address=billing_address,
                       city=city, state=state, state_code=state_code,
                       pincode=pincode)
        self.db.add(comp)
        self.db.commit()
        self.db.refresh(comp)
        return comp

    def get(self, comp_id: int) -> Optional[Company]:
        return self.db.query(Company).filter(Company.id == comp_id).first()

    def list(self, active_only: bool = False) -> list[Company]:
        q = self.db.query(Company)
        if active_only:
            q = q.filter(Company.active == True)  # noqa: E712
        return q.order_by(Company.name.asc()).all()

    def update(self, comp_id: int, fields: dict) -> Optional[Company]:
        comp = self.get(comp_id)
        if not comp:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            if key in ("contract_start", "contract_end"):
                value = _parse_date(value)
            setattr(comp, key, value)
        self.db.commit()
        self.db.refresh(comp)
        return comp

    def delete(self, comp_id: int) -> bool:
        comp = self.get(comp_id)
        if not comp:
            return False
        self.db.delete(comp)
        self.db.commit()
        return True
