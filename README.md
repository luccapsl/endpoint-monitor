# Endpoint Monitor

Real-time endpoint monitoring application.

**Stack:** Python · FastAPI · React · Vite · TailwindCSS · Docker

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

## Supported engines

| Engine      | Min. version | Default port |
|-------------|-------------|-------------|
| PostgreSQL  | 13+         | 5432        |
| MySQL       | 8.0+        | 3306        |
| MariaDB     | 10.6+       | 3306        |
| SQL Server  | 2019+       | 1433        |

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
│       ├── models.py            # User, Endpoint, CheckResult
│       ├── schemas.py           # Pydantic schemas
│       ├── scheduler.py         # APScheduler check engine
│       ├── checkers/
│       │   ├── http_checker.py  # HTTP/HTTPS checks via httpx
│       │   └── tcp_checker.py   # TCP socket checks
│       └── routers/
│           ├── setup.py         # wizard endpoints
│           ├── endpoints.py     # endpoint CRUD
│           └── websocket.py     # WebSocket handler + ConnectionManager
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── App.jsx              # wizard ↔ dashboard routing
        ├── pages/
        │   ├── SetupWizard.jsx
        │   └── Dashboard.jsx    # summary cards + endpoint list
        ├── components/
        │   ├── EndpointCard.jsx # status card with live updates
        │   ├── EndpointForm.jsx # create/edit modal
        │   └── EndpointList.jsx # grid container
        ├── hooks/
        │   └── useWebSocket.js  # WS connection with auto-reconnect
        └── services/
            └── api.js           # all REST calls
```

---

## API

| Method | Route                              | Description                                      |
|--------|------------------------------------|--------------------------------------------------|
| GET    | `/api/setup/status`                | Returns `{ configured: bool }`                   |
| POST   | `/api/setup/test-connection`       | Tests the connection without saving              |
| POST   | `/api/setup/save`                  | Saves config, creates tables, starts scheduler   |
| GET    | `/api/endpoints`                   | List all endpoints with latest check result      |
| GET    | `/api/endpoints/{id}`              | Get a single endpoint                            |
| POST   | `/api/endpoints`                   | Create endpoint + run first check immediately    |
| PUT    | `/api/endpoints/{id}`              | Update endpoint + reschedule job                 |
| DELETE | `/api/endpoints/{id}`              | Delete endpoint + remove job                     |
| PATCH  | `/api/endpoints/{id}/toggle`       | Toggle is_active, pause/resume scheduler job     |
| WS     | `/ws/monitor`                      | Push check results in real time                  |

---

## Data model

```
user               endpoint              check_result
────────────       ──────────────        ──────────────────
id_user       PK   id_endpoint      PK   id_check_result  PK
name               name                  id_endpoint      FK → endpoint
password           hostname              checked_at
role               type                  status
is_active          is_active             latency_ms
                   port                  status_code
                   protocol              error_message
                   check_interval_s
                   timeout_s
                   degraded_ms
                   created_at
                   updated_at
```

Tables are created with `checkfirst=True` — idempotent, never recreates existing data.

---

## Supported check types

| Type  | Method                         | Status logic                                       |
|-------|--------------------------------|----------------------------------------------------|
| http  | HEAD → GET fallback via httpx  | up / degraded (if > threshold ms) / down           |
| tcp   | asyncio socket connect         | up / degraded (if > threshold ms) / down           |

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

---

## Local development (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# available at http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# available at http://localhost:5173
# /api/* proxied to http://localhost:8000
```

> WebSocket (`/ws/monitor`) is proxied by Nginx in production (port 80).
> For local dev without Docker, update `vite.config.js` to add a WS proxy.

---

## Roadmap

- [x] **Phase 1 — Foundation:** base structure, setup wizard, Docker
- [x] **Phase 2 — MVP Core:** endpoint CRUD, HTTP/TCP checks, WebSocket live updates
- [ ] Phase 3 — Dashboard: charts, uptime history, SLA metrics
- [ ] Phase 4 — Alerts: email/webhook notifications
- [ ] Phase 5 — Multi-user: JWT authentication
- [ ] Phase 6 — User management: CRUD with admin/editor/readonly roles
