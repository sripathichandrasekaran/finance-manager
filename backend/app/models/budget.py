from sqlalchemy import Column, Integer, Float, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Budget(Base, TimestampMixin):
    """Monthly spending budget for a category."""

    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Float, nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)

    category = relationship("Category")
