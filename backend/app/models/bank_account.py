from sqlalchemy import Column, Integer, String, Float, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum

from app.db.session import Base
from app.models.base import TimestampMixin


class BankAccountType(str, enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"
    CASH = "cash"
    INVESTMENT = "investment"
    OTHER = "other"


class BankAccount(Base, TimestampMixin):
    """A bank account or financial instrument for tracking transactions."""

    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    type = Column(SAEnum(BankAccountType), nullable=False, default=BankAccountType.CHECKING)
    bank_name = Column(String(120), nullable=True)
    account_number = Column(String(40), nullable=True)
    iban = Column(String(34), nullable=True)
    swift_bic = Column(String(20), nullable=True)
    currency = Column(String(3), nullable=False, default="INR")
    balance = Column(Float, nullable=False, default=0.0)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    transactions = relationship("Transaction", back_populates="bank_account")