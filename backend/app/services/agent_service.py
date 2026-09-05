"""Agent-based chat assistant for FinanceManager.

A single `/api/ai/agent-chat` endpoint drives the whole feature. Claude is given
a set of native tool definitions — each tool maps to a real CRUD operation on
one of the finance modules (transactions, subscriptions, companies, budgets,
time tracking, reminders). The model decides which tool to call based
on the user's natural-language request, the backend executes the actual
database operation, and Claude turns the result into a human-friendly reply.

This is the "separate agent for every task + AI detects the task and asks the
agent to complete it" architecture: every module gets its own set of tools.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from typing import Callable, Optional
from sqlalchemy.orm import Session

from app.core.timezone import today as ist_today

from app.core.config import settings
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.company_repository import CompanyRepository
from app.repositories.budget_repository import BudgetRepository
from app.repositories.time_entry_repository import TimeEntryRepository
from app.repositories.reminder_repository import ReminderRepository
from app.models.transaction import TransactionType
from app.models.subscription import BillingCycle
from app.models.reminder import ReminderType, ReminderStatus
from app.models.budget import Budget
from app.models.category import Category
from app.models.notification import NotificationType
from app.services.notification_service import notify


_anthropic = None


def _client():
    global _anthropic
    if _anthropic is None:
        from anthropic import Anthropic
        _anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY or None)
    return _anthropic


def ai_configured() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


# --------------------------------------------------------------------------- #
# Serializers — convert ORM objects into clean, JSON-friendly dicts for the
# tool results that get fed back to Claude.
# --------------------------------------------------------------------------- #

def _iso(value) -> str | None:
    return value.isoformat() if isinstance(value, (date, datetime)) else value


def _enum(value):
    return value.value if hasattr(value, "value") else value


def _tx_dict(t):
    return {
        "id": t.id,
        "amount": t.amount,
        "type": _enum(t.type),
        "category": t.category.name if t.category else None,
        "company_id": t.company_id,
        "description": t.description,
        "date": _iso(t.date),
        "is_ai_categorized": t.is_ai_categorized,
    }


def _sub_dict(s):
    return {
        "id": s.id,
        "name": s.name,
        "amount": s.amount,
        "billing_cycle": _enum(s.billing_cycle),
        "next_billing": _iso(s.next_billing),
        "category": s.category,
        "company_id": s.company_id,
        "active": s.active,
        "auto_renew": s.auto_renew,
        "reminder_days_before": s.reminder_days_before,
        "paid": s.paid,
    }


def _company_dict(c):
    return {
        "id": c.id,
        "name": c.name,
        "industry": c.industry,
        "contact_email": c.contact_email,
        "notes": c.notes,
        "active": c.active,
        "hourly_rate": c.hourly_rate,
        "fixed_price": c.fixed_price,
        "contract_type": c.contract_type,
        "contract_start": _iso(c.contract_start),
        "contract_end": _iso(c.contract_end),
        "payment_terms": c.payment_terms,
    }


def _budget_dict(b: Budget):
    return {
        "id": b.id,
        "category_id": b.category_id,
        "category": b.category.name if b.category else None,
        "amount": b.amount,
        "year": b.year,
        "month": b.month,
    }


def _time_dict(e):
    return {
        "id": e.id,
        "company_id": e.company_id,
        "description": e.description,
        "hours": e.hours,
        "hourly_rate": e.hourly_rate,
        "date": _iso(e.date),
    }


def _reminder_dict(r):
    return {
        "id": r.id,
        "title": r.title,
        "message": r.message,
        "trigger_date": _iso(r.trigger_date),
        "type": _enum(r.type),
        "related_id": r.related_id,
        "status": _enum(r.status),
    }


def _categories(db: Session) -> list[str]:
    return [c.name for c in db.query(Category).order_by(Category.name.asc()).all()]


def _companies(db: Session) -> list[dict]:
    return [_company_dict(c) for c in CompanyRepository(db).list()]


# --------------------------------------------------------------------------- #
# Tool dispatcher. `handler` receives (db, **args) and returns JSON-serializable
# data (a dict, list, or bool). Each tool also carries a JSON schema that is
# sent to Claude so it knows how to fill in the arguments.
# --------------------------------------------------------------------------- #

def _tool(name: str, description: str, props: dict, required: list[str] | None,
          handler: Callable) -> dict:
    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": props,
            **({"required": required} if required else {}),
        },
        "handler": handler,
    }


def build_tools(db: Session) -> list[dict]:
    cat_ref = f"Category must be one of: {', '.join(_categories(db))}." if _categories(db) else ""
    comp_ref = "Provide company_id as one of: " + ", ".join(
        f"{c['id']} ({c['name']})" for c in _companies(db)
    ) + "." if _companies(db) else ""

    return [
        # ----------------------------- Transactions ---------------------- #
        _tool(
            "create_transaction",
            "Create a money movement. credit = money in (income/salary), "
            "debit = money out (expense). " + cat_ref,
            {
                "amount": {"type": "number", "description": "Amount in INR"},
                "type": {"type": "string", "enum": ["credit", "debit"]},
                "category": {"type": "string", "description": "Spending category"},
                "description": {"type": "string"},
                "date": {"type": "string", "description": "ISO date YYYY-MM-DD. Defaults to today."},
                "company_id": {"type": "integer"},
            },
            ["amount", "type"],
            lambda db, **a: _tx_dict(TransactionRepository(db).create(
                amount=a["amount"], type_=TransactionType(a["type"]),
                category=a.get("category"), company_id=a.get("company_id"),
                description=a.get("description"),
                date_=_parse_date(a.get("date")), is_ai_categorized=True,
            )),
        ),
        _tool(
            "update_transaction",
            "Update fields of an existing transaction by id.",
            {"transaction_id": {"type": "integer"}, "amount": {"type": "number"},
             "type": {"type": "string", "enum": ["credit", "debit"]},
             "category": {"type": "string"}, "description": {"type": "string"},
             "date": {"type": "string", "description": "ISO date YYYY-MM-DD"}},
            ["transaction_id"],
            _update_tx,
        ),
        _tool(
            "delete_transaction", "Delete a transaction by id.",
            {"transaction_id": {"type": "integer"}}, ["transaction_id"],
            lambda db, **a: {"deleted": TransactionRepository(db).delete(a["transaction_id"])},
        ),
        _tool(
            "get_transaction", "Get a single transaction by id.",
            {"transaction_id": {"type": "integer"}}, ["transaction_id"],
            lambda db, **a: _tx_dict(TransactionRepository(db).get(a["transaction_id"])),
        ),
        _tool(
            "list_transactions",
            "List transactions, optionally filtered by type, category, date range (YYYY-MM-DD).",
            {"type": {"type": "string", "enum": ["credit", "debit"]},
             "category": {"type": "string"}, "start_date": {"type": "string"},
             "end_date": {"type": "string"}, "limit": {"type": "integer"}},
            None,
            lambda db, **a: [_tx_dict(t) for t in TransactionRepository(db).list(
                type_=TransactionType(a["type"]) if a.get("type") else None,
                category=a.get("category"),
                start_date=_parse_date(a.get("start_date")),
                end_date=_parse_date(a.get("end_date")),
                limit=a.get("limit", 50),
            )],
        ),
        _tool(
            "transaction_summary",
            "Get income/expense/balance summary for a given month. Defaults to current month.",
            {"year": {"type": "integer"}, "month": {"type": "integer"}}, None,
            lambda db, **a: TransactionRepository(db).monthly_summary(
                a.get("year", ist_today().year), a.get("month", ist_today().month)),
        ),

        # --------------------------- Subscriptions ---------------------- #
        _tool(
            "create_subscription",
            "Create a recurring subscription (Netflix, rent, etc.). " + cat_ref,
            {"name": {"type": "string"}, "amount": {"type": "number"},
             "billing_cycle": {"type": "string", "enum": ["daily", "weekly", "monthly", "yearly"]},
             "next_billing": {"type": "string", "description": "Next billing ISO date YYYY-MM-DD"},
             "category": {"type": "string"},
             "reminder_days_before": {"type": "integer"},
             "company_id": {"type": "integer"}},
            ["name", "amount", "billing_cycle", "next_billing"],
            lambda db, **a: _sub_dict(SubscriptionRepository(db).create(
                name=a["name"], amount=a["amount"], billing_cycle=BillingCycle(a["billing_cycle"]),
                next_billing=_parse_date(a["next_billing"]),
                category=a.get("category", "Subscriptions"),
                reminder_days_before=a.get("reminder_days_before", 3),
                company_id=a.get("company_id"))),
        ),
        _tool(
            "update_subscription", "Update an existing subscription by id.",
            {"subscription_id": {"type": "integer"}, "name": {"type": "string"},
             "amount": {"type": "number"},
             "billing_cycle": {"type": "string", "enum": ["daily", "weekly", "monthly", "yearly"]},
             "next_billing": {"type": "string"}, "category": {"type": "string"},
             "paid": {"type": "boolean"}, "active": {"type": "boolean"}},
            ["subscription_id"],
            _update_sub,
        ),
        _tool(
            "delete_subscription", "Delete a subscription by id.",
            {"subscription_id": {"type": "integer"}}, ["subscription_id"],
            lambda db, **a: {"deleted": SubscriptionRepository(db).delete(a["subscription_id"])},
        ),
        _tool(
            "get_subscription", "Get a single subscription by id.",
            {"subscription_id": {"type": "integer"}}, ["subscription_id"],
            lambda db, **a: _sub_dict(SubscriptionRepository(db).get(a["subscription_id"])),
        ),
        _tool(
            "list_subscriptions", "List subscriptions, optionally active only.",
            {"active": {"type": "boolean"}}, None,
            lambda db, **a: [_sub_dict(s) for s in SubscriptionRepository(db).list(active_only=bool(a.get("active", False)))],
        ),

        # ----------------------------- Companies ------------------------ #
        _tool(
            "create_company", "Create a company/client you work with. " + comp_ref,
            {"name": {"type": "string"}, "industry": {"type": "string"},
             "contact_email": {"type": "string"}, "notes": {"type": "string"},
             "hourly_rate": {"type": "number"}, "fixed_price": {"type": "number"},
             "contract_type": {"type": "string", "enum": ["hourly", "fixed", "retainer"]},
             "contract_start": {"type": "string"}, "contract_end": {"type": "string"},
             "payment_terms": {"type": "string"},
             "active": {"type": "boolean"}},
            ["name"],
            lambda db, **a: _company_dict(CompanyRepository(db).create(name=a["name"],
                industry=a.get("industry"), contact_email=a.get("contact_email"),
                notes=a.get("notes"), active=a.get("active", True),
                hourly_rate=a.get("hourly_rate"), fixed_price=a.get("fixed_price"),
                contract_type=a.get("contract_type"),
                contract_start=a.get("contract_start"), contract_end=a.get("contract_end"),
                payment_terms=a.get("payment_terms"))),
        ),
        _tool(
            "update_company", "Update an existing company by id.",
            {"company_id": {"type": "integer"}, "name": {"type": "string"},
             "industry": {"type": "string"}, "contact_email": {"type": "string"},
             "notes": {"type": "string"}, "hourly_rate": {"type": "number"},
             "fixed_price": {"type": "number"}, "active": {"type": "boolean"},
             "payment_terms": {"type": "string"}},
            ["company_id"],
            _update_company,
        ),
        _tool(
            "delete_company", "Delete a company by id.",
            {"company_id": {"type": "integer"}}, ["company_id"],
            lambda db, **a: {"deleted": CompanyRepository(db).delete(a["company_id"])},
        ),
        _tool(
            "get_company", "Get a single company by id.",
            {"company_id": {"type": "integer"}}, ["company_id"],
            lambda db, **a: _company_dict(CompanyRepository(db).get(a["company_id"])),
        ),
        _tool(
            "list_companies", "List companies, optionally active only.",
            {"active": {"type": "boolean"}}, None,
            lambda db, **a: [_company_dict(c) for c in CompanyRepository(db).list(active_only=bool(a.get("active", False)))],
        ),

        # ----------------------------- Budgets -------------------------- #
        _tool(
            "create_budget", "Create a monthly spending budget for a category. " + cat_ref,
            {"category": {"type": "string"}, "amount": {"type": "number"},
             "year": {"type": "integer"}, "month": {"type": "integer"}},
            ["category", "amount"],
            lambda db, **a: _budget_dict(_create_budget(db, a)),
        ),
        _tool(
            "update_budget", "Update a budget by id.",
            {"budget_id": {"type": "integer"}, "amount": {"type": "number"},
             "year": {"type": "integer"}, "month": {"type": "integer"}},
            ["budget_id"],
            _update_budget,
        ),
        _tool(
            "delete_budget", "Delete a budget by id.",
            {"budget_id": {"type": "integer"}}, ["budget_id"],
            lambda db, **a: {"deleted": BudgetRepository(db).delete(a["budget_id"])},
        ),
        _tool(
            "list_budgets", "List budgets for a given month (defaults to current month).",
            {"year": {"type": "integer"}, "month": {"type": "integer"}}, None,
            lambda db, **a: [_budget_dict(b) for b in BudgetRepository(db).list(
                a.get("year", ist_today().year), a.get("month", ist_today().month))],
        ),

        # --------------------------- Time tracking ---------------------- #
        _tool(
            "create_time_entry", "Log billable hours against a company. " + comp_ref,
            {"company_id": {"type": "integer"}, "description": {"type": "string"},
             "hours": {"type": "number"}, "hourly_rate": {"type": "number"},
             "date": {"type": "string", "description": "ISO date YYYY-MM-DD, defaults to today"}},
            ["hours"],
            lambda db, **a: _time_dict(TimeEntryRepository(db).create(
                company_id=a.get("company_id"), description=a.get("description"),
                hours=a["hours"], hourly_rate=a.get("hourly_rate"),
                date=_parse_date(a.get("date")))),
        ),
        _tool(
            "update_time_entry", "Update a time entry by id.",
            {"entry_id": {"type": "integer"}, "company_id": {"type": "integer"},
             "description": {"type": "string"}, "hours": {"type": "number"},
             "hourly_rate": {"type": "number"}, "date": {"type": "string"}},
            ["entry_id"],
            _update_time,
        ),
        _tool(
            "delete_time_entry", "Delete a time entry by id.",
            {"entry_id": {"type": "integer"}}, ["entry_id"],
            lambda db, **a: {"deleted": TimeEntryRepository(db).delete(a["entry_id"])},
        ),
        _tool(
            "list_time_entries", "List time entries, optionally filtered by company/date range.",
            {"company_id": {"type": "integer"}, "start_date": {"type": "string"},
             "end_date": {"type": "string"}}, None,
            lambda db, **a: [_time_dict(e) for e in TimeEntryRepository(db).list(
                company_id=a.get("company_id"),
                start_date=_parse_date(a.get("start_date")),
                end_date=_parse_date(a.get("end_date")))],
        ),

        # ---------------------------- Reminders ------------------------- #
        _tool(
            "list_reminders", "List reminders, optionally by status (pending/sent/dismissed).",
            {"status": {"type": "string", "enum": ["pending", "sent", "dismissed"]}}, None,
            lambda db, **a: [_reminder_dict(r) for r in ReminderRepository(db).list(
                status=ReminderStatus(a["status"]) if a.get("status") else None)],
        ),
        _tool(
            "create_reminder", "Create a custom reminder/notification for a date and optional time.",
            {"title": {"type": "string"}, "trigger_date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
             "trigger_time": {"type": "string", "description": "Optional time like '12:50 PM', '12:50pm', or '14:30'"},
             "message": {"type": "string"}}, ["title", "trigger_date"],
            lambda db, **a: _reminder_dict(ReminderRepository(db).create(
                title=a["title"], trigger_date=_parse_date(a["trigger_date"]),
                trigger_time=_parse_time(a.get("trigger_time")),
                message=a.get("message"))),
        ),
        _tool(
            "set_reminder_status", "Set a reminder's status (e.g. mark pending/dismissed).",
            {"reminder_id": {"type": "integer"},
             "status": {"type": "string", "enum": ["pending", "sent", "dismissed"]}},
            ["reminder_id", "status"],
            lambda db, **a: _reminder_dict(ReminderRepository(db).set_status(
                a["reminder_id"], ReminderStatus(a["status"]))),
        ),

        # ------------------------- General helpers ---------------------- #
        _tool(
            "list_categories", "List all available spending categories.", {}, None,
            lambda db, **a: _categories(db),
        ),
        _tool(
            "get_today", "Get today's date. Use this for 'today'/'this month' calculations.",
            {}, None,
            lambda db, **a: {"today": ist_today().isoformat()},
        ),
    ]


# -- Helper implementations --------------------------------------------------- #

def _parse_date(value):
    if value is None or isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return value


def _parse_time(value):
    """Parse a flexible time string into a `datetime.time` (or None).

    Accepts '12:50 PM', '12:50pm', '14:30', '9:05 AM', ISO '14:30:00', etc.
    """
    import re
    from datetime import time as dtime
    if value is None:
        return None
    if isinstance(value, dtime):
        return value
    s = str(value).strip().lower().replace(".", "")
    m = re.fullmatch(r"(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m)?", s)
    if not m:
        return None
    hour, minute, _, meridiem = m.groups()
    hour = int(hour)
    minute = int(minute or 0)
    if meridiem and meridiem.startswith("a"):
        if hour == 12:
            hour = 0
    elif meridiem and meridiem.startswith("p"):
        if hour != 12:
            hour += 12
    if hour > 23 or minute > 59:
        return None
    return dtime(hour, minute)


def _resolve_category_id(db: Session, name: str) -> int:
    cat = db.query(Category).filter(Category.name == name).first()
    if not cat:
        cat = Category(name=name)
        db.add(cat)
        db.commit()
        db.refresh(cat)
    return cat.id


def _create_budget(db, args):
    return BudgetRepository(db).create(
        category_id=_resolve_category_id(db, args["category"]),
        amount=args["amount"],
        year=args.get("year", ist_today().year),
        month=args.get("month", ist_today().month),
    )


def _update_budget(db, args):
    fields = {k: v for k, v in args.items() if k != "budget_id"}
    if "category" in fields:
        fields["category_id"] = _resolve_category_id(db, fields.pop("category"))
    b = BudgetRepository(db).update(args["budget_id"], fields)
    return _budget_dict(b) if b else {"error": "budget not found"}


def _update_tx(db, args):
    fields = {k: v for k, v in args.items() if k != "transaction_id"}
    if "type" in fields:
        fields["type"] = TransactionType(fields["type"])
    if "date" in fields:
        fields["date"] = _parse_date(fields["date"])
    t = TransactionRepository(db).update(args["transaction_id"], fields)
    return _tx_dict(t) if t else {"error": "transaction not found"}


def _update_sub(db, args):
    fields = {k: v for k, v in args.items() if k != "subscription_id"}
    if "billing_cycle" in fields:
        fields["billing_cycle"] = BillingCycle(fields["billing_cycle"])
    if "next_billing" in fields:
        fields["next_billing"] = _parse_date(fields["next_billing"])
    s = SubscriptionRepository(db).update(args["subscription_id"], fields)
    return _sub_dict(s) if s else {"error": "subscription not found"}


def _update_company(db, args):
    fields = {k: v for k, v in args.items() if k != "company_id"}
    c = CompanyRepository(db).update(args["company_id"], fields)
    return _company_dict(c) if c else {"error": "company not found"}


def _update_time(db, args):
    fields = {k: v for k, v in args.items() if k != "entry_id"}
    if "date" in fields:
        fields["date"] = _parse_date(fields["date"])
    e = TimeEntryRepository(db).update(args["entry_id"], fields)
    return _time_dict(e) if e else {"error": "time entry not found"}


# --------------------------------------------------------------------------- #
# Orchestration — the main loop.
# --------------------------------------------------------------------------- #

SYSTEM_PROMPT = """You are the AI assistant for FinanceManager, a personal finance tool for an Indian freelancer (currency: INR ₹).

You manage these modules by calling tools: transactions (credit/debit), subscriptions, companies/clients, budgets, time tracking, and reminders.

Guidelines:
- Detect the user's intent (create / update / delete / get / list / summarize) and pick the right tool. When in doubt about missing information, ask a brief clarifying question instead of guessing.
- Always confirm what you did and show the key result (amounts with ₹, dates) in a friendly, concise reply.
- For "how much did I spend/earn", use transaction_summary or list_transactions.
- Use get_today for relative dates ("this month", "today").
- Keep replies short and scannable; use markdown bullets when listing multiple items.
- Never invent data; only report what tools return. If a tool returns an error or not-found, say so.
"""


def _emit_agent_notification(db: Session, tool: str, args: dict, result) -> None:
    """Broadcast a live notification for AI-driven create/update/delete actions.
    Read-only tools and failures produce no notification."""
    if isinstance(result, dict) and result.get("error"):
        return

    def _link(module: str) -> str:
        return {"transactions": "/transactions", "subscriptions": "/subscriptions",
                "companies": "/companies", "budgets": "/budget",
                "time": "/time", "reminders": "/reminders"}.get(module, "/")

    mapping = [
        *[("create_transaction", "transactions"), ("update_transaction", "transactions"),
          ("delete_transaction", "transactions")],
        *[("create_subscription", "subscriptions"), ("update_subscription", "subscriptions"),
          ("delete_subscription", "subscriptions")],
        *[("create_company", "companies"), ("update_company", "companies"),
          ("delete_company", "companies")],
        *[("create_budget", "budgets"), ("update_budget", "budgets"),
          ("delete_budget", "budgets")],
        *[("create_time_entry", "time"), ("update_time_entry", "time"),
          ("delete_time_entry", "time")],
        *[("create_reminder", "reminders"), ("set_reminder_status", "reminders")],
    ]
    entry = next((m for m in mapping if m[0] == tool), None)
    if not entry:
        return
    _, module = entry
    verb = "created" if tool.startswith("create") else ("updated" if tool.startswith("update") else "completed/deleted")
    notify(
        db,
        title=f"AI assistant {verb.replace('_', ' ')} a {module.replace('time', 'time entry').replace('reminders', 'reminder')}",
        message=f"The AI assistant ran {tool.replace('_', ' ')} on the {module.replace('-', ' ')} module.",
        type_=NotificationType.AI,
        link=_link(module),
    )


def run_agent(db: Session, message: str, history: Optional[list[dict]] = None) -> dict:
    """Run the agent loop: Claude decides on tools -> backend executes -> Claude replies.

    `history` is the previous assistant/user turns (list of {"role", "content"}).
    Returns {"reply", "actions"} where actions is a list of {"tool", "args", "result"}
    recording every tool Claude invoked in this turn.
    """
    tools_with_handlers = build_tools(db)
    client = _client()

    api_tools = [
        {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
        for t in tools_with_handlers
    ]
    handlers = {t["name"]: t["handler"] for t in tools_with_handlers}

    messages: list[dict] = [m for m in (history or []) if m.get("role") in ("user", "assistant")]
    messages.append({"role": "user", "content": message})

    actions: list[dict] = []

    for _ in range(8):  # safety cap on tool-call chaining
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=api_tools,
            messages=messages,
        )

        tool_calls = []
        text_parts = []
        for block in response.content:
            if getattr(block, "type", "") == "tool_use":
                tool_calls.append(block)
            elif getattr(block, "type", "") == "text" and block.text:
                text_parts.append(block.text)

        # Record the assistant turn (including any tool_use blocks).
        assistant_content = []
        for b in response.content:
            if getattr(b, "type", "") == "text":
                assistant_content.append({"type": "text", "text": b.text})
            elif getattr(b, "type", "") == "tool_use":
                assistant_content.append({
                    "type": "tool_use",
                    "id": b.id, "name": b.name,
                    "input": b.input if isinstance(b.input, dict) else {},
                })
        messages.append({"role": "assistant", "content": assistant_content})

        if not tool_calls:
            return {
                "reply": "".join(text_parts).strip(),
                "actions": actions,
            }

        # Execute each requested tool and feed results back to Claude.
        for call in tool_calls:
            handler = handlers.get(call.name)
            try:
                result = handler(db, **call.input) if handler else {"error": "unknown tool"}
            except Exception as exc:  # noqa: BLE001
                result = {"error": str(exc)}
            actions.append({"tool": call.name, "args": call.input, "result": result})
            _emit_agent_notification(db, call.name, call.input, result)
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": json.dumps(result, default=str),
                }],
            })

    # Reached the loop cap without a final text reply.
    return {"reply": "I wasn't able to finish that in time. Could you rephrase?", "actions": actions}
