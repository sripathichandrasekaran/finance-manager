from sqlalchemy import Column, Integer, Float, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy import Date
from sqlalchemy import Enum as SAEnum
import enum
from datetime import datetime

from app.db.session import Base
from app.models.base import TimestampMixin


class TransactionType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"


class Transaction(Base, TimestampMixin):
    """A single money movement: either income (credit) or expense (debit)."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    amount = Column(Float, nullable=False)
    type = Column(SAEnum(TransactionType), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    description = Column(Text, nullable=True)
    date = Column(Date, nullable=False, index=True)
    is_ai_categorized = Column(Boolean, default=False, nullable=False)

    category = relationship("Category", back_populates="transactions")
    company = relationship("Company", back_populates="transactions")
    project = relationship("Project", back_populates="transactions")
