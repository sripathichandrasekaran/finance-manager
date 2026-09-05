from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionRead

from app.core.timezone import today as ist_today
from app.core.pagination import apply_sequence_pagination, set_pagination_headers

router = APIRouter()


def _to_read(tx) -> TransactionRead:
    return TransactionRead(
        id=tx.id,
        amount=tx.amount,
        type=tx.type,
        category=tx.category.name if tx.category else None,
        company_id=tx.company_id,
        project_id=tx.project_id,
        description=tx.description,
        date=tx.date,
        is_ai_categorized=tx.is_ai_categorized,
        created_at=tx.created_at,
    )


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    type_: str | None = Query(None, alias="type"),
    category: str | None = None,
    company_id: int | None = None,
    start_date: date | None = Query(None, alias="startDate"),
    end_date: date | None = Query(None, alias="endDate"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.models.transaction import TransactionType
    ttype = TransactionType(type_) if type_ in {"credit", "debit"} else None
    repo = TransactionRepository(db)
    rows = repo.list(type_=ttype, category=category, company_id=company_id,
                     start_date=start_date, end_date=end_date, limit=500)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return [_to_read(r) for r in page_rows]


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    repo = TransactionRepository(db)
    # Normalize an ISO date string to a `date` object (pydantic field is
    # Union[date, str] to work around a None-annotation quirk on this Python).
    tx_date = payload.date if isinstance(payload.date, date) else (
        datetime.fromisoformat(payload.date).date() if payload.date else None
    )
    tx = repo.create(
        amount=payload.amount,
        type_=payload.type,
        category=payload.category,
        category_id=payload.category_id,
        company_id=payload.company_id,
        project_id=payload.project_id,
        description=payload.description,
        date_=tx_date,
        is_ai_categorized=payload.is_ai_categorized,
    )
    return _to_read(tx)


@router.patch("/{tx_id}", response_model=TransactionRead)
def update_transaction(tx_id: int, payload: TransactionUpdate, db: Session = Depends(get_db)):
    repo = TransactionRepository(db)
    fields = payload.model_dump(exclude_unset=True)
    if "date" in fields and fields["date"] is not None and not isinstance(fields["date"], date):
        fields["date"] = datetime.fromisoformat(fields["date"]).date()
    tx = repo.update(tx_id, fields)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    return _to_read(tx)


@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    repo = TransactionRepository(db)
    if not repo.delete(tx_id):
        raise HTTPException(404, "Transaction not found")
    return {"success": True}


@router.get("/summary/daily")
def daily_summary(db: Session = Depends(get_db)):
    return TransactionRepository(db).daily_summary(ist_today())


@router.get("/summary/monthly")
def monthly_summary(year: int, month: int, db: Session = Depends(get_db)):
    return TransactionRepository(db).monthly_summary(year, month)
