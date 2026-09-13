# LiftIQ

**AI-Powered Personal Fitness Coach**

Real-time exercise tracking, rep counting, posture analysis, and AI-generated coaching — powered by MediaPipe, FastAPI, and Groq.

---

## Local Development with Docker

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- No local Python or Node installation required — everything runs in containers

### 1. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
GROQ_API_KEY=<your Groq API key from https://console.groq.com>
```

The other defaults in `.env.example` work out of the box for local development.

### 2. Start the stack

```bash
docker compose up --build
```

This builds and starts three services: `postgres`, `backend`, `frontend`.

> On first run the images build from scratch — this takes a few minutes.
> Subsequent starts are much faster (layer-cached).

### 3. Run database migrations

In a second terminal (while the stack is running):

```bash
docker compose run --rm backend alembic upgrade head
```

This applies Alembic migrations to the PostgreSQL container. Only needed on first start or after schema changes.

### 4. Open the application

| Service    | URL                       |
|------------|---------------------------|
| Frontend   | http://localhost:3001     |
| Backend    | http://localhost:8000     |
| API docs   | http://localhost:8000/docs |
| PostgreSQL | localhost:**5433** (host port; use pgAdmin or psql to inspect) |

> **Port note:** LiftIQ frontend exclusively uses port **3001**.  
> Port 3000 is deliberately not used to avoid conflicts with other projects.

### 5. Port conflict resolution

If another Docker project is already using port 8000 or 3001, `docker compose up` will fail with `Bind for ... failed: port is already allocated`.

Copy the override template and customise the host ports:

```bash
cp compose.override.yaml.example compose.override.yaml
# Edit compose.override.yaml to remap conflicting ports
docker compose up -d
```

`compose.override.yaml` is gitignored — it's machine-local only.

### 6. Stop the stack

```bash
docker compose down
```

Data in the PostgreSQL named volume (`liftiq_pgdata`) is **preserved** across restarts.

### Reset the database (destructive — local only)

```bash
docker compose down -v
```

This removes the `liftiq_pgdata` volume. All data is lost. Only use this when you intentionally want to start fresh.

---

## Local Development Without Docker

For rapid iteration without rebuilding Docker images:

**Backend**

```bash
# Requires: Python 3.12+, PostgreSQL running locally or via Docker
cp .env.example .env   # set DATABASE_URL, SECRET_KEY, GROQ_API_KEY
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                  # Always starts on http://localhost:3001
```

---

## Architecture

```
Browser
  │  http://localhost:3001
  ▼
Next.js Frontend (React, TypeScript, TailwindCSS)
  │  http://localhost:8000
  ▼
FastAPI Backend (Python, SQLAlchemy, Alembic)
  │  ┌─────────────────────────┐
  ├──▶ PostgreSQL 16            │
  │  └─────────────────────────┘
  │  ┌─────────────────────────┐
  └──▶ Groq API (LLM coaching) │
       └─────────────────────────┘
       
WebSocket: ws://localhost:8000/ws/webcam
CV Engine: MediaPipe + OpenCV (runs inside backend container)
```

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | Next.js 15, React 19, TypeScript, TailwindCSS v4, TanStack Query |
| Backend   | FastAPI, Python 3.12, SQLAlchemy 2.0, Alembic, Pydantic v2 |
| Database  | PostgreSQL 16 |
| AI / CV   | MediaPipe, OpenCV, Groq (llama-3.1-8b-instant) |
| Auth      | JWT access tokens (15 min) + hashed refresh tokens (7 days) |
| Infra     | Docker Compose (local), Vercel + Render + Supabase (production) |

---

## Production Deployment

| Service   | Platform |
|-----------|----------|
| Frontend  | Vercel   |
| Backend   | Render (Docker) |
| Database  | Supabase PostgreSQL |

See `docs/09_DEPLOYMENT_AND_TESTING.md` and `docs/10_WEB_HOSTING_IMPLEMENTATION_PLAN.md` for the full deployment guide.

---

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/01_PRODUCT_REQUIREMENTS.md` | Feature requirements |
| `docs/02_ENGINEERING_SPEC.md` | Architecture and principles |
| `docs/04_API_SPEC.md` | API endpoint reference |
| `docs/05_DATABASE_SPEC.md` | Schema design |
| `docs/09_DEPLOYMENT_AND_TESTING.md` | Deployment & testing spec |
| `CODEX.md` | Engineering operating manual |
| `TASKS.md` | Progress tracker |