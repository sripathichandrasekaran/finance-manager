from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.core.timezone import today as ist_today, iso as _iso
from app.db.session import get_db
from app.repositories.transaction_repository import TransactionRepository
from app.services.ai_service import (
    ai_configured,
    parse_transaction,
    generate_insights,
    build_insights_payload,
)
from app.services.agent_service import run_agent
from app.repositories.ai_session_repository import AISessionRepository
from app.schemas.ai_session import AISessionUpsert, AISessionRead

router = APIRouter()


class ParseRequest(BaseModel):
    text: str


class InsightsRequest(BaseModel):
    year: int | None = None
    month: int | None = None


class AgentMessage(BaseModel):
    role: str = "user"
    content: str


class AgentChatRequest(BaseModel):
    message: str
    history: list[AgentMessage] | None = None


@router.get("/status")
def ai_status():
    return {"configured": ai_configured()}


@router.post("/parse-transaction")
def parse(payload: ParseRequest):
    if not payload.text.strip():
        raise HTTPException(400, "No text provided")
    if not ai_configured():
        raise HTTPException(503, "AI not configured: set ANTHROPIC_API_KEY in .env")
    result = parse_transaction(payload.text)
    if result is None:
        raise HTTPException(422, "Could not parse transaction")
    return result


@router.post("/agent-chat")
def agent_chat(payload: AgentChatRequest, db: Session = Depends(get_db)):
    """Agent-powered chat assistant. Claude detects intent, calls the right
    module tool (transactions, subscriptions, companies, budgets, time,
    reminders), and replies in natural language."""
    if not payload.message.strip():
        raise HTTPException(400, "No message provided")
    if not ai_configured():
        raise HTTPException(503, "AI not configured: set ANTHROPIC_API_KEY in .env")
    history = [{"role": m.role, "content": m.content} for m in (payload.history or [])]
    try:
        result = run_agent(db, payload.message, history)
    except Exception as exc:  # noqa: BLE001
        print(f"[AI] agent_chat failed: {exc}")
        raise HTTPException(502, f"AI agent failed: {exc}")
    result["configured"] = True
    return result


@router.post("/insights")
def insights(payload: InsightsRequest, db: Session = Depends(get_db)):
    today = ist_today()
    year = payload.year or today.year
    month = payload.month or today.month
    if not ai_configured():
        return {"available": False, "insights": None}

    text = generate_insights(db, year, month)
    if text is None:
        raise HTTPException(502, "AI failed to generate insights")
    return {"available": True, "insights": text, "payload": build_insights_payload(db, year, month)}


def _session_read(s) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "messages": AISessionRepository._load(s.messages),
    "created_at": _iso(s.created_at),
    "updated_at": _iso(s.updated_at),
    }


@router.get("/sessions")
def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """Return all persisted AI conversations, newest first."""
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    rows = AISessionRepository(db).list(limit=500)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return [_session_read(s) for s in page_rows]


@router.post("/sessions", response_model=AISessionRead)
def upsert_session(payload: AISessionUpsert, db: Session = Depends(get_db)):
    """Create or update a persisted conversation from the client's session."""
    repo = AISessionRepository(db)
    msgs = [m.model_dump() for m in payload.messages]
    saved = repo.upsert(payload.id, payload.title, msgs)
    return _session_read(saved)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    if not AISessionRepository(db).delete(session_id):
        raise HTTPException(404, "Session not found")
    return {"deleted": True}
