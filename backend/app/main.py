import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine
import app.models  # noqa: F401 — registers all ORM models

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def _run_schema_repairs() -> None:
    """Add columns that may be missing on tables created by an older schema."""
    from sqlalchemy import text

    def _column_exists(conn, table: str, column: str) -> bool:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(r[1] == column for r in rows)

    with engine.connect() as conn:
        for table, column, ddl in [
            ("transactions", "company_id", "ALTER TABLE transactions ADD COLUMN company_id INTEGER"),
            ("transactions", "project_id", "ALTER TABLE transactions ADD COLUMN project_id INTEGER"),
            ("subscriptions", "company_id", "ALTER TABLE subscriptions ADD COLUMN company_id INTEGER"),
            ("subscriptions", "paid", "ALTER TABLE subscriptions ADD COLUMN paid BOOLEAN DEFAULT 0"),
            ("companies", "hourly_rate", "ALTER TABLE companies ADD COLUMN hourly_rate REAL"),
            ("companies", "contract_start", "ALTER TABLE companies ADD COLUMN contract_start DATE"),
            ("companies", "contract_end", "ALTER TABLE companies ADD COLUMN contract_end DATE"),
            ("companies", "payment_terms", "ALTER TABLE companies ADD COLUMN payment_terms VARCHAR(80)"),
            ("companies", "fixed_price", "ALTER TABLE companies ADD COLUMN fixed_price REAL"),
            ("companies", "contract_type", "ALTER TABLE companies ADD COLUMN contract_type VARCHAR(20) DEFAULT 'hourly'"),
            ("reminders", "trigger_time", "ALTER TABLE reminders ADD COLUMN trigger_time VARCHAR(8)"),
            ("companies", "invoice_prefix", "ALTER TABLE companies ADD COLUMN invoice_prefix VARCHAR(10) DEFAULT 'INV'"),
            ("companies", "invoice_next_number", "ALTER TABLE companies ADD COLUMN invoice_next_number INTEGER DEFAULT 1"),
            ("companies", "invoice_digits", "ALTER TABLE companies ADD COLUMN invoice_digits INTEGER DEFAULT 4"),
            ("invoices", "sequence_number", "ALTER TABLE invoices ADD COLUMN sequence_number INTEGER"),
            ("invoices", "invoice_number", "ALTER TABLE invoices ADD COLUMN invoice_number VARCHAR(40)"),
            ("invoices", "place_of_supply", "ALTER TABLE invoices ADD COLUMN place_of_supply VARCHAR(50)"),
            ("invoices", "tax_type", "ALTER TABLE invoices ADD COLUMN tax_type VARCHAR(10) DEFAULT 'gst'"),
            ("invoice_line_items", "hsn_sac", "ALTER TABLE invoice_line_items ADD COLUMN hsn_sac VARCHAR(20)"),
            ("invoice_line_items", "tax_rate", "ALTER TABLE invoice_line_items ADD COLUMN tax_rate REAL DEFAULT 0.0"),
            ("invoice_line_items", "cgst_rate", "ALTER TABLE invoice_line_items ADD COLUMN cgst_rate REAL DEFAULT 0.0"),
            ("invoice_line_items", "sgst_rate", "ALTER TABLE invoice_line_items ADD COLUMN sgst_rate REAL DEFAULT 0.0"),
            ("invoice_line_items", "igst_rate", "ALTER TABLE invoice_line_items ADD COLUMN igst_rate REAL DEFAULT 0.0"),
            ("companies", "gstin", "ALTER TABLE companies ADD COLUMN gstin VARCHAR(15)"),
            ("companies", "billing_address", "ALTER TABLE companies ADD COLUMN billing_address TEXT"),
            ("companies", "city", "ALTER TABLE companies ADD COLUMN city VARCHAR(80)"),
            ("companies", "state", "ALTER TABLE companies ADD COLUMN state VARCHAR(50)"),
            ("companies", "state_code", "ALTER TABLE companies ADD COLUMN state_code VARCHAR(2)"),
            ("companies", "pincode", "ALTER TABLE companies ADD COLUMN pincode VARCHAR(10)"),
            ("invoice_payments", "id", "CREATE TABLE invoice_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL REFERENCES invoices(id), amount REAL NOT NULL, payment_date DATE NOT NULL, payment_method VARCHAR(40), reference VARCHAR(100), notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"),
            ("invoice_events", "id", "CREATE TABLE invoice_events (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL REFERENCES invoices(id), event_type VARCHAR(40) NOT NULL, old_value VARCHAR(100), new_value VARCHAR(100), description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"),
        ]:
            if _column_exists(conn, table, column):
                continue
            try:
                conn.execute(text(ddl))
                conn.commit()
                logger.info("Schema repair: added %s.%s", table, column)
            except Exception as exc:
                logger.warning("Schema repair skipped %s.%s: %s", table, column, exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import Base
    Base.metadata.create_all(bind=engine)

    logger.info("Starting — creating tables and seeding categories")
    _run_schema_repairs()

    from app.db.session import SessionLocal
    from app.models.category import Category
    db = SessionLocal()
    try:
        count = db.query(Category).count()
        if count == 0:
            defaults = [
                ("Food", "#ef4444", "🍔"), ("Transport", "#f59e0b", "🚗"),
                ("Bills", "#3b82f6", "🧾"), ("Shopping", "#ec4899", "🛍️"),
                ("Entertainment", "#8b5cf6", "🎬"), ("Health", "#10b981", "❤️"),
                ("Education", "#06b6d4", "📚"), ("Rent", "#6366f1", "🏠"),
                ("Subscriptions", "#f97316", "🔁"), ("Salary", "#22c55e", "💰"),
                ("Investment", "#14b8a6", "📈"), ("Other", "#6b7280", "📌"),
            ]
            for name, color, icon in defaults:
                db.add(Category(name=name, color=color, icon=icon))
            db.commit()
            logger.info("Seeded default categories")
    finally:
        db.close()

    from app.services.scheduler_service import start_scheduler
    start_scheduler()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down")


app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import (
    transactions, subscriptions, reminders, ai, dashboard, companies,
    time_entries, budgets, health, reports, notifications,
    projects, auth, invoices, recurring_invoices, business_profile,
)
from app.services.auth_service import require_auth

_PROTECTED = [Depends(require_auth)]

app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"], dependencies=_PROTECTED)
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"], dependencies=_PROTECTED)
app.include_router(reminders.router, prefix="/api/reminders", tags=["Reminders"], dependencies=_PROTECTED)
app.include_router(ai.router, prefix="/api/ai", tags=["AI"], dependencies=_PROTECTED)
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"], dependencies=_PROTECTED)
app.include_router(companies.router, prefix="/api/companies", tags=["Companies"], dependencies=_PROTECTED)
app.include_router(time_entries.router, prefix="/api/time-entries", tags=["Time Entries"], dependencies=_PROTECTED)
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"], dependencies=_PROTECTED)
app.include_router(health.router, prefix="/api/health", tags=["Health"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"], dependencies=_PROTECTED)
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"], dependencies=_PROTECTED)
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"], dependencies=_PROTECTED)
app.include_router(recurring_invoices.router, prefix="/api/recurring-invoices", tags=["Recurring Invoices"], dependencies=_PROTECTED)
app.include_router(business_profile.router, prefix="/api/business-profile", tags=["Business Profile"], dependencies=_PROTECTED)
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])


@app.get("/health")
def health():
    return {"status": "ok"}
