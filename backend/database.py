"""SQLAlchemy models and DB session helpers for the Foreign Affairs Viz system."""

from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# ---------------------------------------------------------------------------
# Engine / session setup
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'foreign_affairs.db')}"
)

# check_same_thread=False so the APScheduler background thread can share the engine.
# timeout=30 makes a writer wait (up to 30s) for the lock instead of failing
# immediately with "database is locked" when the scheduler and a manual refresh
# try to write concurrently.
engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False, "timeout": 30}
        if DATABASE_URL.startswith("sqlite")
        else {}
    ),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(1024))
    description = Column(Text)
    url = Column(String(2048), unique=True, index=True)
    published_at = Column(DateTime, index=True)
    source = Column(String(256))
    raw_text = Column(Text)

    events = relationship("RelationshipEvent", back_populates="article")


class RelationshipEvent(Base):
    __tablename__ = "relationship_events"

    id = Column(Integer, primary_key=True, index=True)
    country_a = Column(String(128), index=True)
    country_b = Column(String(128), index=True)
    # TRADE / DIPLOMACY / CONFLICT / OTHER
    event_type = Column(String(32), index=True)
    sentiment_score = Column(Float)  # -1.0 .. 1.0
    summary = Column(Text)
    article_id = Column(Integer, ForeignKey("articles.id"))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    article = relationship("Article", back_populates="events")


class CountryRelationship(Base):
    __tablename__ = "country_relationships"

    id = Column(Integer, primary_key=True, index=True)
    country_a = Column(String(128), index=True)
    country_b = Column(String(128), index=True)
    current_score = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=datetime.utcnow)
    event_count = Column(Integer, default=0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Create all tables if they do not already exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency that yields a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def pair_key(a: str, b: str) -> tuple[str, str]:
    """Return a canonical (sorted) ordering for a country pair so that
    (India, China) and (China, India) map to the same relationship row."""
    return tuple(sorted([a, b]))  # type: ignore[return-value]
