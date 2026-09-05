from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Ensure the SQLite data directory exists before creating the engine.
import os
from pathlib import Path

if settings.DATABASE_URL.startswith("sqlite"):
    # sqlite:///./data/finance.db -> path part after sqlite:///
    db_path = settings.DATABASE_URL.replace("sqlite:///", "", 1)
    if db_path != ":memory:":
        parent = os.path.dirname(db_path)
        if parent:
            Path(parent).mkdir(parents=True, exist_ok=True)

# SQLite for a single-user local finance app. WAL mode + foreign keys enabled.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

# Give SQLite a generous busy timeout so concurrent writers wait instead of
# failing, and only tune the pool for file-backed databases (in-memory ones
# need the default SingletonThreadPool).
engine_kwargs = {"connect_args": connect_args, "future": True}
if settings.DATABASE_URL.startswith("sqlite") and ":memory:" not in settings.DATABASE_URL:
    connect_args["timeout"] = 30
    engine_kwargs.update(pool_size=10, max_overflow=20)

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
