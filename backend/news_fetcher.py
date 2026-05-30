"""News ingestion pipeline (coalition-focused).

Fetches articles from NewsAPI.org, extracts countries via spaCy NER, scores
sentiment with VADER, asks the local Ollama model to classify/summarize each
multi-country article, and persists everything to the database.

Degrades gracefully:
  * No NEWSAPI_KEY  -> bundled sample dataset.
  * No spaCy model  -> keyword country matcher.
  * Ollama down     -> heuristic classifier + VADER sentiment.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from itertools import combinations

import requests
from sqlalchemy.orm import Session

from ai_summarizer import classify_event
from database import (
    Article,
    CountryRelationship,
    RelationshipEvent,
    SessionLocal,
    pair_key,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY")
NEWSAPI_URL = "https://newsapi.org/v2/everything"

# Coalition-first daily queries (run once/day, pageSize=100 -> ~10 requests/day).
DAILY_QUERIES = [
    "NATO diplomacy relations",
    "BRICS summit cooperation",
    "ASEAN bilateral trade",
    "SCO cooperation security",
    "GCC Gulf diplomacy",
    "African Union summit",
    "Quad Indo-Pacific",
    "EU foreign policy",
    "Arab League relations",
    "bilateral sanctions conflict",
]

# One-time historical baseline (run once on first startup if DB < 50 events).
BASELINE_QUERIES = [
    "NATO BRICS tensions 2024",
    "SCO summit 2024",
    "ASEAN bilateral 2024",
    "GCC diplomacy 2024",
    "African Union conflict resolution 2024",
    "India US relations 2024",
    "China Russia cooperation 2024",
    "EU sanctions Russia 2024",
    "Quad security Indo-Pacific 2024",
    "Arab League normalization 2024",
]

PAGE_SIZE = 100

# Demonyms / aliases -> canonical country names.
COUNTRY_ALIASES = {
    "united states": "United States", "u.s.": "United States", "us": "United States",
    "usa": "United States", "america": "United States", "washington": "United States",
    "china": "China", "beijing": "China", "chinese": "China",
    "russia": "Russia", "moscow": "Russia", "russian": "Russia",
    "india": "India", "new delhi": "India", "indian": "India",
    "japan": "Japan", "tokyo": "Japan", "japanese": "Japan",
    "germany": "Germany", "berlin": "Germany", "german": "Germany",
    "france": "France", "paris": "France", "french": "France",
    "united kingdom": "United Kingdom", "uk": "United Kingdom",
    "britain": "United Kingdom", "london": "United Kingdom", "british": "United Kingdom",
    "ukraine": "Ukraine", "kyiv": "Ukraine", "ukrainian": "Ukraine",
    "israel": "Israel", "israeli": "Israel",
    "iran": "Iran", "tehran": "Iran", "iranian": "Iran",
    "south korea": "South Korea", "seoul": "South Korea",
    "north korea": "North Korea", "pyongyang": "North Korea",
    "saudi arabia": "Saudi Arabia", "riyadh": "Saudi Arabia",
    "turkey": "Turkey", "ankara": "Turkey", "turkish": "Turkey",
    "brazil": "Brazil", "brazilian": "Brazil",
    "canada": "Canada", "ottawa": "Canada", "canadian": "Canada",
    "australia": "Australia", "australian": "Australia",
    "pakistan": "Pakistan", "pakistani": "Pakistan",
    "taiwan": "Taiwan", "taipei": "Taiwan",
    "italy": "Italy", "rome": "Italy", "italian": "Italy",
    "spain": "Spain", "madrid": "Spain", "spanish": "Spain",
    "mexico": "Mexico", "mexican": "Mexico",
    "egypt": "Egypt", "cairo": "Egypt",
    "south africa": "South Africa",
    "indonesia": "Indonesia", "nigeria": "Nigeria",
    "qatar": "Qatar", "kuwait": "Kuwait", "bahrain": "Bahrain", "oman": "Oman",
    "united arab emirates": "United Arab Emirates", "uae": "United Arab Emirates",
    "kazakhstan": "Kazakhstan", "uzbekistan": "Uzbekistan", "belarus": "Belarus",
    "vietnam": "Vietnam", "thailand": "Thailand", "malaysia": "Malaysia",
    "philippines": "Philippines", "singapore": "Singapore", "myanmar": "Myanmar",
    "ethiopia": "Ethiopia", "kenya": "Kenya", "ghana": "Ghana",
    "algeria": "Algeria", "morocco": "Morocco", "argentina": "Argentina",
    "poland": "Poland", "netherlands": "Netherlands", "sweden": "Sweden",
    "finland": "Finland", "norway": "Norway", "greece": "Greece",
    "syria": "Syria", "iraq": "Iraq", "jordan": "Jordan", "lebanon": "Lebanon",
    "yemen": "Yemen", "libya": "Libya", "sudan": "Sudan", "tunisia": "Tunisia",
    "european union": "European Union", "eu": "European Union",
}

_nlp = None
_vader = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy

            _nlp = spacy.load("en_core_web_sm")
        except Exception as exc:  # noqa: BLE001
            print(f"[news_fetcher] spaCy unavailable ({exc}); using keyword fallback.")
            _nlp = False
    return _nlp or None


def _get_vader():
    global _vader
    if _vader is None:
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

            _vader = SentimentIntensityAnalyzer()
        except Exception as exc:  # noqa: BLE001
            print(f"[news_fetcher] VADER unavailable ({exc}); sentiment defaults to 0.")
            _vader = False
    return _vader or None


# ---------------------------------------------------------------------------
# Country extraction / sentiment
# ---------------------------------------------------------------------------

def extract_countries(text: str) -> list[str]:
    found: list[str] = []
    nlp = _get_nlp()
    if nlp is not None:
        for ent in nlp(text).ents:
            if ent.label_ == "GPE":
                canon = COUNTRY_ALIASES.get(ent.text.strip().lower())
                if canon and canon not in found:
                    found.append(canon)

    lowered = f" {text.lower()} "
    for alias, canon in COUNTRY_ALIASES.items():
        if f" {alias} " in lowered or f" {alias}," in lowered or f" {alias}." in lowered:
            if canon not in found:
                found.append(canon)
    return found


def score_sentiment(text: str) -> float:
    vader = _get_vader()
    if vader is None or not text:
        return 0.0
    return float(vader.polarity_scores(text)["compound"])


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------

def _fetch_from_newsapi(queries: list[str], page_size: int) -> list[dict]:
    articles: list[dict] = []
    seen_urls: set[str] = set()
    for query in queries:
        try:
            resp = requests.get(
                NEWSAPI_URL,
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": page_size,
                    "apiKey": NEWSAPI_KEY,
                },
                timeout=20,
            )
            resp.raise_for_status()
            for raw in resp.json().get("articles", []):
                url = raw.get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                articles.append(raw)
        except Exception as exc:  # noqa: BLE001
            print(f"[news_fetcher] NewsAPI query '{query}' failed: {exc}")
    return articles


def _normalize(raw: dict) -> dict:
    published = raw.get("publishedAt")
    try:
        published_dt = (
            datetime.fromisoformat(published.replace("Z", "+00:00"))
            if published
            else datetime.now(timezone.utc)
        )
    except Exception:  # noqa: BLE001
        published_dt = datetime.now(timezone.utc)
    return {
        "title": raw.get("title") or "",
        "description": raw.get("description") or "",
        "url": raw.get("url") or "",
        "published_at": published_dt.replace(tzinfo=None),
        "source": (raw.get("source") or {}).get("name") or "unknown",
        "raw_text": raw.get("content") or raw.get("description") or "",
    }


# ---------------------------------------------------------------------------
# Heuristic classifier (used when Ollama is unavailable)
# ---------------------------------------------------------------------------

_CONFLICT_WORDS = ("war", "attack", "sanction", "military", "conflict", "missile", "troops", "clash")
_TRADE_WORDS = ("trade", "tariff", "export", "import", "deal", "economic", "investment")
_DIPLOMACY_WORDS = ("diplomat", "summit", "talks", "treaty", "ambassador", "meeting", "agreement", "visit")


def _heuristic_classify(text: str) -> str:
    lowered = text.lower()
    scores = {
        "CONFLICT": sum(w in lowered for w in _CONFLICT_WORDS),
        "TRADE": sum(w in lowered for w in _TRADE_WORDS),
        "DIPLOMACY": sum(w in lowered for w in _DIPLOMACY_WORDS),
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "OTHER"


# ---------------------------------------------------------------------------
# Relationship score maintenance
# ---------------------------------------------------------------------------

def _update_relationship(db: Session, a: str, b: str, sentiment: float) -> None:
    ca, cb = pair_key(a, b)
    rel = (
        db.query(CountryRelationship)
        .filter(CountryRelationship.country_a == ca, CountryRelationship.country_b == cb)
        .first()
    )
    if rel is None:
        rel = CountryRelationship(
            country_a=ca, country_b=cb, current_score=sentiment, event_count=1,
            last_updated=datetime.utcnow(),
        )
        db.add(rel)
    else:
        total = rel.current_score * rel.event_count + sentiment
        rel.event_count += 1
        rel.current_score = total / rel.event_count
        rel.last_updated = datetime.utcnow()


# ---------------------------------------------------------------------------
# Core ingestion
# ---------------------------------------------------------------------------

def fetch_and_process(queries: list[str] | None = None, page_size: int = PAGE_SIZE) -> dict:
    """Run one ingestion pass over ``queries`` (defaults to DAILY_QUERIES)."""
    queries = queries or DAILY_QUERIES

    if NEWSAPI_KEY:
        raw_articles = _fetch_from_newsapi(queries, page_size)
    else:
        print("[news_fetcher] No NEWSAPI_KEY set; seeding with sample data.")
        raw_articles = _sample_articles()

    db = SessionLocal()
    stored_articles = 0
    stored_events = 0
    try:
        for raw in raw_articles:
            art = _normalize(raw)
            if not art["url"]:
                continue
            if db.query(Article).filter(Article.url == art["url"]).first():
                continue

            article = Article(**art)
            db.add(article)
            db.flush()
            stored_articles += 1

            text = f"{art['title']}. {art['description']}"
            countries = extract_countries(text)
            if len(countries) < 2:
                continue

            base_sentiment = score_sentiment(text)

            try:
                data = classify_event(art["title"], art["description"])
                ca, cb = data["country_a"], data["country_b"]
                # Fall back to NER countries if the model returned junk.
                if not ca or not cb or ca == cb:
                    ca, cb = countries[0], countries[1]
                event_type = data["event_type"]
                summary = data["summary"] or art["description"][:200]
                sentiment = data["sentiment_score"]
                pairs = [(ca, cb)]
            except Exception as exc:  # noqa: BLE001 - any Ollama/parse failure
                print(f"[news_fetcher] classify_event failed, using heuristic: {exc}")
                event_type = _heuristic_classify(text)
                summary = art["description"][:200] or art["title"]
                sentiment = base_sentiment
                pairs = list(combinations(countries[:3], 2))

            for ca, cb in pairs:
                if not ca or not cb or ca == cb:
                    continue
                db.add(
                    RelationshipEvent(
                        country_a=ca,
                        country_b=cb,
                        event_type=event_type,
                        sentiment_score=sentiment,
                        summary=summary,
                        article_id=article.id,
                        created_at=art["published_at"],
                    )
                )
                _update_relationship(db, ca, cb, sentiment)
                stored_events += 1

        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"[news_fetcher] processing error: {exc}")
        raise
    finally:
        db.close()

    result = {
        "articles_stored": stored_articles,
        "events_stored": stored_events,
        "fetched_at": datetime.utcnow().isoformat(),
    }
    print(f"[news_fetcher] {result}")
    return result


def fetch_baseline() -> dict:
    """One-time historical baseline. Runs the BASELINE_QUERIES at pageSize=100."""
    print("[news_fetcher] Running one-time historical baseline fetch.")
    return fetch_and_process(BASELINE_QUERIES, page_size=PAGE_SIZE)


def event_count() -> int:
    db = SessionLocal()
    try:
        return db.query(RelationshipEvent.id).count()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Bundled sample data (keyless dev)
# ---------------------------------------------------------------------------

def _sample_articles() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    samples = [
        ("US and China resume trade talks amid tariff disputes",
         "The United States and China agreed to restart bilateral trade negotiations, "
         "seeking to ease tariffs that have strained economic ties."),
        ("India and Russia sign military cooperation agreement",
         "India and Russia signed a defense agreement deepening military cooperation "
         "and joint weapons production."),
        ("Ukraine condemns Russia over renewed missile strikes",
         "Ukraine accused Russia of escalating the conflict after a series of missile "
         "attacks on its cities."),
        ("Germany and France push for stronger EU defense ties",
         "Germany and France announced a joint initiative to strengthen European Union "
         "defense and diplomatic coordination."),
        ("Japan and South Korea expand trade and security partnership",
         "Japan and South Korea agreed to expand trade and bilateral security cooperation "
         "in a landmark summit."),
        ("Iran and Saudi Arabia restore diplomatic relations",
         "Iran and Saudi Arabia agreed to restore full diplomatic relations after years "
         "of tension, mediated by China."),
        ("US imposes new sanctions on Iran over nuclear program",
         "The United States announced fresh sanctions targeting Iran amid concerns over "
         "its expanding nuclear program."),
        ("Brazil and China deepen agricultural trade ties",
         "Brazil and China signed agreements expanding agricultural exports and economic "
         "investment between the two nations."),
        ("United Kingdom and India finalize free trade deal",
         "The United Kingdom and India finalized a long-awaited free trade agreement "
         "expected to boost bilateral commerce."),
        ("North Korea tests missiles as tensions with Japan rise",
         "North Korea launched several missiles, raising tensions with Japan and prompting "
         "diplomatic protests."),
        ("Saudi Arabia and UAE coordinate Gulf energy policy",
         "Saudi Arabia and the United Arab Emirates agreed to coordinate Gulf energy and "
         "economic policy within the GCC framework."),
        ("Australia and Japan strengthen Indo-Pacific security pact",
         "Australia and Japan signed a security agreement strengthening Quad-aligned "
         "cooperation across the Indo-Pacific."),
        ("Nigeria and South Africa lead African Union trade push",
         "Nigeria and South Africa announced a joint African Union initiative to expand "
         "continental free trade."),
        ("Poland and Germany reaffirm NATO commitments",
         "Poland and Germany reaffirmed their NATO commitments and pledged closer defense "
         "coordination on the eastern flank."),
        ("Egypt and Saudi Arabia deepen Arab League cooperation",
         "Egypt and Saudi Arabia agreed to deepen economic and diplomatic cooperation "
         "within the Arab League."),
    ]
    return [
        {
            "title": title,
            "description": desc,
            "url": f"https://example.com/sample/{i}",
            "publishedAt": now,
            "source": {"name": "Sample Wire"},
            "content": desc,
        }
        for i, (title, desc) in enumerate(samples)
    ]
