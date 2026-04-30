# Endpoint Monitor

Real-time endpoint monitoring with latency charts, uptime metrics, and multi-protocol checks.

**Stack:** Python · FastAPI · APScheduler · React · Vite · TailwindCSS · Recharts · Docker

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose v2
- An accessible external database (see supported engines below)

> The database is **always external** — the application never starts its own DBMS.

---

## Getting started

```bash
docker compose up --build
```

Open `http://localhost`. On the first run, the setup wizard will be displayed.

---

## Startup flow

```
docker compose up
       │
       ▼
/app/data/config.json exists?
       │
   no ──────► setup wizard (http://localhost)
       │             │
       │       fill in engine, host, port, user, password, database
       │             │
       │       Test Connection ──► visual feedback (✓ / ✗)
       │             │
       │       Save & Continue ──► tables created ──► Dashboard
       │
  yes ──────► connects to database, recreates missing tables,
              reloads all active endpoint jobs ──► Dashboard
```

The configuration is saved to `/app/data/config.json` inside a Docker volume — it survives `docker compose down`.

---

## Environment variables

| Variable          | Default | Description                                                   |
|-------------------|---------|---------------------------------------------------------------|
| `RETENTION_HOURS` | `72`    | How long check results are kept. Older rows are purged hourly.|

Set in `docker-compose.yml` or as a host env var before `docker compose up`.

---

## Supported engines (application database)

| Engine      | Min. version | Default port |
|-------------|-------------|-------------|
| PostgreSQL  | 13+         | 5432        |
| MySQL       | 8.0+        | 3306        |
| MariaDB     | 10.6+       | 3306        |
| SQL Server  | 2019+       | 1433        |

---

## Supported check types

| Type       | Method                              | Status logic                             |
|------------|-------------------------------------|------------------------------------------|
| `http`     | HEAD → GET fallback via httpx       | up / degraded (> threshold ms) / down    |
| `tcp`      | asyncio socket connect              | up / degraded (> threshold ms) / down    |
| `database` | SQLAlchemy connect + SELECT 1       | up / degraded (> threshold ms) / down    |
| `dns`      | socket.getaddrinfo in executor      | up / degraded (> threshold ms) / down    |

All checkers honour the per-endpoint `timeout_s` setting and are async-safe.

---

## Project structure

```
endpoint-monitor/
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI entry point + lifespan
│       ├── config.py            # config.json read/write
│       ├── database.py          # SQLAlchemy engine + session
│       ├── models.py            # Endpoint, CheckResult
│       ├── schemas.py           # Pydantic schemas
│       ├── scheduler.py         # APScheduler engine + retention purge
│       ├── checkers/
│       │   ├── http_checker.py  # HTTP/HTTPS via httpx
│       │   ├── tcp_checker.py   # TCP socket connect
│       │   ├── database_checker.py  # SQLAlchemy connect + SELECT 1
│       │   └── dns_checker.py   # socket.getaddrinfo
│       └── routers/
│           ├── setup.py         # wizard + /setup/info
│           ├── endpoints.py     # CRUD + metrics + chart + history
│           └── websocket.py     # WebSocket + ConnectionManager
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── App.jsx              # wizard ↔ dashboard routing
        ├── pages/
        │   ├── SetupWizard.jsx
        │   └── Dashboard.jsx    # live state, drawer, WS events
        ├── components/
        │   ├── EndpointCard.jsx    # status card with pulse + uptime
        │   ├── EndpointForm.jsx    # create/edit modal (all types)
        │   ├── EndpointList.jsx    # drag-and-drop grid
        │   ├── EndpointDetail.jsx  # slide-in drawer with chart + history
        │   ├── LatencyChart.jsx    # Recharts line chart with period selector
        │   ├── UptimeBadge.jsx     # uptime % for a given period
        │   └── CheckHistoryTable.jsx  # paginated history table
        ├── hooks/
        │   └── useWebSocket.js  # WS connection with auto-reconnect
        ├── services/
        │   └── api.js           # all REST calls
        └── utils/
            └── periods.js       # shared period list + filterPeriods()
```

---

## API

| Method | Route                              | Description                                           |
|--------|------------------------------------|-------------------------------------------------------|
| GET    | `/api/setup/status`                | Returns `{ configured: bool }`                        |
| POST   | `/api/setup/test-connection`       | Tests connection without saving                       |
| POST   | `/api/setup/save`                  | Saves config, creates tables, starts scheduler        |
| GET    | `/api/setup/info`                  | Returns `{ retention_hours }`                         |
| GET    | `/api/endpoints`                   | List all endpoints with latest check result           |
| GET    | `/api/endpoints/{id}`              | Get a single endpoint                                 |
| POST   | `/api/endpoints`                   | Create endpoint + run first check immediately         |
| PUT    | `/api/endpoints/{id}`              | Update endpoint + reschedule job                      |
| DELETE | `/api/endpoints/{id}`              | Delete endpoint + remove job                          |
| PATCH  | `/api/endpoints/{id}/toggle`       | Toggle is_active, pause/resume scheduler job          |
| GET    | `/api/endpoints/{id}/metrics`      | Uptime %, avg/p95/p99 latency for a period            |
| GET    | `/api/endpoints/{id}/chart`        | Time-bucketed latency series for the chart            |
| GET    | `/api/endpoints/{id}/history`      | Paginated raw check results                           |
| WS     | `/ws/monitor`                      | Push check results in real time                       |

### Period values

Used by `/metrics` and `/chart`: `1min` · `5min` · `10min` · `30min` · `1h` · `6h` · `24h` · `7d` · `30d`

Periods longer than `RETENTION_HOURS` are automatically hidden in the UI.

---

## Data model

```
endpoint                          check_result
──────────────────────────        ──────────────────────
id_endpoint          PK           id_check_result  PK
name                              id_endpoint      FK → endpoint
hostname                          checked_at
type                              status
is_active                         latency_ms
port                              status_code
protocol                          error_message
check_interval_s
timeout_s
degraded_ms
created_at
updated_at
```

Tables are created with `checkfirst=True` — idempotent, never recreates existing data.

---

## Real-time updates

The backend broadcasts a JSON event over WebSocket after every check:

```json
{
  "id_endpoint": 1,
  "checked_at": "2025-04-29T12:00:00Z",
  "status": "up",
  "latency_ms": 42,
  "status_code": 200,
  "error_message": null
}
```

The frontend `useWebSocket` hook reconnects automatically with exponential backoff (1 s → 2 s → 4 s … max 30 s).

Live events are used to:
- Update the status badge and latency on each card (with a brief pulse animation)
- Append the new point to the latency chart (sliding-window trimmed per period)
- Prepend the new row to the check history table

---

## Local development (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
RETENTION_HOURS=72 uvicorn app.main:app --reload
# available at http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# available at http://localhost:5173
# /api/* and /ws/* proxied to http://localhost:8000
```

> WebSocket (`/ws/monitor`) is proxied by Nginx in production (port 80).
> For local dev without Docker, add a WS proxy entry to `vite.config.js`.

---

## Roadmap

- [x] **Phase 1 — Foundation:** base structure, setup wizard, Docker Compose
- [x] **Phase 2 — MVP Core:** endpoint CRUD, HTTP/TCP checks, WebSocket live updates
- [x] **Phase 3 — Visualization:** latency chart (Recharts), endpoint detail drawer, uptime badges, pulse animation
- [x] **Phase 4 — Advanced types:** database checker (PG/MySQL/MariaDB/MSSQL), DNS checker, dynamic form
- [x] **Phase 5 — History & metrics:** metrics API, uptime %, p95/p99 latency, check history table, data retention purge
- [ ] Phase 6 — Alerts: email/webhook notifications on status change
- [ ] Phase 7 — Multi-user: JWT authentication, admin/editor/readonly roles
