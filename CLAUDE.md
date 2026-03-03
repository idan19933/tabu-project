# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tabu Project is a full-stack Israeli urban renewal (התחדשות עירונית) feasibility analysis platform. It uses AI agents (Claude via LangChain) to extract data from Hebrew PDF documents, run financial calculations (Shikun & Binui model), and generate scenario analysis for real estate projects.

## Tech Stack

- **Frontend:** React 19 + TypeScript, Vite, React Router 7, Tailwind CSS 4, Recharts, Framer Motion
- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2, PostgreSQL, Alembic migrations
- **AI:** LangChain + Claude API (extraction, research, calculation validation, alternatives)
- **Deploy:** Docker (multi-stage), Railway

## Commands

### Frontend (`frontend/`)
```bash
npm run dev       # Dev server on :3000, proxies /api → localhost:8000
npm run build     # tsc -b && vite build
npm run lint      # ESLint
```

### Backend (`backend/`)
```bash
pip install -r requirements.txt
python -m alembic upgrade head                              # Run migrations
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000  # Start server
```

### Docker
```bash
docker build -t tabu-app .
docker run -e DATABASE_URL=... -e ANTHROPIC_API_KEY=... -p 8000:8000 tabu-app
```

## Architecture

### Multi-Agent Pipeline (Sequential SSE-streamed)
1. **Extraction Agent** — Parses PDFs via Claude, extracts planning/cost/revenue/tabu parameters
2. **Research Agent** — Fills missing fields by searching documents with Claude
3. **Calculation Agent** — Runs financial engine + AI validation of results
4. **Alternatives Agent** — Generates Conservative/Base/Optimistic scenarios with AI recommendations

Orchestrated by `backend/app/agents/orchestrator.py`, streamed to frontend via SSE (`useAgentStream` hook).

### Backend Structure
- `app/agents/` — 4-step AI pipeline (extraction → research → calculation → alternatives)
- `app/api/` — FastAPI route handlers (projects, simulations, documents, research)
- `app/models/` — SQLAlchemy models (Project, Document, Simulation, PlanningParameter, CostParameter, RevenueParameter, ApartmentMix, SimulationResult)
- `app/services/` — Business logic; `calculation_service.py` (~1000 lines) is the core financial engine
- `app/schemas/` — Pydantic request/response schemas
- `app/utils/` — PDF extraction utilities

### Frontend Structure
- `src/pages/` — 8 pages: Projects dashboard, Upload, Review, Edit, Workspace, Results, Compare
- `src/components/` — Reusable UI components + layout
- `src/hooks/` — `useAgentStream` (SSE), `useAsync`, `usePolling`
- `src/api/` — Fetch-based API client with error handling
- `src/types/` — TypeScript interfaces matching backend schemas

### Key Data Flow
User creates Project → uploads PDFs → creates Simulation → triggers agent pipeline (SSE progress) → reviews extracted params → edits params → views calculated results (profit, IRR, NPV) → compares scenarios → sensitivity analysis

### Financial Calculation Engine (`calculation_service.py`)
Sections mirror the Shikun & Binui feasibility model:
- Section 2: Proposed state (new vs existing units)
- Section 3: Building program (areas, parking, commercial)
- Section 4: All cost categories
- Section 5: Revenue (residential + commercial)
- Final: Cashflow, IRR, NPV computation

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API key
- `PORT` — Server port (default 8000)
- `UPLOAD_DIR` — PDF upload directory (default `uploads`)

## Key Conventions
- Full RTL/Hebrew UI — Claude prompts are in Hebrew for document extraction
- Frontend proxies `/api/*` to backend in dev (Vite config)
- Built frontend is served as static files from `backend/static/` in production
- Health check: `GET /api/health`
- Database migrations auto-run on startup via `alembic upgrade head`
