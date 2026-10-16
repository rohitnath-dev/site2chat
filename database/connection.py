import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


_engine = None
_SessionLocal = None


def get_engine():
    """Return the configured SQLAlchemy engine, initializing it lazily if needed."""
    global _engine
    if _engine is None:
        db_url = os.getenv("DATABASE_URL") or DATABASE_URL
        if not db_url:
            raise RuntimeError(
                "DATABASE_URL is missing. Configure it in your .env file."
            )
        # Handle SQLite vs PostgreSQL pool arguments
        if db_url.startswith("sqlite"):
            _engine = create_engine(db_url)
        else:
            _engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=5,
                pool_timeout=30,
                pool_recycle=300,
            )
    return _engine


def get_sessionmaker():
    """Return the configured sessionmaker."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            expire_on_commit=False,
        )
    return _SessionLocal


class _SessionLocalProxy:
    """Proxy object so SessionLocal() continues to work as expected."""
    def __call__(self, *args, **kwargs):
        return get_sessionmaker()(*args, **kwargs)


SessionLocal = _SessionLocalProxy()


def get_db() -> Generator[Session, None, None]:
    """Provide a database session and always close it."""
    db = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()

