from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from datetime import date

from app.core.timezone import today as ist_today
from app.db.session import get_db
from app.repositories.time_entry_repository import TimeEntryRepository
from app.repositories.company_repository import CompanyRepository
from app.schemas.time_entry import TimeEntryCreate, TimeEntryUpdate, TimeEntryRead
from app.core.pagination import apply_sequence_pagination, set_pagination_headers

router = APIRouter()


def _enrich(entries, db):
    """Attach company_name to each entry."""
    companies = {c.id: c.name for c in CompanyRepository(db).list()}
    result = []
    for e in entries:
        d = TimeEntryRead.model_validate(e)
        d.company_name = companies.get(e.company_id)
        result.append(d)
    return result


@router.get("", response_model=list[TimeEntryRead])
def list_time_entries(
    company_id: int = None,
    start_date: str = None,
    end_date: str = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    entries = TimeEntryRepository(db).list(
        company_id=company_id,
        start_date=start_date,
        end_date=end_date,
    )
    page_entries, total = apply_sequence_pagination(entries, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return _enrich(page_entries, db)


@router.post("", response_model=TimeEntryRead, status_code=201)
def create_time_entry(payload: TimeEntryCreate, db: Session = Depends(get_db)):
    entry = TimeEntryRepository(db).create(
        company_id=payload.company_id,
        description=payload.description,
        hours=payload.hours,
        hourly_rate=payload.hourly_rate,
        date=payload.date,
    )
    return _enrich([entry], db)[0]


@router.patch("/{entry_id}", response_model=TimeEntryRead)
def update_time_entry(entry_id: int, payload: TimeEntryUpdate, db: Session = Depends(get_db)):
    entry = TimeEntryRepository(db).update(entry_id, payload.model_dump(exclude_unset=True))
    if not entry:
        raise HTTPException(404, "Time entry not found")
    return _enrich([entry], db)[0]


@router.delete("/{entry_id}")
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    if not TimeEntryRepository(db).delete(entry_id):
        raise HTTPException(404, "Time entry not found")
    return {"success": True}


@router.get("/summary")
def time_summary(
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
):
    """Summary of hours and earnings by company."""
    today = ist_today()
    year = year or today.year
    month = month or today.month

    from datetime import date as d
    start = d(year, month, 1)
    if month == 12:
        end = d(year + 1, 1, 1)
    else:
        end = d(year, month + 1, 1)

    entries = TimeEntryRepository(db).list(start_date=str(start), end_date=str(end))
    companies = {c.id: c.name for c in CompanyRepository(db).list()}

    total_hours = sum(e.hours for e in entries)
    total_earned = sum(
        e.hours * (e.hourly_rate or 0) for e in entries
    )

    by_company = {}
    for e in entries:
        cid = e.company_id or 0
        name = companies.get(cid, "No Company")
        if cid not in by_company:
            by_company[cid] = {"company_id": cid, "name": name, "hours": 0, "earned": 0}
        by_company[cid]["hours"] += e.hours
        by_company[cid]["earned"] += e.hours * (e.hourly_rate or 0)

    return {
        "total_hours": total_hours,
        "total_earned": total_earned,
        "by_company": list(by_company.values()),
        "entry_count": len(entries),
    }
