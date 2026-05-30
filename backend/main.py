"""FastAPI application: REST API + scheduled news ingestion."""

from __future__ import annotations

import threading
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

load_dotenv()  # read backend/.env before anything else touches the env

from database import (  # noqa: E402
    CountryRelationship,
    RelationshipEvent,
    get_db,
    init_db,
)
from graph_builder import build_graph  # noqa: E402
from news_fetcher import (  # noqa: E402
    DAILY_QUERIES,
    event_count,
    fetch_and_process,
    fetch_baseline,
)

scheduler = BackgroundScheduler()

# Run a one-time historical baseline when the DB has fewer than this many events.
BASELINE_THRESHOLD = 50


def _startup_seed() -> None:
    """One-time baseline fetch on first startup (DB < BASELINE_THRESHOLD events)."""
    try:
        if event_count() < BASELINE_THRESHOLD:
            fetch_baseline()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] baseline fetch failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Seed in a background thread so startup isn't blocked by network/LLM calls.
    threading.Thread(target=_startup_seed, daemon=True).start()

    # Daily ingestion at midnight.
    scheduler.add_job(
        fetch_and_process,
        "cron",
        hour=0,
        minute=0,
        id="daily_news_fetch",
        replace_existing=True,
    )
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="AI Foreign Affairs Visualization API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/graph")
def get_graph(db: Session = Depends(get_db)):
    """Return the full current relations graph (nodes, links, coalitions)."""
    graph = build_graph(db)
    graph["status"] = "ready" if graph["nodes"] else "empty"
    return graph


@app.get("/api/countries")
def get_countries(db: Session = Depends(get_db)):
    rows_a = db.query(RelationshipEvent.country_a).distinct().all()
    rows_b = db.query(RelationshipEvent.country_b).distinct().all()
    names = sorted({r[0] for r in rows_a} | {r[0] for r in rows_b}) if (rows_a or rows_b) else []
    names = [n for n in names if n]
    return {"countries": names, "count": len(names)}


@app.get("/api/countries/{name}/history")
def get_country_history(
    name: str,
    months: int = Query(default=12, ge=1, le=60),
    db: Session = Depends(get_db),
):
    cutoff = datetime.utcnow() - timedelta(days=30 * months)
    month_expr = func.strftime("%Y-%m", RelationshipEvent.created_at)
    rows = (
        db.query(
            month_expr.label("month"),
            func.avg(RelationshipEvent.sentiment_score).label("avg_sentiment"),
            func.count(RelationshipEvent.id).label("events"),
        )
        .filter(
            (RelationshipEvent.country_a == name) | (RelationshipEvent.country_b == name),
            RelationshipEvent.created_at >= cutoff,
        )
        .group_by("month")
        .order_by("month")
        .all()
    )
    history = [
        {"month": r.month, "score": round(r.avg_sentiment or 0.0, 3), "events": r.events}
        for r in rows
    ]
    return {"country": name, "history": history}


@app.get("/api/events")
def get_events(
    country: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(RelationshipEvent)
    if country:
        query = query.filter(
            (RelationshipEvent.country_a == country)
            | (RelationshipEvent.country_b == country)
        )
    rows = query.order_by(RelationshipEvent.created_at.desc()).limit(limit).all()
    events = [
        {
            "id": ev.id,
            "country_a": ev.country_a,
            "country_b": ev.country_b,
            "event_type": ev.event_type,
            "sentiment_score": round(ev.sentiment_score or 0.0, 3),
            "summary": ev.summary,
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
        }
        for ev in rows
    ]
    return {"events": events, "count": len(events)}


@app.post("/api/refresh")
def refresh():
    # No request-scoped session here: fetch_and_process opens, writes, commits,
    # and closes its own SessionLocal session. Holding an extra idle Depends
    # session open during the write is what triggered "database is locked".
    result = fetch_and_process(DAILY_QUERIES)
    return {"status": "ok", **result}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    events = db.query(func.count(RelationshipEvent.id)).scalar() or 0
    rels = db.query(func.count(CountryRelationship.id)).scalar() or 0
    return {"status": "ok", "events": events, "relationships": rels}
