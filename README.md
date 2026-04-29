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
       │             ▼
       │       fill in engine, host, port,
       │       user, password, database
       │             │
       │       Test Connection ──► visual feedback (✓ / ✗)
       │             │
       │       Save & Continue ──► tables created ──► Dashboard
       │
  yes ──────► connects to database, creates tables if needed ──► Dashboard
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
│       ├── main.py          # FastAPI entry point + lifespan
│       ├── config.py        # config.json read/write
│       ├── database.py      # SQLAlchemy engine + session
│       ├── models.py        # User, Endpoint, CheckResult
│       └── routers/
│           └── setup.py     # wizard endpoints
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx          # wizard ↔ dashboard routing
        ├── pages/
        │   ├── SetupWizard.jsx
        │   └── Dashboard.jsx
        └── services/
            └── api.js
```

---

## API

| Method | Route                         | Description                                      |
|--------|-------------------------------|--------------------------------------------------|
| GET    | `/api/setup/status`           | Returns `{ configured: bool }`                   |
| POST   | `/api/setup/test-connection`  | Tests the connection without saving              |
| POST   | `/api/setup/save`             | Saves config, creates tables and confirms ready  |

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
# /api/* is proxied to http://localhost:8000
```

---

## Roadmap

- [x] **Phase 1 — Foundation:** base structure, setup wizard, Docker
- [ ] Phase 2 — Monitoring: check engine, scheduling
- [ ] Phase 3 — Dashboard: real-time metrics, history
- [ ] Phase 4 — Alerts: email/webhook notifications
- [ ] Phase 5 — Multi-user: JWT authentication
- [ ] Phase 6 — User management: CRUD with admin/editor/readonly roles
