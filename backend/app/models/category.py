from sqlalchemy import Column, Integer, String, Float, Boolean, Date
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Category(Base, TimestampMixin):
    """User-defined spending category (Food, Transport, Salary, ...).
    Referenced by transactions for grouping/summaries."""

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False, unique=True)
    color = Column(String(20), nullable=True)
    icon = Column(String(20), nullable=True)

    transactions = relationship("Transaction", back_populates="category")
