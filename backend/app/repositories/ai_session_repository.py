import json
from typing import Optional
from sqlalchemy.orm import Session

from app.models.ai_session import AISession


class AISessionRepository:
    """Data-access layer for persisted AI assistant conversations."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _dump(messages) -> str:
        return json.dumps(messages, default=str)

    @staticmethod
    def _load(messages: str) -> list:
        try:
            parsed = json.loads(messages)
            return parsed if isinstance(parsed, list) else []
        except (TypeError, ValueError):
            return []

    def get(self, session_id: str) -> Optional[AISession]:
        return self.db.query(AISession).filter(AISession.id == session_id).first()

    def list(self, limit: int = 50) -> list[AISession]:
        return (
            self.db.query(AISession)
            .order_by(AISession.updated_at.desc(), AISession.created_at.desc())
            .limit(limit)
            .all()
        )

    def upsert(self, session_id: str, title: Optional[str], messages: list) -> AISession:
        session = self.get(session_id)
        if session is None:
            session = AISession(id=session_id, title=title, messages=self._dump(messages))
            self.db.add(session)
        else:
            if title is not None:
                session.title = title
            session.messages = self._dump(messages)
        self.db.commit()
        self.db.refresh(session)
        return session

    def delete(self, session_id: str) -> bool:
        session = self.get(session_id)
        if session is None:
            return False
        self.db.delete(session)
        self.db.commit()
        return True