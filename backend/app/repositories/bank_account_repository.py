from datetime import date
from typing import Optional
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount, BankAccountType


def _parse_date(value):
    """Convert an ISO date string to a Python date object."""
    if value is None or isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return value


def _parse_type(value):
    """Convert string to BankAccountType enum."""
    if value is None:
        return BankAccountType.CHECKING
    if isinstance(value, BankAccountType):
        return value
    try:
        return BankAccountType(value)
    except ValueError:
        return BankAccountType.CHECKING


class BankAccountRepository:
    """Data-access layer for bank accounts."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, type: str = "checking",
               bank_name: Optional[str] = None, account_number: Optional[str] = None,
               iban: Optional[str] = None, swift_bic: Optional[str] = None,
               currency: str = "INR", balance: float = 0.0,
               is_active: bool = True, notes: Optional[str] = None) -> BankAccount:
        acct = BankAccount(
            name=name, type=_parse_type(type), bank_name=bank_name, account_number=account_number,
            iban=iban, swift_bic=swift_bic, currency=currency,
            balance=balance, is_active=is_active, notes=notes
        )
        self.db.add(acct)
        self.db.commit()
        self.db.refresh(acct)
        return acct

    def get(self, acct_id: int) -> Optional[BankAccount]:
        return self.db.query(BankAccount).filter(BankAccount.id == acct_id).first()

    def list(self, active_only: bool = False) -> list[BankAccount]:
        q = self.db.query(BankAccount)
        if active_only:
            q = q.filter(BankAccount.is_active == True)  # noqa: E712
        return q.order_by(BankAccount.name.asc()).all()

    def update(self, acct_id: int, fields: dict) -> Optional[BankAccount]:
        acct = self.get(acct_id)
        if not acct:
            return None
        for key, value in fields.items():
            if value is None or key in ("id",):
                continue
            if key == "type":
                value = _parse_type(value)
            setattr(acct, key, value)
        self.db.commit()
        self.db.refresh(acct)
        return acct

    def delete(self, acct_id: int) -> bool:
        acct = self.get(acct_id)
        if not acct:
            return False
        self.db.delete(acct)
        self.db.commit()
        return True