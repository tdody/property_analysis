# STR Profitability Calculator

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

A full-stack application for evaluating short-term and long-term rental property investments. Model mortgage scenarios, configure revenue and expense assumptions, calculate key financial metrics (cash-on-cash return, cap rate, DSCR, NOI), and compare properties side by side. Auto-populate property details from Redfin listings or enter them manually.

---

## Features

### Property Management
- Scrape property details from Redfin or enter manually
- Support for both STR and LTR rental types
- Side-by-side property comparison

### Financial Modeling
- Multiple mortgage scenarios per property (conventional, DSCR, interest-only)
- 15+ configurable operating expense categories
- Seasonal occupancy modeling (peak/off-peak)
- Rental delay periods for renovation and setup
- Multi-year projections with property appreciation and growth rates

### Metrics & Analysis
- Monthly and annual cashflow, cash-on-cash return, cap rate, NOI, DSCR
- Break-even occupancy, gross yield, equity buildup
- Full amortization schedules
- Sensitivity analysis with occupancy and nightly rate sweeps
- Building and furniture depreciation for tax planning

### Vermont Tax Support
- State rooms tax, surcharge, local option tax
- Burlington gross receipts tax
- Registration fees

---

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Property Detail — Info
![Property Info](docs/screenshots/property-info.png)

### Property Detail — Financing
![Financing](docs/screenshots/financing.png)

### Property Detail — Revenue & Expenses
![Revenue & Expenses](docs/screenshots/revenue-expenses.png)

### Property Detail — Results
![Results](docs/screenshots/results.png)

### Property Comparison
![Comparison](docs/screenshots/comparison.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Vite, React Router v7 |
| **Backend** | FastAPI, Python 3.13, SQLAlchemy 2.0, Pydantic |
| **Database** | SQLite (async via aiosqlite), Alembic migrations |
| **Scraping** | httpx, BeautifulSoup |
| **Testing** | pytest, pytest-asyncio |
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **Package Managers** | PDM (backend), npm (frontend) |

---

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 18+
- [PDM](https://pdm-project.org/) (Python package manager)
- Docker & Docker Compose (optional)

### Quick Start (Docker)

```bash
git clone <repo-url>
cd property_analysis
docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Health check:** http://localhost:8000/api/health

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

Or use the provided startup script:

```bash
./start.sh
```

> The database is auto-created on first startup — no manual migration step is required.

---

## Project Structure

```
property_analysis/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings & environment config
│   │   ├── database.py          # SQLAlchemy engine & session
│   │   ├── models/              # ORM models (property, scenario, assumptions)
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── routers/             # API endpoints
│   │   └── services/
│   │       ├── analysis.py      # Compute & cache metrics
│   │       ├── computation/     # Pure financial math modules
│   │       └── scraper/         # Redfin HTML scraper
│   ├── alembic/                 # Database migrations
│   ├── tests/                   # pytest test suite
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios API client
│   │   ├── components/          # React components (Dashboard, PropertyDetail, Comparison)
│   │   ├── context/             # Theme context (dark/light mode)
│   │   ├── hooks/               # Custom hooks (useProperty, useScenarios, useAssumptions)
│   │   ├── pages/               # Route pages (Dashboard, Property, Compare, Settings)
│   │   └── types/               # TypeScript interfaces
│   ├── nginx.conf               # Production reverse proxy config
│   └── Dockerfile
├── docs/                        # Specs, plans, and financial accuracy review
├── docker-compose.yml           # Multi-container orchestration
└── start.sh                     # Local dev startup script
```

---

## Disclaimers

### Not Financial Advice

This tool is for educational and informational purposes only. It is not intended as financial, investment, or tax advice. Always consult a qualified professional before making investment decisions.

### Data Accuracy

Property data scraped from Redfin may be incomplete or inaccurate. Tax calculations are based on Vermont-specific rates and may not reflect current legislation. All financial projections are estimates — actual results will vary based on market conditions, property-specific factors, and other variables not modeled by this tool.
