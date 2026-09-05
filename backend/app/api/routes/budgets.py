from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.budget_repository import BudgetRepository
from app.models.category import Category
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetRead
from app.core.pagination import apply_sequence_pagination, set_pagination_headers

router = APIRouter()


@router.get("", response_model=list[BudgetRead])
def list_budgets(
    year: int,
    month: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    budgets = BudgetRepository(db).list(year=year, month=month)
    categories = {c.id: c.name for c in db.query(Category).all()}
    page_budgets, total = apply_sequence_pagination(budgets, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    result = []
    for b in page_budgets:
        d = BudgetRead.model_validate(b)
        d.category_name = categories.get(b.category_id)
        d.spent = BudgetRepository(db).get_spent(b.category_id, year, month)
        result.append(d)
    return result


@router.post("", response_model=BudgetRead, status_code=201)
def create_budget(payload: BudgetCreate, db: Session = Depends(get_db)):
    budget = BudgetRepository(db).create(
        category_id=payload.category_id,
        amount=payload.amount,
        year=payload.year,
        month=payload.month,
    )
    categories = {c.id: c.name for c in db.query(Category).all()}
    d = BudgetRead.model_validate(budget)
    d.category_name = categories.get(budget.category_id)
    d.spent = 0
    return d


@router.patch("/{budget_id}", response_model=BudgetRead)
def update_budget(budget_id: int, payload: BudgetUpdate, db: Session = Depends(get_db)):
    budget = BudgetRepository(db).update(budget_id, payload.model_dump(exclude_unset=True))
    if not budget:
        raise HTTPException(404, "Budget not found")
    categories = {c.id: c.name for c in db.query(Category).all()}
    d = BudgetRead.model_validate(budget)
    d.category_name = categories.get(budget.category_id)
    d.spent = BudgetRepository(db).get_spent(budget.category_id, budget.year, budget.month)
    return d


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    if not BudgetRepository(db).delete(budget_id):
        raise HTTPException(404, "Budget not found")
    return {"success": True}
