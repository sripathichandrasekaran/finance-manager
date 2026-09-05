from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.project_repository import ProjectRepository
from app.repositories.transaction_repository import TransactionRepository
from app.models.company import Company
from app.models.project import Project
from app.models.transaction import Transaction
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectRead

router = APIRouter()


def _to_read(db: Session, p: Project) -> ProjectRead:
    company = db.query(Company).filter(Company.id == p.company_id).first()
    repo = ProjectRepository(db)
    return ProjectRead(
        id=p.id,
        company_id=p.company_id,
        company_name=company.name if company else None,
        name=p.name,
        service_sector=p.service_sector,
        pricing_type=p.pricing_type,
        fixed_price=p.fixed_price,
        hourly_rate=p.hourly_rate,
        start_date=p.start_date,
        end_date=p.end_date,
        status=p.status,
        notes=p.notes,
        active=p.active,
        analytics=repo.analytics(p.id),
    )


def _norm_date(v):
    if v is None:
        return None
    if isinstance(v, date):
        return v
    return datetime.fromisoformat(v).date()


@router.get("", response_model=list[ProjectRead])
def list_projects(
    company_id: int | None = None,
    active: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    repo = ProjectRepository(db)
    rows = repo.list(company_id=company_id)
    if active:
        rows = [r for r in rows if r.active]
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return [_to_read(db, r) for r in page_rows]


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    repo = ProjectRepository(db)
    p = repo.create(
        company_id=payload.company_id,
        name=payload.name,
        service_sector=payload.service_sector,
        pricing_type=payload.pricing_type,
        fixed_price=payload.fixed_price,
        hourly_rate=payload.hourly_rate,
        start_date=_norm_date(payload.start_date),
        end_date=_norm_date(payload.end_date),
        status=payload.status,
        notes=payload.notes,
    )
    return _to_read(db, p)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = ProjectRepository(db).get(project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return _to_read(db, p)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    fields = payload.model_dump(exclude_unset=True)
    if "start_date" in fields:
        fields["start_date"] = _norm_date(fields["start_date"])
    if "end_date" in fields:
        fields["end_date"] = _norm_date(fields["end_date"])
    p = repo.update(project_id, fields)
    if not p:
        raise HTTPException(404, "Project not found")
    return _to_read(db, p)


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    if not ProjectRepository(db).delete(project_id):
        raise HTTPException(404, "Project not found")
    return {"success": True}


@router.get("/{project_id}/analytics")
def project_analytics(project_id: int, db: Session = Depends(get_db)):
    a = ProjectRepository(db).analytics(project_id)
    if a is None:
        raise HTTPException(404, "Project not found")
    return a


@router.get("/report/company/{company_id}/analytics")
def company_project_analytics(company_id: int, db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    projects = repo.company_projects_with_analytics(company_id)
    income = sum(p["analytics"]["income"] for p in projects)
    expenses = sum(p["analytics"]["expenses"] for p in projects)
    return {
        "company_id": company_id,
        "project_count": len(projects),
        "active_count": sum(1 for p in projects if p["active"]),
        "income": income,
        "expenses": expenses,
        "profit": income - expenses,
        "projects": projects,
    }


@router.get("/unassigned/transactions")
def unassigned_transactions(
    company_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    q = db.query(Transaction).filter(Transaction.project_id.is_(None))
    if company_id:
        q = q.filter(Transaction.company_id == company_id)
    rows = q.order_by(Transaction.date.desc()).all()
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    from app.api.routes.transactions import _to_read
    return [_to_read(r) for r in page_rows]


@router.post("/{project_id}/transactions/{tx_id}")
def link_transaction(project_id: int, tx_id: int, db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    if not repo.get(project_id):
        raise HTTPException(404, "Project not found")
    tx = TransactionRepository(db).get(tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    tx.project_id = project_id
    db.commit()
    db.refresh(tx)
    return {"success": True, "project_id": project_id, "transaction_id": tx_id}
