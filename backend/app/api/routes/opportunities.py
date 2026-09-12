from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.pagination import set_pagination_headers
from app.db.session import get_db
from app.models.opportunity import Opportunity
from app.repositories.opportunity_repository import OpportunityRepository
from app.schemas.opportunity import (
    OpportunityRead,
    OpportunityStats,
    OpportunityUpdate,
    RefreshResult,
    MarkWonPayload,
)
from app.services.gig_radar import service as radar

router = APIRouter()

VALID_STATUSES = {"new", "applied", "replied", "won", "lost", "ignored"}


def _to_read(opp: Opportunity) -> OpportunityRead:
    return OpportunityRead(
        id=opp.id,
        source=opp.source,
        source_label=opp.source_label,
        title=opp.title,
        description=opp.description,
        url=opp.url,
        posted_at=opp.posted_at,
        budget_min=opp.budget_min,
        budget_max=opp.budget_max,
        currency=opp.currency,
        location=opp.location,
        skills=opp.skills,
        score=opp.score,
        fit_reason=opp.fit_reason,
        draft=opp.draft,
        status=opp.status,
        notes=opp.notes,
        company_id=opp.company_id,
        project_id=opp.project_id,
        created_at=opp.created_at,
    )


@router.get("", response_model=list[OpportunityRead])
def list_opportunities(
    status: str | None = Query(None),
    min_score: int | None = Query(None, ge=0, le=100),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    response: Response = None,
    db: Session = Depends(get_db),
):
    repo = OpportunityRepository(db)
    rows = repo.list(status=status, min_score=min_score, q=q, page=page, page_size=page_size)
    total = repo.count(status=status, min_score=min_score, q=q)
    records = [_to_read(r) for r in rows]
    set_pagination_headers(response, total, page, page_size)
    return records


@router.get("/stats", response_model=OpportunityStats)
def opportunity_stats(db: Session = Depends(get_db)):
    return OpportunityRepository(db).stats()


@router.post("/refresh", response_model=RefreshResult)
def refresh_opportunities():
    return radar.refresh_now()


@router.get("/{opportunity_id}", response_model=OpportunityRead)
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    opp = OpportunityRepository(db).get(opportunity_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    return _to_read(opp)


@router.patch("/{opportunity_id}", response_model=OpportunityRead)
def update_opportunity(opportunity_id: int, payload: OpportunityUpdate, db: Session = Depends(get_db)):
    fields = payload.model_dump(exclude_unset=True)
    if "status" in fields and fields["status"] not in VALID_STATUSES:
        raise HTTPException(422, f"Invalid status '{fields['status']}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}")
    repo = OpportunityRepository(db)
    opp = repo.update(opportunity_id, fields)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    return _to_read(opp)


@router.delete("/{opportunity_id}")
def delete_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    if not OpportunityRepository(db).delete(opportunity_id):
        raise HTTPException(404, "Opportunity not found")
    return {"success": True}


@router.post("/{opportunity_id}/draft", response_model=OpportunityRead)
def generate_draft(opportunity_id: int, db: Session = Depends(get_db)):
    repo = OpportunityRepository(db)
    opp = repo.get(opportunity_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    try:
        text = radar.draft_proposal(db, opp)
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
    if not text:
        raise HTTPException(400, "AI is not configured — set ANTHROPIC_API_KEY to generate drafts")
    opp = repo.update(opportunity_id, {"draft": text})
    return _to_read(opp)


@router.post("/{opportunity_id}/won", response_model=OpportunityRead)
def mark_as_won(opportunity_id: int, payload: MarkWonPayload, db: Session = Depends(get_db)):
    repo = OpportunityRepository(db)
    opp = repo.get(opportunity_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    radar.mark_won(
        db,
        opp,
        company_name=payload.company_name,
        project_name=payload.project_name,
        amount=payload.amount,
        notes=payload.notes,
    )
    return _to_read(repo.get(opportunity_id))