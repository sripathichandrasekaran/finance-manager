from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.repositories.subscription_repository import SubscriptionRepository
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate, SubscriptionRead
from app.core.pagination import apply_sequence_pagination, set_pagination_headers

router = APIRouter()


@router.get("", response_model=list[SubscriptionRead])
def list_subscriptions(
    active: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    rows = SubscriptionRepository(db).list(active_only=active)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return page_rows


@router.post("", response_model=SubscriptionRead, status_code=201)
def create_subscription(payload: SubscriptionCreate, db: Session = Depends(get_db)):
    return SubscriptionRepository(db).create(
        name=payload.name,
        amount=payload.amount,
        billing_cycle=payload.billing_cycle,
        next_billing=payload.next_billing,
        category=payload.category,
        reminder_days_before=payload.reminder_days_before,
        company_id=payload.company_id,
        paid=payload.paid,
    )


@router.patch("/{sub_id}", response_model=SubscriptionRead)
def update_subscription(sub_id: int, payload: SubscriptionUpdate, db: Session = Depends(get_db)):
    sub = SubscriptionRepository(db).update(sub_id, payload.model_dump(exclude_unset=True))
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return sub


@router.delete("/{sub_id}")
def delete_subscription(sub_id: int, db: Session = Depends(get_db)):
    repo = SubscriptionRepository(db)
    if not repo.delete(sub_id):
        raise HTTPException(404, "Subscription not found")
    return {"success": True}


@router.get("/summary/upcoming")
def upcoming_subscriptions(days: int = 30, db: Session = Depends(get_db)):
    repo = SubscriptionRepository(db)
    return {
        "upcoming": repo.upcoming(days=days),
        "monthly_total": repo.monthly_total(),
    }
