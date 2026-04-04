# Backend — STR Profitability Calculator

FastAPI application providing the REST API and computation engine for STR property analysis.

## Setup

Requires Python 3.13+ and [PDM](https://pdm-project.org/).

```bash
pdm install          # Install all dependencies
pdm run uvicorn app.main:app --reload   # Start dev server on :8000
```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, lifespan
│   ├── config.py            # Settings (DATABASE_URL)
│   ├── database.py          # SQLAlchemy engine + session
│   ├── models/              # ORM models
│   │   ├── property.py      # Property (listing details, taxes, etc.)
│   │   ├── scenario.py      # MortgageScenario (loan terms, upfront costs)
│   │   └── assumptions.py   # STRAssumptions (revenue, operating, tax params)
│   ├── schemas/             # Pydantic request/response schemas
│   │   ├── property.py      # PropertyCreate, PropertyResponse, ScrapeRequest/Response
│   │   ├── scenario.py      # ScenarioCreate, ScenarioResponse
│   │   ├── assumptions.py   # AssumptionsUpdate, AssumptionsResponse
│   │   └── results.py       # ComputedResults
│   ├── routers/             # API endpoints
│   │   ├── properties.py    # CRUD + POST /scrape
│   │   ├── scenarios.py     # CRUD + /activate, /duplicate
│   │   ├── assumptions.py   # GET/PUT per property
│   │   └── compute.py       # Results, amortization, sensitivity, compare
│   └── services/
│       ├── computation/     # Pure financial math (no side effects)
│       │   ├── mortgage.py  # Loan amount, monthly P&I, PMI, total housing cost
│       │   ├── revenue.py   # Occupied nights, turnovers, gross/net revenue
│       │   ├── expenses.py  # Operating expense breakdown
│       │   ├── metrics.py   # Cashflow, COC return, cap rate, NOI, DSCR
│       │   └── sensitivity.py # Occupancy & rate sweeps
│       └── scraper/
│           ├── models.py    # ScraperResult data model
│           └── redfin.py    # Redfin HTML scraper
├── alembic/                 # Database migrations
├── tests/                   # pytest test suite
├── data/                    # SQLite database (auto-created)
├── pyproject.toml
└── Dockerfile
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/properties` | List all properties |
| POST | `/api/properties` | Create property |
| GET | `/api/properties/{id}` | Get property detail |
| PUT | `/api/properties/{id}` | Update property |
| DELETE | `/api/properties/{id}` | Delete property |
| POST | `/api/properties/scrape` | Scrape Redfin listing |
| GET | `/api/properties/{id}/scenarios` | List scenarios |
| POST | `/api/properties/{id}/scenarios` | Create scenario |
| PUT | `/api/properties/{id}/scenarios/{sid}` | Update scenario |
| DELETE | `/api/properties/{id}/scenarios/{sid}` | Delete scenario |
| POST | `/api/properties/{id}/scenarios/{sid}/activate` | Set active scenario |
| POST | `/api/properties/{id}/scenarios/{sid}/duplicate` | Clone scenario |
| GET | `/api/properties/{id}/assumptions` | Get STR assumptions |
| PUT | `/api/properties/{id}/assumptions` | Update assumptions |
| GET | `/api/properties/{id}/results` | Computed results (active scenario) |
| GET | `/api/properties/{id}/results/{sid}` | Computed results (specific scenario) |
| GET | `/api/properties/{id}/amortization/{sid}` | Amortization schedule |
| GET | `/api/properties/{id}/sensitivity` | Sensitivity analysis |
| POST | `/api/compare` | Compare multiple properties |

## Testing

```bash
pdm run pytest              # Run all tests
pdm run pytest -v           # Verbose output
pdm run pytest tests/test_mortgage.py   # Run specific test file
```

Tests cover both the pure computation functions and the API endpoints using an in-memory SQLite database.

## Database Migrations

```bash
pdm run alembic upgrade head     # Apply migrations
pdm run alembic revision --autogenerate -m "description"   # Create new migration
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/str_calc.db` | SQLAlchemy database URL |
