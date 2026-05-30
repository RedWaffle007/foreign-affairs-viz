# AI Foreign Affairs Visualization System

An AI-driven web app that tracks and visualizes international relations from
real-world news. Countries are nodes in a dynamic **relations graph**; edge
weights and colors shift with the sentiment and frequency of diplomatic, trade,
and conflict events extracted from news articles.

- **Backend:** FastAPI · SQLite (SQLAlchemy) · APScheduler · spaCy NER · VADER
  sentiment · local **Ollama (qwen3:14b)** for event classification + summarization.
- **Frontend:** React + Vite · `react-force-graph-2d`.

The system **degrades gracefully** — it runs end-to-end with no NewsAPI key
(bundled sample data, keyword country matching) and without Ollama (heuristic
classification), then gets richer as you add a NewsAPI key and run Ollama locally.

---

## Project structure

```
foreign-affairs-viz/
├── backend/
│   ├── main.py             # FastAPI app, CORS, scheduler, startup seed
│   ├── database.py         # SQLAlchemy models + session helpers
│   ├── news_fetcher.py     # NewsAPI fetch, spaCy NER, VADER, persistence
│   ├── ai_summarizer.py    # Claude classification/summarization (structured output)
│   ├── graph_builder.py    # Build {nodes, links} from the DB
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── utils.js
│   │   └── components/
│   │       ├── RelationsGraph.jsx
│   │       ├── HistorySlider.jsx
│   │       ├── CountryPanel.jsx
│   │       └── EventFeed.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
└── README.md
```

---

## Setup & run

### Backend

Prerequisite: a local [Ollama](https://ollama.com) running with the model pulled:

```bash
ollama pull qwen3:14b      # ollama serve usually runs automatically
```

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # recommended
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Configure NEWSAPI_KEY in backend/.env (loaded automatically via python-dotenv):
#   NEWSAPI_KEY=your_key      # empty -> bundled sample data

uvicorn main:app --reload --port 8000 \
  --reload-exclude '*.db' --reload-exclude '*.db-journal' --reload-exclude '*.db-wal'
```

On first startup the backend creates the SQLite DB and runs a **one-time
historical baseline** fetch in the background (when the DB has < 50 events) so
the graph isn't empty. A scheduled fetch then runs **daily at midnight**. The
`--reload-exclude` flags stop the SQLite file from triggering reload loops.

### Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_BASE=http://localhost:8000
npm install
npm run dev                 # http://localhost:5173
```

CORS on the backend already allows `http://localhost:5173`.

---

## API endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/api/graph?start=YYYY-MM&end=YYYY-MM` | Relations graph JSON (`nodes`, `links`) |
| `GET`  | `/api/countries` | All tracked countries |
| `GET`  | `/api/countries/{name}/history?months=12` | Monthly sentiment history |
| `GET`  | `/api/events?country=India&limit=20` | Recent events (optionally per country) |
| `POST` | `/api/refresh` | Manually trigger a news fetch |
| `GET`  | `/api/health` | Counts / liveness |

---

## How the AI pipeline works

1. **Fetch** — `news_fetcher.py` queries NewsAPI for `foreign affairs`,
   `diplomacy`, `trade agreement`, `sanctions`, `military cooperation`,
   `bilateral relations` (one page per query — 6 requests, well under the free
   tier's 100/day).
2. **Extract** — spaCy `en_core_web_sm` NER pulls `GPE` entities; results are
   normalized to canonical country names (with a keyword fallback).
3. **Score** — VADER computes a compound sentiment for `title + description`.
4. **Classify + summarize** — for any article mentioning 2+ countries,
   `ai_summarizer.py` calls the local **Ollama** model to return structured JSON
   (`event_type`, `country_a`, `country_b`, `summary`, `sentiment_score`). If
   Ollama is unreachable it falls back to a keyword heuristic + VADER sentiment.
5. **Persist** — events update a running per-pair sentiment score in
   `CountryRelationship`, which drives the graph edges.

### A note on the model

Classification runs entirely on a **local Ollama model (`qwen3:14b`)** via
`POST http://localhost:11434/api/generate` — no cloud API key required. Override
the endpoint or model with the `OLLAMA_URL` / `OLLAMA_MODEL` env vars.

---

## Frontend features

- **RelationsGraph** — force-directed graph. Node size ∝ event count, node color
  by region, edge thickness ∝ interaction frequency, edge color by sentiment
  (red → gray → green). Click a node to open the country panel; click an edge for
  the trade/diplomacy/conflict breakdown.
- **HistorySlider** — scrub from Jan 2020 to today; the graph re-fetches for the
  selected trailing window.
- **CountryPanel** — slides in from the right with the flag, top 5 partners, a
  Recharts sentiment trend, and the last 5 events.
- **EventFeed** — left sidebar live feed of the latest 20 events with color-coded
  type badges and sentiment indicators.

---

## Rate limits & cost

- **NewsAPI free tier:** 100 requests/day. The daily fetch issues ~10 queries
  (one per coalition), leaving headroom for manual refreshes.
- **Ollama:** one local model call per multi-country article — runs on your own
  hardware, no per-call cost. Reduce volume by lowering `PAGE_SIZE` in
  `news_fetcher.py` if needed.
