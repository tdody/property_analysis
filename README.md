# STR Profitability Calculator

A full-stack tool for evaluating short-term rental (STR) property investment profitability. Scrape property data from Redfin, model mortgage scenarios, configure STR revenue and expense assumptions, and compare properties side-by-side with key financial metrics.

## Features

- **Property scraping** — Auto-populate property details from Redfin listings (with manual entry fallback)
- **Mortgage scenario modeling** — Create and compare multiple financing scenarios per property (loan type, down payment, interest rate, closing costs, renovation budgets)
- **STR revenue & expense assumptions** — Configure occupancy, nightly rates, cleaning fees, platform fees, property management, maintenance reserves, and more
- **Financial metrics** — Monthly/annual cashflow, cash-on-cash return, cap rate, NOI, DSCR, break-even occupancy, gross yield
- **Amortization schedules** — Full month-by-month loan amortization tables
- **Sensitivity analysis** — Occupancy and nightly rate sweeps to visualize cashflow sensitivity
- **Property comparison** — Side-by-side comparison of properties with their active scenarios

## Architecture

```
property_analysis/
├── backend/          # FastAPI + SQLAlchemy + SQLite
├── frontend/         # React 19 + TypeScript + Tailwind CSS
├── docker-compose.yml
└── docs/             # Specs and plans
```

The backend exposes a REST API consumed by the React SPA frontend. In development, Vite proxies `/api` requests to the backend. In production, Nginx handles static files and proxies API calls.

## Quick Start

### With Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health check: http://localhost:8000/api/health

### Local Development

**Backend:**

```bash
cd backend
pdm install
pdm run uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Tech Stack

| Layer    | Technology                                  |
|----------|---------------------------------------------|
| Backend  | Python 3.13, FastAPI, SQLAlchemy, Alembic   |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 8 |
| Database | SQLite (async via aiosqlite)                |
| Scraping | httpx + HTML parsing                        |
| Testing  | pytest + pytest-asyncio                     |
