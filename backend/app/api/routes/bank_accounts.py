from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories import BankAccountRepository
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate, BankAccountRead

router = APIRouter()


@router.get("", response_model=list[BankAccountRead])
def list_bank_accounts(
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    repo = BankAccountRepository(db)
    return repo.list(active_only=active_only)


@router.post("", response_model=BankAccountRead, status_code=201)
def create_bank_account(payload: BankAccountCreate, db: Session = Depends(get_db)):
    repo = BankAccountRepository(db)
    acct = repo.create(**payload.model_dump())
    return acct


@router.get("/{acct_id}", response_model=BankAccountRead)
def get_bank_account(acct_id: int, db: Session = Depends(get_db)):
    repo = BankAccountRepository(db)
    acct = repo.get(acct_id)
    if not acct:
        raise HTTPException(404, "Bank account not found")
    return acct


@router.patch("/{acct_id}", response_model=BankAccountRead)
def update_bank_account(acct_id: int, payload: BankAccountUpdate, db: Session = Depends(get_db)):
    repo = BankAccountRepository(db)
    fields = payload.model_dump(exclude_unset=True)
    acct = repo.update(acct_id, fields)
    if not acct:
        raise HTTPException(404, "Bank account not found")
    return acct


@router.delete("/{acct_id}")
def delete_bank_account(acct_id: int, db: Session = Depends(get_db)):
    repo = BankAccountRepository(db)
    if not repo.delete(acct_id):
        raise HTTPException(404, "Bank account not found")
    return {"success": True}