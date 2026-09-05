from datetime import date, datetime, timedelta
from typing import Optional
import json
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timezone import today as ist_today
from app.models.transaction import TransactionType
from app.repositories.transaction_repository import TransactionRepository

SUPPORTED_CATEGORIES = [
    "Food", "Transport", "Bills", "Shopping", "Entertainment", "Health",
    "Education", "Rent", "Subscriptions", "Salary", "Investment", "Other",
]

# Anthropic SDK import is deferred so the app boots even when the SDK or API
# key is missing (AI features degrade gracefully, matching ReplyPilot's
# "credentials are DB/optional" approach).
_anthropic = None


def _client():
    global _anthropic
    if _anthropic is None:
        from anthropic import Anthropic
        _anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY or None)
    return _anthropic


def ai_configured() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def parse_transaction(text: str) -> Optional[dict]:
    """Ask Claude to turn a natural-language sentence into a structured
    transaction. Returns None when AI isn't configured or parsing fails."""
    if not ai_configured():
        return None
    try:
        client = _client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=300,
            system=(
                "You are a financial transaction parser. Extract transaction details "
                "from user input. Return ONLY a JSON object with fields: amount (positive "
                f"number), type ('credit' or 'debit'), category (one of: {', '.join(SUPPORTED_CATEGORIES)}), "
                "description (short), date (YYYY-MM-DD, use today if not specified)."
            ),
            messages=[{"role": "user", "content": text}],
        )
        content = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
        cleaned = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        if "amount" not in data:
            return None
        return {
            "amount": float(data["amount"]),
            "type": data.get("type", "debit"),
            "category": data.get("category", "Other"),
            "description": data.get("description", ""),
            "date": data.get("date", ist_today().isoformat()),
        }
    except Exception as exc:  # noqa: BLE001
        print(f"[AI] parse_transaction failed: {exc}")
        return None


def build_insights_payload(db: Session, year: int, month: int) -> dict:
    repo = TransactionRepository(db)
    summary = repo.monthly_summary(year, month)
    categories = repo.list(start_date=date(year, month, 1), end_date=date(year, month, 28))
    from app.repositories.subscription_repository import SubscriptionRepository
    subs = SubscriptionRepository(db).list(active_only=True)
    return {
        "month": f"{year:04d}-{month:02d}",
        "total_spent": summary["total_debit"],
        "total_received": summary["total_credit"],
        "by_category": [
            {"category": c["category"], "total": c["total"]}
            for c in summary["by_category"]
        ],
        "recent_debits": [
            {"category": t.category.name if t.category else "Other",
             "amount": t.amount, "date": t.date.isoformat()}
            for t in categories if t.type == TransactionType.DEBIT
        ][:30],
        "subscriptions": [
            {"name": s.name, "amount": s.amount, "billing_cycle": s.billing_cycle.value if hasattr(s.billing_cycle, "value") else str(s.billing_cycle)}
            for s in subs
        ],
    }


def generate_insights(db: Session, year: int, month: int) -> Optional[str]:
    if not ai_configured():
        return None
    try:
        payload = build_insights_payload(db, year, month)
        client = _client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=600,
            system=(
                "You are a personal finance advisor. Analyze the user's spending and give: "
                "1) a 2-3 sentence summary, 2) three actionable insights, 3) two suggestions "
                "for improvement. Use concise markdown with headers and bullet points."
            ),
            messages=[{"role": "user", "content": json.dumps(payload, indent=2)}],
        )
        return "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
    except Exception as exc:  # noqa: BLE001
        print(f"[AI] generate_insights failed: {exc}")
        return None
