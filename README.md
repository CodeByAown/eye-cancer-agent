# AI Medical Vision Platform

A production-grade, multi-agent **AI Healthcare Platform** — realtime AI Eye Scanner, medical image analysis (eye + cancer), explainability, context-aware medical chat, clinical PDF reports, and an enterprise admin portal.

> ⚕️ **Responsible-AI notice:** This platform provides **educational / decision-support** information only. It is **not** a medical device and is **not** a substitute for a licensed clinician. See `docs/04-risks-ops.md`.

## Architecture at a glance

- **Frontend** — Next.js 15 (App Router) · React · TypeScript · Tailwind · shadcn/ui · Framer Motion
- **Backend** — FastAPI (Python 3.13) API gateway + deterministic **Workflow Orchestrator**
- **Agents** — Vision · Eye Specialist · Oncology · Explainability · Report · Patient Education · Medical Chat
- **Data** — PostgreSQL (+ pgvector) · Redis (queue/cache) · S3/R2 object storage
- **AI** — PyTorch · MONAI · timm/RETFound · MediaPipe (in-browser) · ONNX Runtime · Claude (narrative/chat)

Full design in [`docs/`](docs/00-overview.md).

## Repository layout

```
apps/web            Next.js frontend
apps/api            FastAPI backend (API gateway + orchestrator client)
services/agents     Multi-agent runtime (orchestrator + specialist agents)
services/inference  Model runtime + plug-in modules
packages/types      Shared TS types (generated from OpenAPI)
packages/ui         Shared design system
infra/              Docker, compose, k8s, terraform
docs/               Planning dossier
```

## Quick start

### Option A — zero-infra dev (no Docker)

The backend defaults to SQLite + in-memory fallbacks so it runs with nothing else installed.

```bash
# Backend
cd apps/api
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload            # http://localhost:8000  (docs at /docs)

# Frontend (new terminal, from repo root)
pnpm install
pnpm dev                                  # http://localhost:3000
```

### Option B — full stack via Docker Compose

```bash
cp .env.example .env
docker compose -f infra/compose/docker-compose.yml up --build
```

## Health

- `GET /api/v1/health` — liveness
- `GET /api/v1/ready` — readiness (db, redis, storage)
- `GET /metrics` — Prometheus

## License

See individual model/dataset licenses in `docs/01-research.md`. Research-grade models (RETFound/UNI) are **non-commercial**; this build is demo-scoped.
