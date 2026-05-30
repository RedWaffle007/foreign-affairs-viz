"""Build the relations graph (nodes + links + coalitions) from stored events."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from database import RelationshipEvent, pair_key

# ---------------------------------------------------------------------------
# Static coalition membership
# ---------------------------------------------------------------------------

COALITIONS = {
    "NATO": {
        "color": "#3b82f6",
        "description": "North Atlantic Treaty Organization — a military alliance of 32 North American and European nations committed to collective defense.",
        "members": ["United States", "United Kingdom", "Germany", "France", "Canada", "Italy", "Spain", "Poland", "Turkey", "Netherlands", "Belgium", "Norway", "Denmark", "Portugal", "Greece", "Czech Republic", "Romania", "Hungary", "Bulgaria", "Slovakia", "Slovenia", "Croatia", "Albania", "Montenegro", "North Macedonia", "Estonia", "Latvia", "Lithuania", "Luxembourg", "Iceland", "Finland", "Sweden"],
    },
    "BRICS": {
        "color": "#f97316",
        "description": "An intergovernmental organization of major emerging economies including Brazil, Russia, India, China, South Africa and new members.",
        "members": ["Brazil", "Russia", "India", "China", "South Africa", "Iran", "Egypt", "Ethiopia", "United Arab Emirates", "Saudi Arabia", "Argentina"],
    },
    "SCO": {
        "color": "#a855f7",
        "description": "Shanghai Cooperation Organisation — a Eurasian political, economic, and security organization.",
        "members": ["China", "Russia", "India", "Pakistan", "Kazakhstan", "Uzbekistan", "Kyrgyzstan", "Tajikistan", "Iran", "Belarus"],
    },
    "GCC": {
        "color": "#eab308",
        "description": "Gulf Cooperation Council — a regional intergovernmental political and economic union of Arab Gulf states.",
        "members": ["Saudi Arabia", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Oman"],
    },
    "ASEAN": {
        "color": "#22c55e",
        "description": "Association of Southeast Asian Nations — promoting economic growth, social progress and regional stability.",
        "members": ["Indonesia", "Malaysia", "Philippines", "Singapore", "Thailand", "Vietnam", "Myanmar", "Cambodia", "Laos", "Brunei"],
    },
    "African Union": {
        "color": "#f59e0b",
        "description": "A continental body of 55 African member states focused on promoting unity, peace and development across Africa.",
        "members": ["Nigeria", "South Africa", "Ethiopia", "Egypt", "Kenya", "Ghana", "Tanzania", "Algeria", "Morocco", "Senegal"],
    },
    "Quad": {
        "color": "#06b6d4",
        "description": "Quadrilateral Security Dialogue — an informal strategic forum between the United States, India, Japan and Australia.",
        "members": ["United States", "India", "Japan", "Australia"],
    },
    "EU": {
        "color": "#6366f1",
        "description": "European Union — a political and economic union of 27 European countries with a single market and shared policies.",
        "members": ["Germany", "France", "Italy", "Spain", "Poland", "Netherlands", "Belgium", "Sweden", "Austria", "Denmark", "Finland", "Ireland", "Portugal", "Czech Republic", "Romania", "Hungary", "Bulgaria", "Slovakia", "Slovenia", "Croatia", "Estonia", "Latvia", "Lithuania", "Luxembourg", "Malta", "Cyprus", "Greece"],
    },
    "Arab League": {
        "color": "#84cc16",
        "description": "A regional organization of Arab states in and around North Africa, the Horn of Africa and Arabia.",
        "members": ["Saudi Arabia", "Egypt", "Iraq", "Jordan", "Lebanon", "Syria", "Yemen", "Libya", "Tunisia", "Algeria", "Morocco", "Sudan", "Kuwait", "United Arab Emirates", "Qatar", "Bahrain", "Oman"],
    },
}

# Reverse index: country -> [coalition names], in COALITIONS insertion order.
_COUNTRY_COALITIONS: dict[str, list[str]] = {}
for _name, _info in COALITIONS.items():
    for _member in _info["members"]:
        _COUNTRY_COALITIONS.setdefault(_member, []).append(_name)


def coalitions_for(country: str) -> list[str]:
    return _COUNTRY_COALITIONS.get(country, [])


def build_graph(db: Session) -> dict:
    """Return ``{nodes, links, coalitions}`` for the current state of the DB."""
    events = db.query(RelationshipEvent).all()

    node_event_count: dict[str, int] = defaultdict(int)
    node_sentiment_sum: dict[str, float] = defaultdict(float)

    link_weight: dict[tuple[str, str], int] = defaultdict(int)
    link_sentiment_sum: dict[tuple[str, str], float] = defaultdict(float)
    link_breakdown: dict[tuple[str, str], dict[str, int]] = defaultdict(
        lambda: {"TRADE": 0, "DIPLOMACY": 0, "CONFLICT": 0, "OTHER": 0}
    )

    for ev in events:
        if not ev.country_a or not ev.country_b:
            continue
        key = pair_key(ev.country_a, ev.country_b)
        sentiment = ev.sentiment_score or 0.0

        link_weight[key] += 1
        link_sentiment_sum[key] += sentiment
        etype = ev.event_type if ev.event_type in link_breakdown[key] else "OTHER"
        link_breakdown[key][etype] += 1

        for country in key:
            node_event_count[country] += 1
            node_sentiment_sum[country] += sentiment

    nodes = []
    for country, count in node_event_count.items():
        member_of = coalitions_for(country)
        primary = member_of[0] if member_of else None
        nodes.append(
            {
                "id": country,
                "country": country,  # alias for the canvas renderer
                "event_count": count,
                "avg_sentiment": round(node_sentiment_sum[country] / count, 3) if count else 0.0,
                "coalitions": member_of,
                "primary_coalition": primary,
                "primary_color": COALITIONS[primary]["color"] if primary else "#94a3b8",
            }
        )

    links = []
    for (a, b), weight in link_weight.items():
        avg = round(link_sentiment_sum[(a, b)] / weight, 3) if weight else 0.0
        links.append(
            {
                "source": a,
                "target": b,
                "weight": weight,
                "event_count": weight,  # alias used by NetworkView link width
                "sentiment": avg,
                "sentiment_score": avg,  # alias used by the frontend
                "event_breakdown": link_breakdown[(a, b)],
            }
        )

    return {"nodes": nodes, "links": links, "coalitions": COALITIONS}
