# Foreign Affairs Viz — ASP.NET Core Read API (.NET 9)

A typed **ASP.NET Core 9 Minimal API** that serves the read-heavy graph / event /
country / health queries for the Foreign Affairs Visualization system, using
**Entity Framework Core** over the same database schema produced by the existing
Python ingestion pipeline.

This is a **polyglot architecture**:

- **Python (FastAPI)** stays the data producer — NewsAPI ingestion, spaCy NER,
  VADER sentiment, and Ollama classification remain where they already work well.
- **.NET (ASP.NET Core)** is the typed query/API layer consumed by the React
  client — strong typing, dependency injection, async EF Core access, and
  OpenAPI.

Both services share one database (SQLite for a local demo, PostgreSQL for a
containerised deployment), so no data is duplicated.

## Architecture

```
             writes                         reads
NewsAPI ─▶ Python FastAPI ─▶  shared DB  ◀─ ASP.NET Core API ─▶ React (Vite)
  spaCy / VADER / Ollama    (SQLite/PG)     EF Core, LINQ, OpenAPI
```

| Endpoint | Description |
| --- | --- |
| `GET /api/graph` | Nodes, links and coalition metadata for the relations graph |
| `GET /api/countries` | Distinct, sorted country names |
| `GET /api/countries/{name}/history?months=12` | Monthly sentiment history for a country |
| `GET /api/events?country=&limit=20` | Recent relationship events (optionally filtered) |
| `GET /api/health` | Liveness + row counts |
| `POST /api/refresh` | Proxied to the Python ingestion service (service-to-service) |

The JSON shapes are byte-compatible with the Python API, so the React frontend
works against either backend unchanged.

## Project layout

```
dotnet-api/
├── ForeignAffairs.sln
├── docker-compose.yml            # PostgreSQL + API
├── src/ForeignAffairs.Api/
│   ├── Program.cs                # Minimal API, DI, config, CORS, Swagger
│   ├── Data/                     # AppDbContext + entities (snake_case mapping)
│   ├── Models/                   # Typed request/response DTOs
│   ├── Services/                 # GraphBuilder, CoalitionRegistry
│   └── Dockerfile
└── tests/ForeignAffairs.Api.Tests/   # xUnit integration tests (WebApplicationFactory)
```

## Prerequisites

- [.NET SDK 9.0](https://dotnet.microsoft.com/download)
- (Optional) Docker + Docker Compose for the PostgreSQL path

## Running against the existing SQLite database

The default configuration points at the Python service's SQLite file
(`../../backend/foreign_affairs.db`). Start the Python backend once so the DB
exists and has data, then:

```bash
cd src/ForeignAffairs.Api
dotnet run
# API on http://localhost:5080, Swagger UI at http://localhost:5080/swagger
```

Point at any SQLite file explicitly via configuration:

```bash
ConnectionStrings__Default="Data Source=/path/to/foreign_affairs.db" dotnet run
```

## Running against PostgreSQL (Docker)

```bash
docker compose up --build
# API on http://localhost:5080
```

To let both services share PostgreSQL, run the Python service with
`DATABASE_URL=postgresql://foreign:foreign@localhost:5432/foreign_affairs` and
this service with `Database__Provider=Postgres` and the matching connection
string. EF Core `EnsureCreated`/migrations and SQLAlchemy target the identical
snake_case tables (`articles`, `relationship_events`, `country_relationships`).

## Configuration

All configuration is environment-based (never hard-coded secrets). Keys can be
supplied via `appsettings.json`, environment variables (using the `__`
separator), or user-secrets.

| Key | Default | Purpose |
| --- | --- | --- |
| `Database:Provider` | `Sqlite` | `Sqlite` or `Postgres` |
| `ConnectionStrings:Default` | SQLite file | DB connection string |
| `Cors:AllowedOrigins:N` | Vite dev URLs | Allowed browser origins |
| `PythonService:BaseUrl` | *(empty)* | Enables `POST /api/refresh` proxying |

## Wiring up the React frontend

Set the API base URL for the Vite dev server:

```bash
cd ../../frontend
echo "VITE_API_BASE=http://localhost:5080" > .env
npm install && npm run dev
```

`frontend/src/api.js` reads `VITE_API_BASE`, so no other frontend change is
needed to switch the UI onto the .NET backend.

## Tests

```bash
dotnet test
```

The suite boots the real application with `WebApplicationFactory<Program>`
against an isolated, seeded in-memory SQLite database and asserts on graph
aggregation, country/event queries, monthly history bucketing, the refresh
fallback, and the generated OpenAPI document.

## Notes / boundaries

- This service is intentionally **read-only** over the domain data; writes remain
  the responsibility of the Python ingestion worker.
- `POST /api/refresh` returns `503` until `PythonService:BaseUrl` is configured,
  then proxies to the Python `/api/refresh`.
