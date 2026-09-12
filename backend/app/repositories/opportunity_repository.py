from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity


class OpportunityRepository:
    """Data-access layer for captured freelance opportunities."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_source_key(self, source_key: str) -> Optional[Opportunity]:
        return (
            self.db.query(Opportunity)
            .filter(Opportunity.source_key == source_key)
            .first()
        )

    def get(self, opportunity_id: int) -> Optional[Opportunity]:
        return (
            self.db.query(Opportunity)
            .filter(Opportunity.id == opportunity_id)
            .first()
        )

    def create(
        self,
        *,
        source: str,
        source_key: str,
        source_label: Optional[str],
        title: str,
        description: Optional[str] = None,
        url: Optional[str] = None,
        posted_at=None,
        budget_min: Optional[float] = None,
        budget_max: Optional[float] = None,
        currency: Optional[str] = None,
        location: Optional[str] = None,
        skills: Optional[str] = None,
        score: int = 0,
        fit_reason: Optional[str] = None,
    ) -> Opportunity:
        opp = Opportunity(
            source=source,
            source_key=source_key,
            source_label=source_label,
            title=title,
            description=description,
            url=url,
            posted_at=posted_at,
            budget_min=budget_min,
            budget_max=budget_max,
            currency=currency,
            location=location,
            skills=skills,
            score=score,
            fit_reason=fit_reason,
        )
        self.db.add(opp)
        self.db.commit()
        self.db.refresh(opp)
        return opp

    def refresh_fields(self, opportunity_id: int, fields: dict) -> Optional[Opportunity]:
        """Refresh incoming/regeneratable fields on an untouched opportunity.
        User-owned fields (status, draft, notes, company/project links) are kept."""
        opp = self.get(opportunity_id)
        if not opp:
            return None
        if opp.status != "new":
            return opp
        for key in ("title", "description", "url", "posted_at", "budget_min",
                    "budget_max", "currency", "location", "skills", "score", "fit_reason"):
            if key in fields and fields[key] is not None:
                setattr(opp, key, fields[key])
        self.db.commit()
        self.db.refresh(opp)
        return opp

    def list(
        self,
        status: Optional[str] = None,
        min_score: Optional[int] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 100,
    ) -> list[Opportunity]:
        query = self.db.query(Opportunity)
        if status and status != "all":
            query = query.filter(Opportunity.status == status)
        if min_score:
            query = query.filter(Opportunity.score >= min_score)
        if q:
            query = query.filter(Opportunity.title.ilike(f"%{q}%"))
        query = query.order_by(
            Opportunity.score.desc(), Opportunity.id.desc()
        )
        return query.offset((page - 1) * page_size).limit(page_size).all()

    def count_total(self) -> int:
        return self.db.query(func.count(Opportunity.id)).scalar() or 0

    def count(
        self,
        status: Optional[str] = None,
        min_score: Optional[int] = None,
        q: Optional[str] = None,
    ) -> int:
        query = self.db.query(Opportunity)
        if status and status != "all":
            query = query.filter(Opportunity.status == status)
        if min_score:
            query = query.filter(Opportunity.score >= min_score)
        if q:
            query = query.filter(Opportunity.title.ilike(f"%{q}%"))
        return query.count()

    def stats(self) -> dict:
        rows = (
            self.db.query(Opportunity.status, func.count(Opportunity.id))
            .group_by(Opportunity.status)
            .all()
        )
        counts = {status: count for status, count in rows}
        drafted = (
            self.db.query(func.count(Opportunity.id))
            .filter(Opportunity.draft.isnot(None))
            .scalar()
            or 0
        )
        return {
            "total": self.count_total(),
            "new": counts.get("new", 0),
            "applied": counts.get("applied", 0),
            "replied": counts.get("replied", 0),
            "won": counts.get("won", 0),
            "lost": counts.get("lost", 0),
            "ignored": counts.get("ignored", 0),
            "drafted": drafted,
        }

    def update(self, opportunity_id: int, fields: dict) -> Optional[Opportunity]:
        opp = self.get(opportunity_id)
        if not opp:
            return None
        for key, value in fields.items():
            if value is None or key in ("id", "source_key", "source"):
                continue
            setattr(opp, key, value)
        self.db.commit()
        self.db.refresh(opp)
        return opp

    def delete(self, opportunity_id: int) -> bool:
        opp = self.get(opportunity_id)
        if not opp:
            return False
        self.db.delete(opp)
        self.db.commit()
        return True