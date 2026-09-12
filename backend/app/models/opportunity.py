from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Opportunity(Base, TimestampMixin):
    """A freelance opportunity captured from online sources (subreddits like
    r/forhire, job feeds such as Remotive/RemoteOK, marketplace APIs). Each is
    keyword-scored against the user's service profile, tracked through a small
    pipeline (new → applied → replied → won/lost) and, once won, becomes a
    Company + Project in the finance side of the manager."""

    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True)
    source = Column(String(30), nullable=False)
    source_key = Column(String(160), nullable=False, unique=True)
    source_label = Column(String(80), nullable=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)
    posted_at = Column(DateTime, nullable=True)
    budget_min = Column(Float, nullable=True)
    budget_max = Column(Float, nullable=True)
    currency = Column(String(10), nullable=True)
    location = Column(String(120), nullable=True)
    skills = Column(String(300), nullable=True)
    score = Column(Integer, default=0, nullable=False)
    fit_reason = Column(Text, nullable=True)
    draft = Column(Text, nullable=True)
    status = Column(String(20), default="new", nullable=False)
    notes = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    company = relationship("Company")
    project = relationship("Project")