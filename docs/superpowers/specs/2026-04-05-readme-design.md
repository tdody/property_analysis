# README Design Spec

**Date:** 2026-04-05
**Linear Issue:** THI-15
**Branch:** `thibaultdody/thi-15-readme-file`

## Context

Create a README.md for the STR Profitability Calculator project. The README serves dual purposes: portfolio showcase for potential employers and practical developer reference.

## Target Audience

- Primary: portfolio reviewers / potential employers
- Secondary: the developer (personal reference)

## Tone & Style

Professional structure with approachable language. Badges for visual polish. Tables and tree diagrams for scannability.

## Structure (Approach C — Balanced/Hybrid)

### 1. Hero Description

Title: **STR Profitability Calculator**

2-3 sentence intro covering:
- Full-stack app for evaluating STR and LTR property investments
- Core capabilities: mortgage modeling, revenue/expense assumptions, financial metrics, property comparison
- Redfin scraping for auto-populating property details

Followed by badges: Python, React, FastAPI, Docker.

### 2. Feature Highlights

Grouped bullet list:

**Property Management**
- Redfin scraping or manual entry
- STR and LTR rental types
- Side-by-side property comparison

**Financial Modeling**
- Multiple mortgage scenarios (conventional, DSCR, interest-only)
- 15+ operating expense categories
- Seasonal occupancy modeling (peak/off-peak)
- Rental delay periods
- Multi-year projections with appreciation and growth

**Metrics & Analysis**
- Monthly/annual cashflow, cash-on-cash return, cap rate, NOI, DSCR
- Break-even occupancy, gross yield, equity buildup
- Full amortization schedules
- Sensitivity analysis (occupancy and nightly rate sweeps)
- Building and furniture depreciation

**Vermont Tax Support**
- State rooms tax, surcharge, local option tax
- Burlington gross receipts tax
- Registration fees

### 3. Screenshots

Placeholder image references in `docs/screenshots/`:

| Screenshot | Description |
|-----------|-------------|
| `dashboard.png` | Property grid with summary cards and Redfin import form |
| `property-info.png` | Property details — address, beds/baths, taxes |
| `financing.png` | Mortgage scenario editor with multiple scenarios |
| `revenue-expenses.png` | STR/LTR assumptions configuration |
| `results.png` | Key metrics, amortization table, sensitivity charts |
| `comparison.png` | Side-by-side property comparison table |

### 4. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite, React Router v7 |
| Backend | FastAPI, Python 3.13, SQLAlchemy 2.0, Pydantic |
| Database | SQLite (async via aiosqlite), Alembic migrations |
| Scraping | httpx, BeautifulSoup |
| Testing | pytest, pytest-asyncio |
| Infrastructure | Docker, Docker Compose, Nginx |
| Package Managers | PDM (backend), npm (frontend) |

### 5. Getting Started

**Prerequisites:** Python 3.13+, Node.js 18+, PDM, Docker (optional)

**Quick Start (Docker):**
```bash
git clone <repo-url>
cd property_analysis
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health check: http://localhost:8000/api/health

**Local Development:**

Backend:
```bash
cd backend
pdm install
pdm run uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Or: `./start.sh`

> Note: The database is auto-created on first startup via `create_all` — no manual migration step is required.

### 6. Project Structure

Trimmed tree showing key directories with inline comments explaining purpose. Covers:
- `backend/app/` — main.py, config, database, models/, schemas/, routers/, services/ (analysis, computation/, scraper/)
- `backend/alembic/` — migrations
- `backend/tests/` — pytest suite
- `frontend/src/` — api/, components/, context/, hooks/, pages/, types/
- `frontend/nginx.conf` — production proxy
- `docs/` — specs, plans, financial review
- `docker-compose.yml`, `start.sh`

### 7. Disclaimers

**Not Financial Advice:**
Educational/informational purposes only. Not financial, investment, or tax advice. Consult a qualified professional.

**Data Accuracy:**
Redfin data may be incomplete/inaccurate. Vermont-specific tax rates may not reflect current legislation. Projections are estimates — actual results vary.

## Out of Scope

- License section (not specified, can be added later)
- Contributing guide
- API documentation (could be a separate doc)
- CI/CD badges (no CI pipeline yet)
