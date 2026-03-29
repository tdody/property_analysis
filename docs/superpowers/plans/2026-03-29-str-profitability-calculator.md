# STR Profitability Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack web application for evaluating short-term rental property investment profitability, with manual property entry, multiple mortgage scenarios, STR revenue/expense modeling, and side-by-side property comparison.

**Architecture:** FastAPI backend with SQLAlchemy ORM + SQLite, pure-Python computation engine (no side effects), React/TypeScript frontend with Vite + Tailwind CSS. All services containerized via Docker Compose. Backend uses PDM for dependency management.

**Tech Stack:** Python 3.13 (FastAPI, SQLAlchemy, Alembic, Pydantic, PDM), TypeScript (React 18, Vite, Tailwind CSS, Axios), SQLite, Docker Compose.

**Spec:** `str-profitability-spec.md` (root of repo)

---

## File Structure

```
str-calculator/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml              # PDM project config
│   ├── pdm.lock
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app, CORS, lifespan
│   │   ├── config.py               # Settings (DB path, env vars)
│   │   ├── database.py             # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── property.py         # Property ORM model
│   │   │   ├── scenario.py         # MortgageScenario ORM model
│   │   │   └── assumptions.py      # STRAssumptions ORM model
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── property.py         # Pydantic request/response
│   │   │   ├── scenario.py
│   │   │   ├── assumptions.py
│   │   │   └── results.py          # ComputedResults schema
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── properties.py       # CRUD (scraper deferred to V2)
│   │   │   ├── scenarios.py        # Scenario CRUD
│   │   │   ├── assumptions.py      # Assumptions CRUD
│   │   │   └── compute.py          # Results, amortization, sensitivity, comparison
│   │   └── services/
│   │       └── computation/
│   │           ├── __init__.py
│   │           ├── mortgage.py     # Pure mortgage math functions
│   │           ├── revenue.py      # Pure revenue math functions
│   │           ├── expenses.py     # Pure expense math functions
│   │           ├── metrics.py      # Pure key metrics functions
│   │           └── sensitivity.py  # Sensitivity analysis
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py             # Fixtures (db session, sample data)
│       ├── test_mortgage.py
│       ├── test_revenue.py
│       ├── test_expenses.py
│       ├── test_metrics.py
│       ├── test_sensitivity.py
│       ├── test_api_properties.py
│       ├── test_api_scenarios.py
│       ├── test_api_assumptions.py
│       └── test_api_compute.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── client.ts           # Axios client + API functions
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces matching backend schemas
│   │   ├── components/
│   │   │   ├── shared/
│   │   │   │   ├── MetricCard.tsx
│   │   │   │   ├── CurrencyInput.tsx
│   │   │   │   ├── PercentInput.tsx
│   │   │   │   ├── TooltipIcon.tsx
│   │   │   │   └── ConfirmDialog.tsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   └── PropertyCard.tsx
│   │   │   ├── PropertyDetail/
│   │   │   │   ├── PropertyDetail.tsx
│   │   │   │   ├── PropertyInfoTab.tsx
│   │   │   │   ├── FinancingTab.tsx
│   │   │   │   ├── RevenueExpensesTab.tsx
│   │   │   │   ├── ResultsTab.tsx
│   │   │   │   └── ScenarioCard.tsx
│   │   │   └── Comparison/
│   │   │       └── ComparisonView.tsx
│   │   ├── hooks/
│   │   │   ├── useProperty.ts
│   │   │   ├── useScenarios.ts
│   │   │   └── useAssumptions.ts
│   │   └── pages/
│   │       ├── DashboardPage.tsx
│   │       ├── PropertyPage.tsx
│   │       └── ComparePage.tsx
│   └── nginx.conf                  # Production nginx config for Docker
```

---

## Task 1: Project Scaffolding & Docker Setup

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `frontend/Dockerfile`
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Initialize backend with PDM**

```bash
cd backend
pdm init --non-interactive --python 3.13
```

Then edit `pyproject.toml`:

```toml
[project]
name = "str-calculator-backend"
version = "0.1.0"
description = "STR Profitability Calculator Backend"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.14.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "aiosqlite>=0.21.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.25.0",
    "httpx>=0.28.0",
]

[tool.pdm]
distribution = false

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

```bash
pdm install -G dev
```

- [ ] **Step 2: Create backend app skeleton**

`backend/app/__init__.py` — empty file.

`backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/str_calc.db"

    model_config = {"env_prefix": ""}


settings = Settings()
```

`backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="STR Profitability Calculator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Initialize frontend with Vite + React + TypeScript + Tailwind**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom axios
npm install -D @types/react-router-dom
```

`frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
```

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900">
              STR Profitability Calculator
            </h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<p>Dashboard coming soon</p>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

Update `frontend/src/main.tsx` to import Tailwind:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Replace `frontend/src/index.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Create Dockerfiles**

`backend/Dockerfile`:

```dockerfile
FROM python:3.13-slim

WORKDIR /app

RUN pip install pdm

COPY pyproject.toml pdm.lock ./

RUN pdm install --prod --no-lock --no-editable

COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/

EXPOSE 8000

CMD ["pdm", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`frontend/nginx.conf`:

```nginx
server {
    listen 3000;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

`frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
```

- [ ] **Step 5: Create docker-compose.yml**

`docker-compose.yml` (project root):

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite:///./data/str_calc.db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

- [ ] **Step 6: Verify Docker builds**

```bash
docker compose build
docker compose up -d
# Verify: curl http://localhost:8000/api/health → {"status":"ok"}
# Verify: http://localhost:3000 loads the React app
docker compose down
```

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml backend/ frontend/
git commit -m "feat: scaffold project with FastAPI + React + Docker Compose

- Backend: FastAPI with PDM, health endpoint
- Frontend: Vite + React + TypeScript + Tailwind CSS
- Docker Compose with backend and frontend services"
```

---

## Task 2: Database Models & Migrations

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/property.py`
- Create: `backend/app/models/scenario.py`
- Create: `backend/app/models/assumptions.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Modify: `backend/app/main.py` (add DB lifespan)

- [ ] **Step 1: Create database module**

`backend/app/database.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Create Property model**

`backend/app/models/__init__.py`:

```python
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions

__all__ = ["Property", "MortgageScenario", "STRAssumptions"]
```

`backend/app/models/property.py`:

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    name: Mapped[str] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    address: Mapped[str] = mapped_column(String(500), default="")
    city: Mapped[str] = mapped_column(String(255), default="")
    state: Mapped[str] = mapped_column(String(2), default="")
    zip_code: Mapped[str] = mapped_column(String(10), default="")
    listing_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    estimated_value: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    beds: Mapped[int] = mapped_column(Integer, default=0)
    baths: Mapped[float] = mapped_column(Float, default=0)
    sqft: Mapped[int] = mapped_column(Integer, default=0)
    lot_sqft: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)
    property_type: Mapped[str] = mapped_column(String(50), default="single_family")
    hoa_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    annual_taxes: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    tax_rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    is_homestead_tax: Mapped[bool] = mapped_column(Boolean, default=True)
    nonhomestead_annual_taxes: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    scenarios: Mapped[list["MortgageScenario"]] = relationship(back_populates="property", cascade="all, delete-orphan")
    assumptions: Mapped["STRAssumptions | None"] = relationship(back_populates="property", uselist=False, cascade="all, delete-orphan")
```

- [ ] **Step 3: Create MortgageScenario model**

`backend/app/models/scenario.py`:

```python
import uuid
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MortgageScenario(Base):
    __tablename__ = "mortgage_scenarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id: Mapped[str] = mapped_column(String(36), ForeignKey("properties.id"))
    name: Mapped[str] = mapped_column(String(255), default="Default Scenario")
    loan_type: Mapped[str] = mapped_column(String(20), default="conventional")
    purchase_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    down_payment_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=25.0)
    down_payment_amt: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    interest_rate: Mapped[float] = mapped_column(Numeric(6, 3), default=7.25)
    loan_term_years: Mapped[int] = mapped_column(Integer, default=30)
    closing_cost_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    closing_cost_amt: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    renovation_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    furniture_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    other_upfront_costs: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    pmi_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    property: Mapped["Property"] = relationship(back_populates="scenarios")
```

- [ ] **Step 4: Create STRAssumptions model**

`backend/app/models/assumptions.py`:

```python
import uuid
from sqlalchemy import Boolean, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class STRAssumptions(Base):
    __tablename__ = "str_assumptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id: Mapped[str] = mapped_column(String(36), ForeignKey("properties.id"), unique=True)

    # Revenue
    avg_nightly_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=200)
    occupancy_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=65.0)
    cleaning_fee_per_stay: Mapped[float] = mapped_column(Numeric(10, 2), default=150)
    avg_stay_length_nights: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)

    # Operating Expenses
    platform_fee_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    cleaning_cost_per_turn: Mapped[float] = mapped_column(Numeric(10, 2), default=120)
    property_mgmt_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    utilities_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=250)
    insurance_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=2500)
    maintenance_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=5.0)
    capex_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=5.0)
    supplies_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=100)
    lawn_snow_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    other_monthly_expense: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    vacancy_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)

    # Vermont / State Taxes
    state_rooms_tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=9.0)
    str_surcharge_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    local_option_tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=1.0)
    local_str_registration_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    platform_remits_tax: Mapped[bool] = mapped_column(Boolean, default=True)

    property: Mapped["Property"] = relationship(back_populates="assumptions")
```

- [ ] **Step 5: Set up Alembic**

```bash
cd backend
pdm run alembic init alembic
```

Edit `backend/alembic.ini` — set `sqlalchemy.url` to empty (overridden in env.py).

`backend/alembic/env.py`:

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base
from app.models import Property, MortgageScenario, STRAssumptions  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 6: Generate initial migration**

```bash
cd backend
pdm run alembic revision --autogenerate -m "initial tables"
```

- [ ] **Step 7: Update main.py lifespan to run migrations**

Add to `backend/app/main.py`:

```python
from app.database import engine, Base
from app.models import Property, MortgageScenario, STRAssumptions  # noqa: F401

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield
```

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: add database models and Alembic migrations

- Property, MortgageScenario, STRAssumptions models
- Alembic configured with initial migration
- Auto-create tables on startup"
```

---

## Task 3: Computation Engine — Mortgage Calculations (TDD)

**Files:**
- Create: `backend/app/services/computation/__init__.py`
- Create: `backend/app/services/computation/mortgage.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_mortgage.py`

- [ ] **Step 1: Write failing tests for mortgage calculations**

`backend/tests/__init__.py` — empty file.

`backend/tests/conftest.py`:

```python
# Shared fixtures will go here as needed
```

`backend/tests/test_mortgage.py`:

```python
import pytest
from app.services.computation.mortgage import (
    compute_monthly_pi,
    compute_loan_amount,
    compute_pmi,
    compute_total_monthly_housing,
    compute_total_cash_invested,
    compute_amortization_schedule,
)


class TestLoanAmount:
    def test_standard_down_payment(self):
        assert compute_loan_amount(400_000, 100_000) == 300_000

    def test_zero_down(self):
        assert compute_loan_amount(400_000, 0) == 400_000

    def test_cash_purchase(self):
        assert compute_loan_amount(400_000, 400_000) == 0


class TestMonthlyPI:
    def test_30yr_conventional(self):
        # $300,000 at 7.25% for 30 years
        result = compute_monthly_pi(300_000, 7.25, 30)
        assert round(result, 2) == 2046.53

    def test_15yr_conventional(self):
        result = compute_monthly_pi(300_000, 7.25, 15)
        assert round(result, 2) == 2738.59

    def test_cash_purchase_no_loan(self):
        result = compute_monthly_pi(0, 7.25, 30)
        assert result == 0

    def test_zero_interest(self):
        # Edge case: 0% interest
        result = compute_monthly_pi(300_000, 0, 30)
        assert round(result, 2) == round(300_000 / 360, 2)


class TestPMI:
    def test_pmi_under_20_pct(self):
        # 10% down on $400k = $360k loan, PMI ~0.5% annually
        result = compute_pmi(360_000, "conventional", 10.0, pmi_override=None)
        assert round(result, 2) == 150.00  # 360000 * 0.005 / 12

    def test_no_pmi_20_pct_down(self):
        result = compute_pmi(300_000, "conventional", 20.0, pmi_override=None)
        assert result == 0

    def test_no_pmi_25_pct_down(self):
        result = compute_pmi(300_000, "conventional", 25.0, pmi_override=None)
        assert result == 0

    def test_no_pmi_for_dscr(self):
        result = compute_pmi(360_000, "dscr", 10.0, pmi_override=None)
        assert result == 0

    def test_no_pmi_for_cash(self):
        result = compute_pmi(0, "cash", 100.0, pmi_override=None)
        assert result == 0

    def test_pmi_override(self):
        result = compute_pmi(360_000, "conventional", 10.0, pmi_override=200.0)
        assert result == 200.0


class TestTotalMonthlyHousing:
    def test_all_components(self):
        result = compute_total_monthly_housing(
            monthly_pi=2046.53,
            monthly_pmi=150.0,
            annual_taxes=6000,
            insurance_annual=2500,
            hoa_monthly=100,
            nonhomestead_annual_taxes=None,
        )
        # PI + PMI + tax/12 + insurance/12 + HOA
        expected = 2046.53 + 150.0 + 500.0 + 208.33 + 100.0
        assert round(result, 2) == round(expected, 2)

    def test_nonhomestead_taxes_override(self):
        result = compute_total_monthly_housing(
            monthly_pi=2046.53,
            monthly_pmi=0,
            annual_taxes=5000,
            insurance_annual=2500,
            hoa_monthly=0,
            nonhomestead_annual_taxes=7000,
        )
        # Should use 7000 instead of 5000
        expected = 2046.53 + 0 + 7000 / 12 + 2500 / 12 + 0
        assert round(result, 2) == round(expected, 2)


class TestTotalCashInvested:
    def test_all_costs(self):
        result = compute_total_cash_invested(
            down_payment_amt=100_000,
            closing_cost_amt=12_000,
            renovation_cost=20_000,
            furniture_cost=15_000,
            other_upfront_costs=3_000,
        )
        assert result == 150_000


class TestAmortizationSchedule:
    def test_schedule_length(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        assert len(schedule) == 360

    def test_first_payment_split(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        first = schedule[0]
        monthly_rate = 7.25 / 100 / 12
        expected_interest = 300_000 * monthly_rate
        assert round(first["interest"], 2) == round(expected_interest, 2)
        assert round(first["principal"] + first["interest"], 2) == round(2046.53, 2)

    def test_final_balance_zero(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        assert round(schedule[-1]["remaining_balance"], 2) == 0

    def test_year1_equity_buildup(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        year1_principal = sum(m["principal"] for m in schedule[:12])
        assert year1_principal > 0
        assert year1_principal < 300_000

    def test_cash_purchase_empty_schedule(self):
        schedule = compute_amortization_schedule(0, 0, 0)
        assert schedule == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_mortgage.py -v
```

Expected: FAIL — module `app.services.computation.mortgage` does not exist.

- [ ] **Step 3: Implement mortgage computation module**

`backend/app/services/__init__.py` — empty file.
`backend/app/services/computation/__init__.py` — empty file.

`backend/app/services/computation/mortgage.py`:

```python
from decimal import Decimal, ROUND_HALF_UP


def compute_loan_amount(purchase_price: float, down_payment_amt: float) -> float:
    return purchase_price - down_payment_amt


def compute_monthly_pi(loan_amount: float, annual_rate: float, term_years: int) -> float:
    if loan_amount <= 0 or term_years <= 0:
        return 0

    if annual_rate == 0:
        return loan_amount / (term_years * 12)

    monthly_rate = annual_rate / 100 / 12
    n_payments = term_years * 12
    numerator = loan_amount * (monthly_rate * (1 + monthly_rate) ** n_payments)
    denominator = (1 + monthly_rate) ** n_payments - 1
    return numerator / denominator


def compute_pmi(
    loan_amount: float,
    loan_type: str,
    down_payment_pct: float,
    pmi_override: float | None,
) -> float:
    if pmi_override is not None:
        return pmi_override

    if loan_type != "conventional":
        return 0

    if down_payment_pct >= 20.0:
        return 0

    return loan_amount * 0.005 / 12


def compute_total_monthly_housing(
    monthly_pi: float,
    monthly_pmi: float,
    annual_taxes: float,
    insurance_annual: float,
    hoa_monthly: float,
    nonhomestead_annual_taxes: float | None,
) -> float:
    taxes = nonhomestead_annual_taxes if nonhomestead_annual_taxes is not None else annual_taxes
    monthly_tax = taxes / 12
    monthly_insurance = insurance_annual / 12
    return monthly_pi + monthly_pmi + monthly_tax + monthly_insurance + hoa_monthly


def compute_total_cash_invested(
    down_payment_amt: float,
    closing_cost_amt: float,
    renovation_cost: float,
    furniture_cost: float,
    other_upfront_costs: float,
) -> float:
    return down_payment_amt + closing_cost_amt + renovation_cost + furniture_cost + other_upfront_costs


def compute_amortization_schedule(
    loan_amount: float, annual_rate: float, term_years: int
) -> list[dict]:
    if loan_amount <= 0 or term_years <= 0:
        return []

    monthly_pi = compute_monthly_pi(loan_amount, annual_rate, term_years)
    monthly_rate = annual_rate / 100 / 12 if annual_rate > 0 else 0
    n_payments = term_years * 12
    balance = loan_amount
    schedule = []

    for month in range(1, n_payments + 1):
        interest = balance * monthly_rate
        principal = monthly_pi - interest
        balance -= principal
        if month == n_payments:
            balance = 0  # Avoid floating point residual
        schedule.append(
            {
                "month": month,
                "principal": principal,
                "interest": interest,
                "remaining_balance": balance,
            }
        )

    return schedule
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pdm run pytest tests/test_mortgage.py -v
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ backend/tests/
git commit -m "feat: add mortgage computation engine with full test coverage

- Monthly P&I (standard amortization formula)
- PMI calculation (conventional < 20% down)
- Total monthly housing costs
- Total cash invested
- Full amortization schedule generation"
```

---

## Task 4: Computation Engine — Revenue Calculations (TDD)

**Files:**
- Create: `backend/app/services/computation/revenue.py`
- Create: `backend/tests/test_revenue.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_revenue.py`:

```python
from app.services.computation.revenue import (
    compute_occupied_nights,
    compute_annual_turnovers,
    compute_gross_revenue,
    compute_net_revenue,
)


class TestOccupiedNights:
    def test_65_percent(self):
        assert compute_occupied_nights(65.0) == 365 * 0.65

    def test_100_percent(self):
        assert compute_occupied_nights(100.0) == 365

    def test_0_percent(self):
        assert compute_occupied_nights(0.0) == 0


class TestAnnualTurnovers:
    def test_3_night_avg_stay(self):
        occupied = 365 * 0.65  # 237.25
        result = compute_annual_turnovers(occupied, 3.0)
        assert round(result, 2) == round(237.25 / 3.0, 2)

    def test_7_night_avg_stay(self):
        occupied = 365 * 0.65
        result = compute_annual_turnovers(occupied, 7.0)
        assert round(result, 2) == round(237.25 / 7.0, 2)


class TestGrossRevenue:
    def test_basic_revenue(self):
        result = compute_gross_revenue(
            avg_nightly_rate=200,
            occupancy_pct=65.0,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
        )
        occupied = 365 * 0.65
        turnovers = occupied / 3.0
        expected_nightly = occupied * 200
        expected_cleaning = turnovers * 150
        assert round(result["gross_nightly_revenue"], 2) == round(expected_nightly, 2)
        assert round(result["cleaning_fee_revenue"], 2) == round(expected_cleaning, 2)
        assert round(result["total_gross_revenue"], 2) == round(expected_nightly + expected_cleaning, 2)
        assert round(result["annual_turnovers"], 2) == round(turnovers, 2)


class TestNetRevenue:
    def test_3_percent_platform_fee(self):
        total_gross = 60_000
        result = compute_net_revenue(total_gross, 3.0)
        assert round(result["platform_fees"], 2) == 1800.0
        assert round(result["net_revenue"], 2) == 58_200.0

    def test_zero_platform_fee(self):
        result = compute_net_revenue(50_000, 0.0)
        assert result["platform_fees"] == 0
        assert result["net_revenue"] == 50_000
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_revenue.py -v
```

Expected: FAIL.

- [ ] **Step 3: Implement revenue module**

`backend/app/services/computation/revenue.py`:

```python
def compute_occupied_nights(occupancy_pct: float) -> float:
    return 365 * (occupancy_pct / 100)


def compute_annual_turnovers(occupied_nights: float, avg_stay_length_nights: float) -> float:
    if avg_stay_length_nights <= 0:
        return 0
    return occupied_nights / avg_stay_length_nights


def compute_gross_revenue(
    avg_nightly_rate: float,
    occupancy_pct: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
) -> dict:
    occupied_nights = compute_occupied_nights(occupancy_pct)
    turnovers = compute_annual_turnovers(occupied_nights, avg_stay_length_nights)
    gross_nightly = occupied_nights * avg_nightly_rate
    cleaning_revenue = turnovers * cleaning_fee_per_stay
    return {
        "gross_nightly_revenue": gross_nightly,
        "cleaning_fee_revenue": cleaning_revenue,
        "total_gross_revenue": gross_nightly + cleaning_revenue,
        "annual_turnovers": turnovers,
        "occupied_nights": occupied_nights,
    }


def compute_net_revenue(total_gross_revenue: float, platform_fee_pct: float) -> dict:
    fees = total_gross_revenue * (platform_fee_pct / 100)
    return {
        "platform_fees": fees,
        "net_revenue": total_gross_revenue - fees,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pdm run pytest tests/test_revenue.py -v
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/computation/revenue.py backend/tests/test_revenue.py
git commit -m "feat: add revenue computation engine with tests

- Occupied nights, annual turnovers
- Gross revenue (nightly + cleaning fees)
- Net revenue after platform fees"
```

---

## Task 5: Computation Engine — Expenses Calculations (TDD)

**Files:**
- Create: `backend/app/services/computation/expenses.py`
- Create: `backend/tests/test_expenses.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_expenses.py`:

```python
from app.services.computation.expenses import compute_operating_expenses


class TestOperatingExpenses:
    def test_full_expenses(self):
        result = compute_operating_expenses(
            annual_turnovers=79.0,
            cleaning_cost_per_turn=120,
            net_annual_revenue=56_648,
            gross_annual_revenue=58_400,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            utilities_monthly=250,
            supplies_monthly=100,
            lawn_snow_monthly=0,
            other_monthly_expense=0,
            local_str_registration_fee=0,
        )
        expected_cleaning = 79.0 * 120
        expected_maintenance = 58_400 * 0.05
        expected_capex = 58_400 * 0.05
        expected_utilities = 250 * 12
        expected_supplies = 100 * 12

        assert round(result["annual_cleaning_cost"], 2) == round(expected_cleaning, 2)
        assert round(result["maintenance_reserve"], 2) == round(expected_maintenance, 2)
        assert round(result["capex_reserve"], 2) == round(expected_capex, 2)
        assert round(result["utilities_annual"], 2) == expected_utilities
        assert round(result["supplies_annual"], 2) == expected_supplies
        assert result["property_mgmt_cost"] == 0
        assert result["total_annual_operating_exp"] > 0

    def test_with_management_fee(self):
        result = compute_operating_expenses(
            annual_turnovers=50,
            cleaning_cost_per_turn=100,
            net_annual_revenue=50_000,
            gross_annual_revenue=52_000,
            property_mgmt_pct=20.0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            utilities_monthly=200,
            supplies_monthly=50,
            lawn_snow_monthly=100,
            other_monthly_expense=50,
            local_str_registration_fee=125,
        )
        assert round(result["property_mgmt_cost"], 2) == 10_000.0
        assert result["lawn_snow_annual"] == 1200
        assert result["other_annual"] == 600
        assert result["registration_annual"] == 125

    def test_all_zeros(self):
        result = compute_operating_expenses(
            annual_turnovers=0,
            cleaning_cost_per_turn=0,
            net_annual_revenue=0,
            gross_annual_revenue=0,
            property_mgmt_pct=0,
            maintenance_reserve_pct=0,
            capex_reserve_pct=0,
            utilities_monthly=0,
            supplies_monthly=0,
            lawn_snow_monthly=0,
            other_monthly_expense=0,
            local_str_registration_fee=0,
        )
        assert result["total_annual_operating_exp"] == 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_expenses.py -v
```

- [ ] **Step 3: Implement expenses module**

`backend/app/services/computation/expenses.py`:

```python
def compute_operating_expenses(
    annual_turnovers: float,
    cleaning_cost_per_turn: float,
    net_annual_revenue: float,
    gross_annual_revenue: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    utilities_monthly: float,
    supplies_monthly: float,
    lawn_snow_monthly: float,
    other_monthly_expense: float,
    local_str_registration_fee: float,
) -> dict:
    annual_cleaning_cost = annual_turnovers * cleaning_cost_per_turn
    property_mgmt_cost = net_annual_revenue * (property_mgmt_pct / 100)
    maintenance_reserve = gross_annual_revenue * (maintenance_reserve_pct / 100)
    capex_reserve = gross_annual_revenue * (capex_reserve_pct / 100)
    utilities_annual = utilities_monthly * 12
    supplies_annual = supplies_monthly * 12
    lawn_snow_annual = lawn_snow_monthly * 12
    other_annual = other_monthly_expense * 12
    registration_annual = local_str_registration_fee

    total = (
        annual_cleaning_cost
        + property_mgmt_cost
        + maintenance_reserve
        + capex_reserve
        + utilities_annual
        + supplies_annual
        + lawn_snow_annual
        + other_annual
        + registration_annual
    )

    return {
        "annual_cleaning_cost": annual_cleaning_cost,
        "property_mgmt_cost": property_mgmt_cost,
        "maintenance_reserve": maintenance_reserve,
        "capex_reserve": capex_reserve,
        "utilities_annual": utilities_annual,
        "supplies_annual": supplies_annual,
        "lawn_snow_annual": lawn_snow_annual,
        "other_annual": other_annual,
        "registration_annual": registration_annual,
        "total_annual_operating_exp": total,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pdm run pytest tests/test_expenses.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/computation/expenses.py backend/tests/test_expenses.py
git commit -m "feat: add operating expense computation engine with tests"
```

---

## Task 6: Computation Engine — Key Metrics & Sensitivity (TDD)

**Files:**
- Create: `backend/app/services/computation/metrics.py`
- Create: `backend/app/services/computation/sensitivity.py`
- Create: `backend/tests/test_metrics.py`
- Create: `backend/tests/test_sensitivity.py`

- [ ] **Step 1: Write failing tests for metrics**

`backend/tests/test_metrics.py`:

```python
import pytest
from app.services.computation.metrics import (
    compute_noi,
    compute_cashflow,
    compute_cash_on_cash_return,
    compute_cap_rate,
    compute_dscr,
    compute_gross_yield,
    compute_break_even_occupancy,
    compute_total_roi_year1,
    compute_all_metrics,
)


class TestNOI:
    def test_positive_noi(self):
        assert compute_noi(56_648, 27_748) == 56_648 - 27_748

    def test_negative_noi(self):
        assert compute_noi(10_000, 20_000) == -10_000


class TestCashflow:
    def test_positive_cashflow(self):
        result = compute_cashflow(noi=28_900, total_monthly_housing=2838.20)
        assert round(result["annual_cashflow"], 2) == round(28_900 - 2838.20 * 12, 2)
        assert round(result["monthly_cashflow"], 2) == round(result["annual_cashflow"] / 12, 2)

    def test_cash_purchase(self):
        result = compute_cashflow(noi=28_900, total_monthly_housing=0)
        assert result["annual_cashflow"] == 28_900


class TestCashOnCash:
    def test_positive_return(self):
        result = compute_cash_on_cash_return(9_877, 125_400)
        assert round(result, 2) == round(9_877 / 125_400 * 100, 2)

    def test_zero_invested(self):
        result = compute_cash_on_cash_return(5_000, 0)
        assert result == 0


class TestCapRate:
    def test_basic(self):
        result = compute_cap_rate(28_900, 425_000)
        assert round(result, 2) == round(28_900 / 425_000 * 100, 2)


class TestDSCR:
    def test_above_one(self):
        result = compute_dscr(28_900, 2046.53 * 12)
        assert result > 1.0

    def test_zero_debt_service(self):
        result = compute_dscr(28_900, 0)
        assert result == 0


class TestGrossYield:
    def test_basic(self):
        result = compute_gross_yield(58_400, 425_000)
        assert round(result, 2) == round(58_400 / 425_000 * 100, 2)


class TestBreakEvenOccupancy:
    def test_typical_scenario(self):
        result = compute_break_even_occupancy(
            avg_nightly_rate=200,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=4200,  # utilities + supplies + etc
            total_monthly_housing=2838.20,
        )
        assert 0 < result < 100  # Should be a valid percentage

    def test_impossible_if_costs_exceed_max_revenue(self):
        result = compute_break_even_occupancy(
            avg_nightly_rate=50,
            cleaning_fee_per_stay=10,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=25.0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=30_000,
            total_monthly_housing=5000,
        )
        assert result > 100  # Break-even impossible


class TestTotalROI:
    def test_with_equity(self):
        result = compute_total_roi_year1(
            annual_cashflow=9_877,
            year1_equity_buildup=5_000,
            total_cash_invested=125_400,
        )
        expected = (9_877 + 5_000) / 125_400 * 100
        assert round(result, 2) == round(expected, 2)

    def test_zero_invested(self):
        result = compute_total_roi_year1(9_877, 5_000, 0)
        assert result == 0


class TestComputeAllMetrics:
    def test_integration(self):
        result = compute_all_metrics(
            net_annual_revenue=56_648,
            total_annual_operating_exp=27_748,
            monthly_pi=2046.53,
            total_cash_invested=125_400,
            purchase_price=425_000,
            gross_annual_revenue=58_400,
            year1_equity_buildup=5_000,
            avg_nightly_rate=200,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=4200,
            total_monthly_housing=2838.20,
        )
        assert "monthly_cashflow" in result
        assert "annual_cashflow" in result
        assert "cash_on_cash_return" in result
        assert "cap_rate" in result
        assert "noi" in result
        assert "break_even_occupancy" in result
        assert "dscr" in result
        assert "gross_yield" in result
        assert "total_roi_year1" in result
```

- [ ] **Step 2: Write failing tests for sensitivity**

`backend/tests/test_sensitivity.py`:

```python
from app.services.computation.sensitivity import compute_sensitivity


class TestSensitivity:
    def test_occupancy_range(self):
        result = compute_sensitivity(
            avg_nightly_rate=200,
            base_occupancy_pct=65.0,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=4200,
            total_monthly_housing=2838.20,
        )
        assert "occupancy_sweep" in result
        assert len(result["occupancy_sweep"]) > 0
        # Each entry has occupancy and cashflow
        entry = result["occupancy_sweep"][0]
        assert "occupancy_pct" in entry
        assert "monthly_cashflow" in entry

    def test_rate_range(self):
        result = compute_sensitivity(
            avg_nightly_rate=200,
            base_occupancy_pct=65.0,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=4200,
            total_monthly_housing=2838.20,
        )
        assert "rate_sweep" in result
        assert len(result["rate_sweep"]) > 0
        entry = result["rate_sweep"][0]
        assert "nightly_rate" in entry
        assert "monthly_cashflow" in entry
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_metrics.py tests/test_sensitivity.py -v
```

- [ ] **Step 4: Implement metrics module**

`backend/app/services/computation/metrics.py`:

```python
def compute_noi(net_annual_revenue: float, total_annual_operating_exp: float) -> float:
    return net_annual_revenue - total_annual_operating_exp


def compute_cashflow(noi: float, total_monthly_housing: float) -> dict:
    annual_fixed_costs = total_monthly_housing * 12
    annual_cashflow = noi - annual_fixed_costs
    return {
        "annual_cashflow": annual_cashflow,
        "monthly_cashflow": annual_cashflow / 12,
    }


def compute_cash_on_cash_return(annual_cashflow: float, total_cash_invested: float) -> float:
    if total_cash_invested <= 0:
        return 0
    return (annual_cashflow / total_cash_invested) * 100


def compute_cap_rate(noi: float, purchase_price: float) -> float:
    if purchase_price <= 0:
        return 0
    return (noi / purchase_price) * 100


def compute_dscr(noi: float, annual_debt_service: float) -> float:
    if annual_debt_service <= 0:
        return 0
    return noi / annual_debt_service


def compute_gross_yield(gross_annual_revenue: float, purchase_price: float) -> float:
    if purchase_price <= 0:
        return 0
    return (gross_annual_revenue / purchase_price) * 100


def compute_break_even_occupancy(
    avg_nightly_rate: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
) -> float:
    if avg_stay_length_nights <= 0 or avg_nightly_rate <= 0:
        return 0

    nightly_net_factor = 365 * avg_nightly_rate * (1 - platform_fee_pct / 100)
    turn_net_factor = (365 / avg_stay_length_nights) * cleaning_fee_per_stay * (1 - platform_fee_pct / 100)
    a_revenue_per_occ = nightly_net_factor + turn_net_factor

    clean_cost_per_occ = (365 / avg_stay_length_nights) * cleaning_cost_per_turn
    mgmt_per_occ = a_revenue_per_occ * (property_mgmt_pct / 100)
    maint_per_occ = 365 * avg_nightly_rate * (maintenance_reserve_pct / 100)
    capex_per_occ = 365 * avg_nightly_rate * (capex_reserve_pct / 100)
    b_variable_cost_per_occ = clean_cost_per_occ + mgmt_per_occ + maint_per_occ + capex_per_occ

    fixed_total = fixed_opex_annual + total_monthly_housing * 12
    denominator = a_revenue_per_occ - b_variable_cost_per_occ

    if denominator <= 0:
        return 999.0  # Impossible to break even

    return (fixed_total / denominator) * 100


def compute_total_roi_year1(
    annual_cashflow: float,
    year1_equity_buildup: float,
    total_cash_invested: float,
) -> float:
    if total_cash_invested <= 0:
        return 0
    return ((annual_cashflow + year1_equity_buildup) / total_cash_invested) * 100


def compute_all_metrics(
    net_annual_revenue: float,
    total_annual_operating_exp: float,
    monthly_pi: float,
    total_cash_invested: float,
    purchase_price: float,
    gross_annual_revenue: float,
    year1_equity_buildup: float,
    avg_nightly_rate: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
) -> dict:
    noi = compute_noi(net_annual_revenue, total_annual_operating_exp)
    cashflow = compute_cashflow(noi, total_monthly_housing)
    annual_debt_service = monthly_pi * 12

    return {
        "noi": noi,
        "monthly_cashflow": cashflow["monthly_cashflow"],
        "annual_cashflow": cashflow["annual_cashflow"],
        "cash_on_cash_return": compute_cash_on_cash_return(cashflow["annual_cashflow"], total_cash_invested),
        "cap_rate": compute_cap_rate(noi, purchase_price),
        "dscr": compute_dscr(noi, annual_debt_service),
        "gross_yield": compute_gross_yield(gross_annual_revenue, purchase_price),
        "break_even_occupancy": compute_break_even_occupancy(
            avg_nightly_rate=avg_nightly_rate,
            cleaning_fee_per_stay=cleaning_fee_per_stay,
            avg_stay_length_nights=avg_stay_length_nights,
            platform_fee_pct=platform_fee_pct,
            cleaning_cost_per_turn=cleaning_cost_per_turn,
            property_mgmt_pct=property_mgmt_pct,
            maintenance_reserve_pct=maintenance_reserve_pct,
            capex_reserve_pct=capex_reserve_pct,
            fixed_opex_annual=fixed_opex_annual,
            total_monthly_housing=total_monthly_housing,
        ),
        "total_roi_year1": compute_total_roi_year1(cashflow["annual_cashflow"], year1_equity_buildup, total_cash_invested),
    }
```

- [ ] **Step 5: Implement sensitivity module**

`backend/app/services/computation/sensitivity.py`:

```python
from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import compute_noi, compute_cashflow


def _compute_cashflow_for_params(
    avg_nightly_rate: float,
    occupancy_pct: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
) -> float:
    gross = compute_gross_revenue(avg_nightly_rate, occupancy_pct, cleaning_fee_per_stay, avg_stay_length_nights)
    net = compute_net_revenue(gross["total_gross_revenue"], platform_fee_pct)
    expenses = compute_operating_expenses(
        annual_turnovers=gross["annual_turnovers"],
        cleaning_cost_per_turn=cleaning_cost_per_turn,
        net_annual_revenue=net["net_revenue"],
        gross_annual_revenue=gross["total_gross_revenue"],
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        utilities_monthly=0,  # Already in fixed_opex_annual
        supplies_monthly=0,
        lawn_snow_monthly=0,
        other_monthly_expense=0,
        local_str_registration_fee=0,
    )
    variable_opex = expenses["total_annual_operating_exp"]
    total_opex = variable_opex + fixed_opex_annual
    noi = compute_noi(net["net_revenue"], total_opex)
    # total_monthly_housing includes PI + PMI + tax + insurance + HOA
    cf = compute_cashflow(noi, total_monthly_housing)
    return cf["monthly_cashflow"]


def compute_sensitivity(
    avg_nightly_rate: float,
    base_occupancy_pct: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
) -> dict:
    common = dict(
        cleaning_fee_per_stay=cleaning_fee_per_stay,
        avg_stay_length_nights=avg_stay_length_nights,
        platform_fee_pct=platform_fee_pct,
        cleaning_cost_per_turn=cleaning_cost_per_turn,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        fixed_opex_annual=fixed_opex_annual,
        total_monthly_housing=total_monthly_housing,
    )

    # Occupancy sweep: 30% to 100% in 5% increments
    occupancy_sweep = []
    for occ in range(30, 101, 5):
        cf = _compute_cashflow_for_params(
            avg_nightly_rate=avg_nightly_rate,
            occupancy_pct=float(occ),
            **common,
        )
        occupancy_sweep.append({"occupancy_pct": occ, "monthly_cashflow": round(cf, 2)})

    # Rate sweep: -30% to +30% in 5% increments
    rate_sweep = []
    for pct_delta in range(-30, 31, 5):
        adjusted_rate = avg_nightly_rate * (1 + pct_delta / 100)
        cf = _compute_cashflow_for_params(
            avg_nightly_rate=adjusted_rate,
            occupancy_pct=base_occupancy_pct,
            **common,
        )
        rate_sweep.append({"nightly_rate": round(adjusted_rate, 2), "monthly_cashflow": round(cf, 2)})

    return {"occupancy_sweep": occupancy_sweep, "rate_sweep": rate_sweep}
```

- [ ] **Step 6: Run all tests**

```bash
cd backend
pdm run pytest tests/test_metrics.py tests/test_sensitivity.py -v
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/computation/metrics.py backend/app/services/computation/sensitivity.py backend/tests/test_metrics.py backend/tests/test_sensitivity.py
git commit -m "feat: add key metrics and sensitivity analysis with tests

- NOI, cashflow, CoC return, cap rate, DSCR, gross yield
- Break-even occupancy (algebraic solution)
- Year-1 total ROI with equity buildup
- Sensitivity sweeps for occupancy and nightly rate"
```

---

## Task 7: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/property.py`
- Create: `backend/app/schemas/scenario.py`
- Create: `backend/app/schemas/assumptions.py`
- Create: `backend/app/schemas/results.py`

- [ ] **Step 1: Create all schema files**

`backend/app/schemas/__init__.py` — empty.

`backend/app/schemas/property.py`:

```python
from datetime import datetime
from pydantic import BaseModel, Field


class PropertyCreate(BaseModel):
    name: str
    source_url: str | None = None
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    listing_price: float = 0
    estimated_value: float | None = None
    beds: int = 0
    baths: float = 0
    sqft: int = 0
    lot_sqft: int | None = None
    year_built: int | None = None
    property_type: str = "single_family"
    hoa_monthly: float = 0
    annual_taxes: float = 0
    tax_rate: float | None = None
    is_homestead_tax: bool = True
    nonhomestead_annual_taxes: float | None = None
    notes: str = ""


class PropertyUpdate(BaseModel):
    name: str | None = None
    source_url: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    listing_price: float | None = None
    estimated_value: float | None = None
    beds: int | None = None
    baths: float | None = None
    sqft: int | None = None
    lot_sqft: int | None = None
    year_built: int | None = None
    property_type: str | None = None
    hoa_monthly: float | None = None
    annual_taxes: float | None = None
    tax_rate: float | None = None
    is_homestead_tax: bool | None = None
    nonhomestead_annual_taxes: float | None = None
    notes: str | None = None


class PropertySummary(BaseModel):
    id: str
    name: str
    address: str
    city: str
    state: str
    listing_price: float
    beds: int
    baths: float
    sqft: int
    property_type: str
    is_archived: bool
    monthly_cashflow: float | None = None
    cash_on_cash_return: float | None = None

    model_config = {"from_attributes": True}


class PropertyResponse(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    name: str
    source_url: str | None
    address: str
    city: str
    state: str
    zip_code: str
    listing_price: float
    estimated_value: float | None
    beds: int
    baths: float
    sqft: int
    lot_sqft: int | None
    year_built: int | None
    property_type: str
    hoa_monthly: float
    annual_taxes: float
    tax_rate: float | None
    is_homestead_tax: bool
    nonhomestead_annual_taxes: float | None
    notes: str
    is_archived: bool

    model_config = {"from_attributes": True}
```

`backend/app/schemas/scenario.py`:

```python
from pydantic import BaseModel


class ScenarioCreate(BaseModel):
    name: str = "Default Scenario"
    loan_type: str = "conventional"
    purchase_price: float = 0
    down_payment_pct: float = 25.0
    down_payment_amt: float = 0
    interest_rate: float = 7.25
    loan_term_years: int = 30
    closing_cost_pct: float = 3.0
    closing_cost_amt: float = 0
    renovation_cost: float = 0
    furniture_cost: float = 0
    other_upfront_costs: float = 0
    pmi_monthly: float = 0
    is_active: bool = True


class ScenarioUpdate(BaseModel):
    name: str | None = None
    loan_type: str | None = None
    purchase_price: float | None = None
    down_payment_pct: float | None = None
    down_payment_amt: float | None = None
    interest_rate: float | None = None
    loan_term_years: int | None = None
    closing_cost_pct: float | None = None
    closing_cost_amt: float | None = None
    renovation_cost: float | None = None
    furniture_cost: float | None = None
    other_upfront_costs: float | None = None
    pmi_monthly: float | None = None
    is_active: bool | None = None


class ScenarioResponse(BaseModel):
    id: str
    property_id: str
    name: str
    loan_type: str
    purchase_price: float
    down_payment_pct: float
    down_payment_amt: float
    interest_rate: float
    loan_term_years: int
    closing_cost_pct: float
    closing_cost_amt: float
    renovation_cost: float
    furniture_cost: float
    other_upfront_costs: float
    pmi_monthly: float
    is_active: bool

    model_config = {"from_attributes": True}
```

`backend/app/schemas/assumptions.py`:

```python
from pydantic import BaseModel


class AssumptionsUpdate(BaseModel):
    avg_nightly_rate: float | None = None
    occupancy_pct: float | None = None
    cleaning_fee_per_stay: float | None = None
    avg_stay_length_nights: float | None = None
    platform_fee_pct: float | None = None
    cleaning_cost_per_turn: float | None = None
    property_mgmt_pct: float | None = None
    utilities_monthly: float | None = None
    insurance_annual: float | None = None
    maintenance_reserve_pct: float | None = None
    capex_reserve_pct: float | None = None
    supplies_monthly: float | None = None
    lawn_snow_monthly: float | None = None
    other_monthly_expense: float | None = None
    vacancy_reserve_pct: float | None = None
    state_rooms_tax_pct: float | None = None
    str_surcharge_pct: float | None = None
    local_option_tax_pct: float | None = None
    local_str_registration_fee: float | None = None
    platform_remits_tax: bool | None = None


class AssumptionsResponse(BaseModel):
    id: str
    property_id: str
    avg_nightly_rate: float
    occupancy_pct: float
    cleaning_fee_per_stay: float
    avg_stay_length_nights: float
    platform_fee_pct: float
    cleaning_cost_per_turn: float
    property_mgmt_pct: float
    utilities_monthly: float
    insurance_annual: float
    maintenance_reserve_pct: float
    capex_reserve_pct: float
    supplies_monthly: float
    lawn_snow_monthly: float
    other_monthly_expense: float
    vacancy_reserve_pct: float
    state_rooms_tax_pct: float
    str_surcharge_pct: float
    local_option_tax_pct: float
    local_str_registration_fee: float
    platform_remits_tax: bool

    model_config = {"from_attributes": True}
```

`backend/app/schemas/results.py`:

```python
from pydantic import BaseModel


class MortgageResults(BaseModel):
    loan_amount: float
    monthly_pi: float
    monthly_pmi: float
    total_monthly_housing: float
    total_cash_invested: float


class RevenueResults(BaseModel):
    gross_annual: float
    net_annual: float
    annual_turnovers: float


class ExpenseBreakdown(BaseModel):
    annual_cleaning_cost: float
    property_mgmt_cost: float
    maintenance_reserve: float
    capex_reserve: float
    utilities_annual: float
    supplies_annual: float
    lawn_snow_annual: float
    other_annual: float
    registration_annual: float
    insurance_annual: float


class ExpenseResults(BaseModel):
    total_annual_operating: float
    breakdown: ExpenseBreakdown


class MetricsResults(BaseModel):
    monthly_cashflow: float
    annual_cashflow: float
    cash_on_cash_return: float
    cap_rate: float
    noi: float
    break_even_occupancy: float
    dscr: float
    gross_yield: float
    total_roi_year1: float


class ComputedResultsResponse(BaseModel):
    property_id: str
    scenario_id: str
    scenario_name: str
    mortgage: MortgageResults
    revenue: RevenueResults
    expenses: ExpenseResults
    metrics: MetricsResults


class SensitivityResponse(BaseModel):
    occupancy_sweep: list[dict]
    rate_sweep: list[dict]


class AmortizationEntry(BaseModel):
    month: int
    principal: float
    interest: float
    remaining_balance: float


class ComparisonProperty(BaseModel):
    property_id: str
    property_name: str
    address: str
    city: str
    listing_price: float
    beds: int
    baths: float
    sqft: int
    scenario_name: str
    total_cash_invested: float
    monthly_cashflow: float
    annual_cashflow: float
    cash_on_cash_return: float
    cap_rate: float
    noi: float
    break_even_occupancy: float
    dscr: float
    gross_yield: float
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic request/response schemas

- Property CRUD schemas with summary for dashboard
- Scenario and Assumptions schemas
- Computed results, sensitivity, amortization, comparison schemas"
```

---

## Task 8: Backend API — Properties Router

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/properties.py`
- Modify: `backend/app/main.py` (register router)
- Create: `backend/tests/conftest.py` (test DB fixtures)
- Create: `backend/tests/test_api_properties.py`

- [ ] **Step 1: Write failing tests for property CRUD**

`backend/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

`backend/tests/test_api_properties.py`:

```python
class TestCreateProperty:
    def test_create_minimal(self, client):
        resp = client.post("/api/properties", json={"name": "Lake House"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Lake House"
        assert "id" in data

    def test_create_full(self, client):
        resp = client.post("/api/properties", json={
            "name": "Mountain Cabin",
            "address": "123 Mountain Rd",
            "city": "Stowe",
            "state": "VT",
            "zip_code": "05672",
            "listing_price": 425000,
            "beds": 3,
            "baths": 2.5,
            "sqft": 1800,
            "property_type": "single_family",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["listing_price"] == 425000
        assert data["beds"] == 3


class TestListProperties:
    def test_list_empty(self, client):
        resp = client.get("/api/properties")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_properties(self, client):
        client.post("/api/properties", json={"name": "Prop 1"})
        client.post("/api/properties", json={"name": "Prop 2"})
        resp = client.get("/api/properties")
        assert len(resp.json()) == 2

    def test_list_excludes_archived(self, client):
        resp = client.post("/api/properties", json={"name": "Archived"})
        pid = resp.json()["id"]
        client.delete(f"/api/properties/{pid}")
        resp = client.get("/api/properties")
        assert len(resp.json()) == 0


class TestGetProperty:
    def test_get_existing(self, client):
        resp = client.post("/api/properties", json={"name": "Test"})
        pid = resp.json()["id"]
        resp = client.get(f"/api/properties/{pid}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test"

    def test_get_not_found(self, client):
        resp = client.get("/api/properties/nonexistent")
        assert resp.status_code == 404


class TestUpdateProperty:
    def test_update_fields(self, client):
        resp = client.post("/api/properties", json={"name": "Old Name"})
        pid = resp.json()["id"]
        resp = client.put(f"/api/properties/{pid}", json={"name": "New Name", "beds": 4})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"
        assert resp.json()["beds"] == 4


class TestDeleteProperty:
    def test_soft_delete(self, client):
        resp = client.post("/api/properties", json={"name": "To Delete"})
        pid = resp.json()["id"]
        resp = client.delete(f"/api/properties/{pid}")
        assert resp.status_code == 200
        # Should not appear in list
        resp = client.get("/api/properties")
        assert len(resp.json()) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_api_properties.py -v
```

- [ ] **Step 3: Implement properties router**

`backend/app/routers/__init__.py` — empty.

`backend/app/routers/properties.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.schemas.property import (
    PropertyCreate,
    PropertyUpdate,
    PropertyResponse,
    PropertySummary,
)

router = APIRouter(prefix="/api/properties", tags=["properties"])


@router.get("", response_model=list[PropertySummary])
def list_properties(db: Session = Depends(get_db)):
    props = db.query(Property).filter(Property.is_archived == False).all()
    summaries = []
    for prop in props:
        summary = PropertySummary.model_validate(prop)
        # Compute cashflow for active scenario if available
        active_scenario = db.query(MortgageScenario).filter(
            MortgageScenario.property_id == prop.id,
            MortgageScenario.is_active == True,
        ).first()
        assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == prop.id).first()
        if active_scenario and assumptions:
            try:
                from app.routers.compute import _compute_for_scenario
                result = _compute_for_scenario(prop, active_scenario, assumptions)
                summary.monthly_cashflow = result["metrics"].monthly_cashflow
                summary.cash_on_cash_return = result["metrics"].cash_on_cash_return
            except Exception:
                pass
        summaries.append(summary)
    return summaries


@router.post("", response_model=PropertyResponse, status_code=201)
def create_property(data: PropertyCreate, db: Session = Depends(get_db)):
    prop = Property(**data.model_dump())
    db.add(prop)
    # Auto-create default STR assumptions
    assumptions = STRAssumptions(property_id=prop.id)
    db.add(assumptions)
    db.commit()
    db.refresh(prop)
    return prop


@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(property_id: str, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(property_id: str, data: PropertyUpdate, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prop, field, value)
    db.commit()
    db.refresh(prop)
    return prop


@router.delete("/{property_id}")
def delete_property(property_id: str, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    prop.is_archived = True
    db.commit()
    return {"status": "archived"}
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py`:

```python
from app.routers import properties

app.include_router(properties.router)
```

Note: scenarios, assumptions, and compute routers will be registered in Tasks 9 and 10 as they are implemented.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pdm run pytest tests/test_api_properties.py -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/ backend/app/main.py backend/tests/
git commit -m "feat: add properties CRUD API with tests

- List, create, get, update, soft-delete endpoints
- Auto-create default STR assumptions on property creation
- Test fixtures with in-memory SQLite"
```

---

## Task 9: Backend API — Scenarios Router

**Files:**
- Create: `backend/app/routers/scenarios.py`
- Create: `backend/tests/test_api_scenarios.py`
- Modify: `backend/app/main.py` (register router)

- [ ] **Step 1: Write failing tests**

`backend/tests/test_api_scenarios.py`:

```python
import pytest


@pytest.fixture
def property_id(client):
    resp = client.post("/api/properties", json={"name": "Test", "listing_price": 400000})
    return resp.json()["id"]


class TestScenarioCRUD:
    def test_create_scenario(self, client, property_id):
        resp = client.post(f"/api/properties/{property_id}/scenarios", json={
            "name": "30yr Conventional",
            "purchase_price": 400000,
            "down_payment_pct": 25.0,
            "down_payment_amt": 100000,
            "interest_rate": 7.25,
        })
        assert resp.status_code == 201
        assert resp.json()["name"] == "30yr Conventional"

    def test_list_scenarios(self, client, property_id):
        client.post(f"/api/properties/{property_id}/scenarios", json={"name": "S1"})
        client.post(f"/api/properties/{property_id}/scenarios", json={"name": "S2"})
        resp = client.get(f"/api/properties/{property_id}/scenarios")
        assert len(resp.json()) == 2

    def test_update_scenario(self, client, property_id):
        resp = client.post(f"/api/properties/{property_id}/scenarios", json={"name": "Old"})
        sid = resp.json()["id"]
        resp = client.put(f"/api/properties/{property_id}/scenarios/{sid}", json={"name": "New", "interest_rate": 6.5})
        assert resp.json()["name"] == "New"
        assert resp.json()["interest_rate"] == 6.5

    def test_delete_scenario(self, client, property_id):
        resp = client.post(f"/api/properties/{property_id}/scenarios", json={"name": "Del"})
        sid = resp.json()["id"]
        resp = client.delete(f"/api/properties/{property_id}/scenarios/{sid}")
        assert resp.status_code == 200
        resp = client.get(f"/api/properties/{property_id}/scenarios")
        assert len(resp.json()) == 0

    def test_duplicate_scenario(self, client, property_id):
        resp = client.post(f"/api/properties/{property_id}/scenarios", json={
            "name": "Original",
            "purchase_price": 400000,
            "interest_rate": 7.0,
        })
        sid = resp.json()["id"]
        resp = client.post(f"/api/properties/{property_id}/scenarios/{sid}/duplicate")
        assert resp.status_code == 201
        assert resp.json()["name"] == "Original (copy)"
        assert resp.json()["purchase_price"] == 400000

    def test_activate_scenario(self, client, property_id):
        r1 = client.post(f"/api/properties/{property_id}/scenarios", json={"name": "S1", "is_active": True})
        r2 = client.post(f"/api/properties/{property_id}/scenarios", json={"name": "S2", "is_active": False})
        sid2 = r2.json()["id"]
        client.put(f"/api/properties/{property_id}/scenarios/{sid2}/activate")
        scenarios = client.get(f"/api/properties/{property_id}/scenarios").json()
        active = [s for s in scenarios if s["is_active"]]
        assert len(active) == 1
        assert active[0]["id"] == sid2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_api_scenarios.py -v
```

- [ ] **Step 3: Implement scenarios router**

`backend/app/routers/scenarios.py`:

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.scenario import MortgageScenario
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate, ScenarioResponse

router = APIRouter(prefix="/api/properties/{property_id}/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioResponse])
def list_scenarios(property_id: str, db: Session = Depends(get_db)):
    return db.query(MortgageScenario).filter(MortgageScenario.property_id == property_id).all()


@router.post("", response_model=ScenarioResponse, status_code=201)
def create_scenario(property_id: str, data: ScenarioCreate, db: Session = Depends(get_db)):
    scenario = MortgageScenario(property_id=property_id, **data.model_dump())
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.put("/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(property_id: str, scenario_id: str, data: ScenarioUpdate, db: Session = Depends(get_db)):
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(scenario, field, value)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}")
def delete_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(scenario)
    db.commit()
    return {"status": "deleted"}


@router.post("/{scenario_id}/duplicate", response_model=ScenarioResponse, status_code=201)
def duplicate_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    original = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Scenario not found")

    clone = MortgageScenario(
        id=str(uuid.uuid4()),
        property_id=property_id,
        name=f"{original.name} (copy)",
        loan_type=original.loan_type,
        purchase_price=original.purchase_price,
        down_payment_pct=original.down_payment_pct,
        down_payment_amt=original.down_payment_amt,
        interest_rate=original.interest_rate,
        loan_term_years=original.loan_term_years,
        closing_cost_pct=original.closing_cost_pct,
        closing_cost_amt=original.closing_cost_amt,
        renovation_cost=original.renovation_cost,
        furniture_cost=original.furniture_cost,
        other_upfront_costs=original.other_upfront_costs,
        pmi_monthly=original.pmi_monthly,
        is_active=False,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


@router.put("/{scenario_id}/activate", response_model=ScenarioResponse)
def activate_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    # Deactivate all scenarios for this property
    db.query(MortgageScenario).filter(
        MortgageScenario.property_id == property_id
    ).update({"is_active": False})
    # Activate the target
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    scenario.is_active = True
    db.commit()
    db.refresh(scenario)
    return scenario
```

- [ ] **Step 4: Register router and run tests**

Add to `main.py`:

```python
from app.routers import scenarios
app.include_router(scenarios.router)
```

```bash
cd backend
pdm run pytest tests/test_api_scenarios.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/scenarios.py backend/tests/test_api_scenarios.py backend/app/main.py
git commit -m "feat: add mortgage scenarios API with tests

- CRUD, duplicate, activate endpoints
- Only one active scenario per property"
```

---

## Task 10: Backend API — Assumptions & Compute Routers

**Files:**
- Create: `backend/app/routers/assumptions.py`
- Create: `backend/app/routers/compute.py`
- Create: `backend/tests/test_api_assumptions.py`
- Create: `backend/tests/test_api_compute.py`
- Modify: `backend/app/main.py` (register routers)

- [ ] **Step 1: Write failing tests for assumptions**

`backend/tests/test_api_assumptions.py`:

```python
import pytest


@pytest.fixture
def property_id(client):
    resp = client.post("/api/properties", json={"name": "Test", "listing_price": 400000})
    return resp.json()["id"]


class TestAssumptions:
    def test_get_default_assumptions(self, client, property_id):
        resp = client.get(f"/api/properties/{property_id}/assumptions")
        assert resp.status_code == 200
        data = resp.json()
        assert data["occupancy_pct"] == 65.0
        assert data["platform_fee_pct"] == 3.0
        assert data["insurance_annual"] == 2500

    def test_update_assumptions(self, client, property_id):
        resp = client.put(f"/api/properties/{property_id}/assumptions", json={
            "avg_nightly_rate": 250,
            "occupancy_pct": 70.0,
        })
        assert resp.status_code == 200
        assert resp.json()["avg_nightly_rate"] == 250
        assert resp.json()["occupancy_pct"] == 70.0
```

- [ ] **Step 2: Write failing tests for compute**

`backend/tests/test_api_compute.py`:

```python
import pytest


@pytest.fixture
def setup_property(client):
    """Create a property with scenario and assumptions for computation tests."""
    resp = client.post("/api/properties", json={
        "name": "Test Property",
        "listing_price": 425000,
        "annual_taxes": 6000,
        "hoa_monthly": 0,
    })
    pid = resp.json()["id"]

    client.post(f"/api/properties/{pid}/scenarios", json={
        "name": "30yr Conv",
        "purchase_price": 425000,
        "down_payment_pct": 25.0,
        "down_payment_amt": 106250,
        "interest_rate": 7.25,
        "loan_term_years": 30,
        "closing_cost_pct": 3.0,
        "closing_cost_amt": 12750,
        "is_active": True,
    })

    client.put(f"/api/properties/{pid}/assumptions", json={
        "avg_nightly_rate": 200,
        "occupancy_pct": 65.0,
        "cleaning_fee_per_stay": 150,
        "avg_stay_length_nights": 3.0,
        "cleaning_cost_per_turn": 120,
        "insurance_annual": 2500,
    })
    return pid


class TestComputeResults:
    def test_get_results(self, client, setup_property):
        resp = client.get(f"/api/properties/{setup_property}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert "mortgage" in data
        assert "revenue" in data
        assert "expenses" in data
        assert "metrics" in data
        assert data["metrics"]["noi"] > 0

    def test_results_for_specific_scenario(self, client, setup_property):
        scenarios = client.get(f"/api/properties/{setup_property}/scenarios").json()
        sid = scenarios[0]["id"]
        resp = client.get(f"/api/properties/{setup_property}/results/{sid}")
        assert resp.status_code == 200


class TestAmortization:
    def test_get_amortization(self, client, setup_property):
        scenarios = client.get(f"/api/properties/{setup_property}/scenarios").json()
        sid = scenarios[0]["id"]
        resp = client.get(f"/api/properties/{setup_property}/amortization/{sid}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 360


class TestSensitivity:
    def test_get_sensitivity(self, client, setup_property):
        resp = client.get(f"/api/properties/{setup_property}/sensitivity")
        assert resp.status_code == 200
        data = resp.json()
        assert "occupancy_sweep" in data
        assert "rate_sweep" in data


class TestComparison:
    def test_compare_properties(self, client):
        p1 = client.post("/api/properties", json={"name": "P1", "listing_price": 400000, "annual_taxes": 5000}).json()["id"]
        p2 = client.post("/api/properties", json={"name": "P2", "listing_price": 300000, "annual_taxes": 4000}).json()["id"]

        # Add scenarios
        for pid, price in [(p1, 400000), (p2, 300000)]:
            client.post(f"/api/properties/{pid}/scenarios", json={
                "name": "Default",
                "purchase_price": price,
                "down_payment_pct": 25.0,
                "down_payment_amt": price * 0.25,
                "interest_rate": 7.0,
            })
            client.put(f"/api/properties/{pid}/assumptions", json={
                "avg_nightly_rate": 200,
                "occupancy_pct": 65.0,
            })

        resp = client.get(f"/api/compare?ids={p1},{p2}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_api_assumptions.py tests/test_api_compute.py -v
```

- [ ] **Step 4: Implement assumptions router**

`backend/app/routers/assumptions.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assumptions import STRAssumptions
from app.schemas.assumptions import AssumptionsUpdate, AssumptionsResponse

router = APIRouter(prefix="/api/properties/{property_id}/assumptions", tags=["assumptions"])


@router.get("", response_model=AssumptionsResponse)
def get_assumptions(property_id: str, db: Session = Depends(get_db)):
    assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == property_id).first()
    if not assumptions:
        raise HTTPException(status_code=404, detail="Assumptions not found")
    return assumptions


@router.put("", response_model=AssumptionsResponse)
def update_assumptions(property_id: str, data: AssumptionsUpdate, db: Session = Depends(get_db)):
    assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == property_id).first()
    if not assumptions:
        raise HTTPException(status_code=404, detail="Assumptions not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(assumptions, field, value)
    db.commit()
    db.refresh(assumptions)
    return assumptions
```

- [ ] **Step 5: Implement compute router**

`backend/app/routers/compute.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.schemas.results import (
    ComputedResultsResponse,
    MortgageResults,
    RevenueResults,
    ExpenseResults,
    ExpenseBreakdown,
    MetricsResults,
    AmortizationEntry,
    SensitivityResponse,
    ComparisonProperty,
)
from app.services.computation.mortgage import (
    compute_loan_amount,
    compute_monthly_pi,
    compute_pmi,
    compute_total_monthly_housing,
    compute_total_cash_invested,
    compute_amortization_schedule,
)
from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import compute_all_metrics
from app.services.computation.sensitivity import compute_sensitivity

router = APIRouter(tags=["compute"])


def _compute_for_scenario(prop: Property, scenario: MortgageScenario, assumptions: STRAssumptions) -> dict:
    # Mortgage
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    monthly_pmi = compute_pmi(
        loan_amount, scenario.loan_type, float(scenario.down_payment_pct),
        pmi_override=float(scenario.pmi_monthly) if scenario.pmi_monthly else None,
    )
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi, monthly_pmi, float(prop.annual_taxes),
        float(assumptions.insurance_annual), float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes) if prop.nonhomestead_annual_taxes else None,
    )
    total_cash = compute_total_cash_invested(
        float(scenario.down_payment_amt), float(scenario.closing_cost_amt),
        float(scenario.renovation_cost), float(scenario.furniture_cost),
        float(scenario.other_upfront_costs),
    )

    # Revenue
    gross = compute_gross_revenue(
        float(assumptions.avg_nightly_rate), float(assumptions.occupancy_pct),
        float(assumptions.cleaning_fee_per_stay), float(assumptions.avg_stay_length_nights),
    )
    net = compute_net_revenue(gross["total_gross_revenue"], float(assumptions.platform_fee_pct))

    # Expenses
    expenses = compute_operating_expenses(
        annual_turnovers=gross["annual_turnovers"],
        cleaning_cost_per_turn=float(assumptions.cleaning_cost_per_turn),
        net_annual_revenue=net["net_revenue"],
        gross_annual_revenue=gross["total_gross_revenue"],
        property_mgmt_pct=float(assumptions.property_mgmt_pct),
        maintenance_reserve_pct=float(assumptions.maintenance_reserve_pct),
        capex_reserve_pct=float(assumptions.capex_reserve_pct),
        utilities_monthly=float(assumptions.utilities_monthly),
        supplies_monthly=float(assumptions.supplies_monthly),
        lawn_snow_monthly=float(assumptions.lawn_snow_monthly),
        other_monthly_expense=float(assumptions.other_monthly_expense),
        local_str_registration_fee=float(assumptions.local_str_registration_fee),
    )

    total_opex = expenses["total_annual_operating_exp"]

    # Fixed opex for break-even calc (does NOT include insurance — that's in total_monthly_housing)
    fixed_opex = (
        float(assumptions.utilities_monthly) * 12
        + float(assumptions.supplies_monthly) * 12
        + float(assumptions.lawn_snow_monthly) * 12
        + float(assumptions.other_monthly_expense) * 12
        + float(assumptions.local_str_registration_fee)
    )

    # Year-1 equity
    schedule = compute_amortization_schedule(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    year1_equity = sum(m["principal"] for m in schedule[:12]) if schedule else 0

    # Metrics
    metrics = compute_all_metrics(
        net_annual_revenue=net["net_revenue"],
        total_annual_operating_exp=total_opex,
        monthly_pi=monthly_pi,
        total_cash_invested=total_cash,
        purchase_price=float(scenario.purchase_price),
        gross_annual_revenue=gross["total_gross_revenue"],
        year1_equity_buildup=year1_equity,
        avg_nightly_rate=float(assumptions.avg_nightly_rate),
        cleaning_fee_per_stay=float(assumptions.cleaning_fee_per_stay),
        avg_stay_length_nights=float(assumptions.avg_stay_length_nights),
        platform_fee_pct=float(assumptions.platform_fee_pct),
        cleaning_cost_per_turn=float(assumptions.cleaning_cost_per_turn),
        property_mgmt_pct=float(assumptions.property_mgmt_pct),
        maintenance_reserve_pct=float(assumptions.maintenance_reserve_pct),
        capex_reserve_pct=float(assumptions.capex_reserve_pct),
        fixed_opex_annual=fixed_opex,
        total_monthly_housing=total_monthly_housing,
    )

    return {
        "property_id": prop.id,
        "scenario_id": scenario.id,
        "scenario_name": scenario.name,
        "mortgage": MortgageResults(
            loan_amount=round(loan_amount, 2),
            monthly_pi=round(monthly_pi, 2),
            monthly_pmi=round(monthly_pmi, 2),
            total_monthly_housing=round(total_monthly_housing, 2),
            total_cash_invested=round(total_cash, 2),
        ),
        "revenue": RevenueResults(
            gross_annual=round(gross["total_gross_revenue"], 2),
            net_annual=round(net["net_revenue"], 2),
            annual_turnovers=round(gross["annual_turnovers"], 2),
        ),
        "expenses": ExpenseResults(
            total_annual_operating=round(total_opex, 2),
            breakdown=ExpenseBreakdown(
                annual_cleaning_cost=round(expenses["annual_cleaning_cost"], 2),
                property_mgmt_cost=round(expenses["property_mgmt_cost"], 2),
                maintenance_reserve=round(expenses["maintenance_reserve"], 2),
                capex_reserve=round(expenses["capex_reserve"], 2),
                utilities_annual=round(expenses["utilities_annual"], 2),
                supplies_annual=round(expenses["supplies_annual"], 2),
                lawn_snow_annual=round(expenses["lawn_snow_annual"], 2),
                other_annual=round(expenses["other_annual"], 2),
                registration_annual=round(expenses["registration_annual"], 2),
                insurance_annual=float(assumptions.insurance_annual),
            ),
        ),
        "metrics": MetricsResults(
            monthly_cashflow=round(metrics["monthly_cashflow"], 2),
            annual_cashflow=round(metrics["annual_cashflow"], 2),
            cash_on_cash_return=round(metrics["cash_on_cash_return"], 2),
            cap_rate=round(metrics["cap_rate"], 2),
            noi=round(metrics["noi"], 2),
            break_even_occupancy=round(metrics["break_even_occupancy"], 2),
            dscr=round(metrics["dscr"], 2),
            gross_yield=round(metrics["gross_yield"], 2),
            total_roi_year1=round(metrics["total_roi_year1"], 2),
        ),
    }


def _get_prop_scenario_assumptions(property_id: str, scenario_id: str | None, db: Session):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if scenario_id:
        scenario = db.query(MortgageScenario).filter(
            MortgageScenario.id == scenario_id,
            MortgageScenario.property_id == property_id,
        ).first()
    else:
        scenario = db.query(MortgageScenario).filter(
            MortgageScenario.property_id == property_id,
            MortgageScenario.is_active == True,
        ).first()

    if not scenario:
        raise HTTPException(status_code=404, detail="No scenario found")

    assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == property_id).first()
    if not assumptions:
        raise HTTPException(status_code=404, detail="Assumptions not found")

    return prop, scenario, assumptions


@router.get("/api/properties/{property_id}/results", response_model=ComputedResultsResponse)
def get_results(property_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, None, db)
    return _compute_for_scenario(prop, scenario, assumptions)


@router.get("/api/properties/{property_id}/results/{scenario_id}", response_model=ComputedResultsResponse)
def get_results_for_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, scenario_id, db)
    return _compute_for_scenario(prop, scenario, assumptions)


@router.get("/api/properties/{property_id}/amortization/{scenario_id}", response_model=list[AmortizationEntry])
def get_amortization(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    return compute_amortization_schedule(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)


@router.get("/api/properties/{property_id}/sensitivity", response_model=SensitivityResponse)
def get_sensitivity(property_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, None, db)
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    monthly_pmi = compute_pmi(loan_amount, scenario.loan_type, float(scenario.down_payment_pct), None)
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi, monthly_pmi, float(prop.annual_taxes),
        float(assumptions.insurance_annual), float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes) if prop.nonhomestead_annual_taxes else None,
    )
    fixed_opex = (
        float(assumptions.utilities_monthly) * 12
        + float(assumptions.supplies_monthly) * 12
        + float(assumptions.lawn_snow_monthly) * 12
        + float(assumptions.other_monthly_expense) * 12
        + float(assumptions.local_str_registration_fee)
    )
    # Note: insurance is NOT in fixed_opex — it's part of total_monthly_housing

    return compute_sensitivity(
        avg_nightly_rate=float(assumptions.avg_nightly_rate),
        base_occupancy_pct=float(assumptions.occupancy_pct),
        cleaning_fee_per_stay=float(assumptions.cleaning_fee_per_stay),
        avg_stay_length_nights=float(assumptions.avg_stay_length_nights),
        platform_fee_pct=float(assumptions.platform_fee_pct),
        cleaning_cost_per_turn=float(assumptions.cleaning_cost_per_turn),
        property_mgmt_pct=float(assumptions.property_mgmt_pct),
        maintenance_reserve_pct=float(assumptions.maintenance_reserve_pct),
        capex_reserve_pct=float(assumptions.capex_reserve_pct),
        fixed_opex_annual=fixed_opex,
        total_monthly_housing=total_monthly_housing,
    )


@router.get("/api/compare", response_model=list[ComparisonProperty])
def compare_properties(ids: str = Query(...), db: Session = Depends(get_db)):
    property_ids = [i.strip() for i in ids.split(",")]
    results = []
    for pid in property_ids:
        try:
            prop, scenario, assumptions = _get_prop_scenario_assumptions(pid, None, db)
            computed = _compute_for_scenario(prop, scenario, assumptions)
            results.append(ComparisonProperty(
                property_id=prop.id,
                property_name=prop.name,
                address=prop.address,
                city=prop.city,
                listing_price=float(prop.listing_price),
                beds=prop.beds,
                baths=prop.baths,
                sqft=prop.sqft,
                scenario_name=scenario.name,
                total_cash_invested=computed["mortgage"].total_cash_invested,
                monthly_cashflow=computed["metrics"].monthly_cashflow,
                annual_cashflow=computed["metrics"].annual_cashflow,
                cash_on_cash_return=computed["metrics"].cash_on_cash_return,
                cap_rate=computed["metrics"].cap_rate,
                noi=computed["metrics"].noi,
                break_even_occupancy=computed["metrics"].break_even_occupancy,
                dscr=computed["metrics"].dscr,
                gross_yield=computed["metrics"].gross_yield,
            ))
        except HTTPException:
            continue
    return results
```

- [ ] **Step 6: Register routers and run tests**

Update `backend/app/main.py` to include all routers:

```python
from app.routers import properties, scenarios, assumptions, compute

app.include_router(properties.router)
app.include_router(scenarios.router)
app.include_router(assumptions.router)
app.include_router(compute.router)
```

```bash
cd backend
pdm run pytest tests/ -v
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add assumptions and compute API routers with tests

- Assumptions GET/PUT with defaults
- Results computation endpoint (active or specific scenario)
- Amortization schedule endpoint
- Sensitivity analysis endpoint
- Property comparison endpoint"
```

---

## Task 11: Frontend — TypeScript Types & API Client

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create TypeScript interfaces**

`frontend/src/types/index.ts`:

```typescript
export interface PropertySummary {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  listing_price: number;
  beds: number;
  baths: number;
  sqft: number;
  property_type: string;
  is_archived: boolean;
  monthly_cashflow: number | null;
  cash_on_cash_return: number | null;
}

export interface Property {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  source_url: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  listing_price: number;
  estimated_value: number | null;
  beds: number;
  baths: number;
  sqft: number;
  lot_sqft: number | null;
  year_built: number | null;
  property_type: string;
  hoa_monthly: number;
  annual_taxes: number;
  tax_rate: number | null;
  is_homestead_tax: boolean;
  nonhomestead_annual_taxes: number | null;
  notes: string;
  is_archived: boolean;
}

export interface MortgageScenario {
  id: string;
  property_id: string;
  name: string;
  loan_type: string;
  purchase_price: number;
  down_payment_pct: number;
  down_payment_amt: number;
  interest_rate: number;
  loan_term_years: number;
  closing_cost_pct: number;
  closing_cost_amt: number;
  renovation_cost: number;
  furniture_cost: number;
  other_upfront_costs: number;
  pmi_monthly: number;
  is_active: boolean;
}

export interface STRAssumptions {
  id: string;
  property_id: string;
  avg_nightly_rate: number;
  occupancy_pct: number;
  cleaning_fee_per_stay: number;
  avg_stay_length_nights: number;
  platform_fee_pct: number;
  cleaning_cost_per_turn: number;
  property_mgmt_pct: number;
  utilities_monthly: number;
  insurance_annual: number;
  maintenance_reserve_pct: number;
  capex_reserve_pct: number;
  supplies_monthly: number;
  lawn_snow_monthly: number;
  other_monthly_expense: number;
  vacancy_reserve_pct: number;
  state_rooms_tax_pct: number;
  str_surcharge_pct: number;
  local_option_tax_pct: number;
  local_str_registration_fee: number;
  platform_remits_tax: boolean;
}

export interface ComputedResults {
  property_id: string;
  scenario_id: string;
  scenario_name: string;
  mortgage: {
    loan_amount: number;
    monthly_pi: number;
    monthly_pmi: number;
    total_monthly_housing: number;
    total_cash_invested: number;
  };
  revenue: {
    gross_annual: number;
    net_annual: number;
    annual_turnovers: number;
  };
  expenses: {
    total_annual_operating: number;
    breakdown: Record<string, number>;
  };
  metrics: {
    monthly_cashflow: number;
    annual_cashflow: number;
    cash_on_cash_return: number;
    cap_rate: number;
    noi: number;
    break_even_occupancy: number;
    dscr: number;
    gross_yield: number;
    total_roi_year1: number;
  };
}

export interface SensitivityData {
  occupancy_sweep: Array<{ occupancy_pct: number; monthly_cashflow: number }>;
  rate_sweep: Array<{ nightly_rate: number; monthly_cashflow: number }>;
}

export interface AmortizationEntry {
  month: number;
  principal: number;
  interest: number;
  remaining_balance: number;
}

export interface ComparisonProperty {
  property_id: string;
  property_name: string;
  address: string;
  city: string;
  listing_price: number;
  beds: number;
  baths: number;
  sqft: number;
  scenario_name: string;
  total_cash_invested: number;
  monthly_cashflow: number;
  annual_cashflow: number;
  cash_on_cash_return: number;
  cap_rate: number;
  noi: number;
  break_even_occupancy: number;
  dscr: number;
  gross_yield: number;
}
```

- [ ] **Step 2: Create API client**

`frontend/src/api/client.ts`:

```typescript
import axios from "axios";
import type {
  Property,
  PropertySummary,
  MortgageScenario,
  STRAssumptions,
  ComputedResults,
  SensitivityData,
  AmortizationEntry,
  ComparisonProperty,
} from "../types";

const api = axios.create({ baseURL: "/api" });

// Properties
export const listProperties = () => api.get<PropertySummary[]>("/properties").then((r) => r.data);
export const getProperty = (id: string) => api.get<Property>(`/properties/${id}`).then((r) => r.data);
export const createProperty = (data: Partial<Property>) => api.post<Property>("/properties", data).then((r) => r.data);
export const updateProperty = (id: string, data: Partial<Property>) => api.put<Property>(`/properties/${id}`, data).then((r) => r.data);
export const deleteProperty = (id: string) => api.delete(`/properties/${id}`);

// Scenarios
export const listScenarios = (propertyId: string) => api.get<MortgageScenario[]>(`/properties/${propertyId}/scenarios`).then((r) => r.data);
export const createScenario = (propertyId: string, data: Partial<MortgageScenario>) => api.post<MortgageScenario>(`/properties/${propertyId}/scenarios`, data).then((r) => r.data);
export const updateScenario = (propertyId: string, scenarioId: string, data: Partial<MortgageScenario>) => api.put<MortgageScenario>(`/properties/${propertyId}/scenarios/${scenarioId}`, data).then((r) => r.data);
export const deleteScenario = (propertyId: string, scenarioId: string) => api.delete(`/properties/${propertyId}/scenarios/${scenarioId}`);
export const duplicateScenario = (propertyId: string, scenarioId: string) => api.post<MortgageScenario>(`/properties/${propertyId}/scenarios/${scenarioId}/duplicate`).then((r) => r.data);
export const activateScenario = (propertyId: string, scenarioId: string) => api.put<MortgageScenario>(`/properties/${propertyId}/scenarios/${scenarioId}/activate`).then((r) => r.data);

// Assumptions
export const getAssumptions = (propertyId: string) => api.get<STRAssumptions>(`/properties/${propertyId}/assumptions`).then((r) => r.data);
export const updateAssumptions = (propertyId: string, data: Partial<STRAssumptions>) => api.put<STRAssumptions>(`/properties/${propertyId}/assumptions`, data).then((r) => r.data);

// Compute
export const getResults = (propertyId: string) => api.get<ComputedResults>(`/properties/${propertyId}/results`).then((r) => r.data);
export const getResultsForScenario = (propertyId: string, scenarioId: string) => api.get<ComputedResults>(`/properties/${propertyId}/results/${scenarioId}`).then((r) => r.data);
export const getAmortization = (propertyId: string, scenarioId: string) => api.get<AmortizationEntry[]>(`/properties/${propertyId}/amortization/${scenarioId}`).then((r) => r.data);
export const getSensitivity = (propertyId: string) => api.get<SensitivityData>(`/properties/${propertyId}/sensitivity`).then((r) => r.data);
export const compareProperties = (ids: string[]) => api.get<ComparisonProperty[]>(`/compare?ids=${ids.join(",")}`).then((r) => r.data);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/ frontend/src/api/
git commit -m "feat: add TypeScript types and API client

- All interfaces matching backend Pydantic schemas
- Axios-based API client with typed methods"
```

---

## Task 12: Frontend — Shared Components

**Files:**
- Create: `frontend/src/components/shared/MetricCard.tsx`
- Create: `frontend/src/components/shared/CurrencyInput.tsx`
- Create: `frontend/src/components/shared/PercentInput.tsx`
- Create: `frontend/src/components/shared/TooltipIcon.tsx`
- Create: `frontend/src/components/shared/ConfirmDialog.tsx`

- [ ] **Step 1: Create shared components**

`frontend/src/components/shared/MetricCard.tsx`:

```tsx
interface MetricCardProps {
  label: string;
  value: string;
  tooltip?: string;
  variant?: "positive" | "negative" | "neutral";
  large?: boolean;
}

export function MetricCard({ label, value, tooltip, variant = "neutral", large }: MetricCardProps) {
  const colorMap = {
    positive: "text-green-600",
    negative: "text-red-600",
    neutral: "text-gray-900",
  };

  return (
    <div className={`bg-white rounded-lg border p-4 ${large ? "col-span-2" : ""}`}>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`${large ? "text-2xl" : "text-lg"} font-semibold ${colorMap[variant]}`}>
        {value}
      </div>
    </div>
  );
}
```

`frontend/src/components/shared/CurrencyInput.tsx`:

```tsx
import { useCallback } from "react";
import { TooltipIcon } from "./TooltipIcon";

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
}

export function CurrencyInput({ label, value, onChange, tooltip, className = "" }: CurrencyInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {tooltip && <TooltipIcon text={tooltip} />}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
        <input
          type="number"
          value={value || ""}
          onChange={handleChange}
          className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}
```

`frontend/src/components/shared/PercentInput.tsx`:

```tsx
import { useCallback } from "react";
import { TooltipIcon } from "./TooltipIcon";

interface PercentInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
}

export function PercentInput({ label, value, onChange, tooltip, className = "" }: PercentInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {tooltip && <TooltipIcon text={tooltip} />}
      </label>
      <div className="relative">
        <input
          type="number"
          step="0.1"
          value={value || ""}
          onChange={handleChange}
          className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
      </div>
    </div>
  );
}
```

`frontend/src/components/shared/TooltipIcon.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";

interface TooltipIconProps {
  text: string;
}

export function TooltipIcon({ text }: TooltipIconProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [show]);

  return (
    <span className="relative inline-block ml-1" ref={ref}>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 text-xs"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        &#9432;
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
          {text}
        </div>
      )}
    </span>
  );
}
```

`frontend/src/components/shared/ConfirmDialog.tsx`:

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Confirm</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/shared/
git commit -m "feat: add shared UI components

- MetricCard, CurrencyInput, PercentInput
- TooltipIcon with hover/click support
- ConfirmDialog modal"
```

---

## Task 13: Frontend — Dashboard Page

**Files:**
- Create: `frontend/src/components/Dashboard/PropertyCard.tsx`
- Create: `frontend/src/components/Dashboard/Dashboard.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx` (add routes)

- [ ] **Step 1: Create Dashboard components and page**

Implement `PropertyCard.tsx` showing name, address, price, bed/bath, cashflow, CoC return with color-coded border (green/red/yellow). Include checkbox for comparison selection, View and Delete buttons.

Implement `Dashboard.tsx` with grid layout of property cards, "+ New Property" button (opens a modal or navigates to create), and "Compare Selected" button. Fetches properties via `listProperties()`.

Implement `DashboardPage.tsx` as thin wrapper rendering `<Dashboard />`.

Update `App.tsx` routes:
```tsx
<Route path="/" element={<DashboardPage />} />
<Route path="/property/:id" element={<PropertyPage />} />
<Route path="/compare" element={<ComparePage />} />
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/
git commit -m "feat: add dashboard page with property cards

- Property card grid with key metrics
- Color-coded by cashflow (green/red/yellow)
- New property creation and comparison selection"
```

---

## Task 14: Frontend — Property Detail Page (Tabs 1-2)

**Files:**
- Create: `frontend/src/components/PropertyDetail/PropertyDetail.tsx`
- Create: `frontend/src/components/PropertyDetail/PropertyInfoTab.tsx`
- Create: `frontend/src/components/PropertyDetail/FinancingTab.tsx`
- Create: `frontend/src/components/PropertyDetail/ScenarioCard.tsx`
- Create: `frontend/src/hooks/useProperty.ts`
- Create: `frontend/src/hooks/useScenarios.ts`
- Create: `frontend/src/pages/PropertyPage.tsx`

- [ ] **Step 1: Create hooks**

`useProperty.ts`: Fetch property by ID, provide update function that PUTs changes and refreshes.

`useScenarios.ts`: Fetch scenarios for property, provide create/update/delete/duplicate/activate functions.

- [ ] **Step 2: Create PropertyInfoTab**

Editable form with all Property fields grouped into: Location, Details, Financials, Notes. Each field uses CurrencyInput/PercentInput/text input as appropriate, with tooltips from spec section 11. Include non-homestead tax warning banner when `is_homestead_tax` is true.

- [ ] **Step 3: Create FinancingTab with ScenarioCard**

`ScenarioCard.tsx`: Expandable card for a scenario. Loan type selector, linked purchase price / down payment % / $ fields, interest rate, term, closing costs, one-time costs, PMI. Shows computed summary (loan amount, monthly P&I, total cash to close). Star icon to activate.

`FinancingTab.tsx`: List of scenario cards with add/delete/duplicate buttons.

- [ ] **Step 4: Create PropertyDetail and PropertyPage**

`PropertyDetail.tsx`: Tab navigation (Property Info, Financing, Revenue & Expenses, Results). Renders the active tab component.

`PropertyPage.tsx`: Uses `useParams()` to get ID, renders `<PropertyDetail />`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add property detail page with info and financing tabs

- Editable property info with tooltip icons
- Non-homestead tax warning
- Mortgage scenario cards with add/edit/delete/duplicate/activate"
```

---

## Task 15: Frontend — Property Detail Page (Tabs 3-4)

**Files:**
- Create: `frontend/src/components/PropertyDetail/RevenueExpensesTab.tsx`
- Create: `frontend/src/components/PropertyDetail/ResultsTab.tsx`
- Create: `frontend/src/hooks/useAssumptions.ts`

- [ ] **Step 1: Create useAssumptions hook**

Fetch assumptions for property, provide update function.

- [ ] **Step 2: Create RevenueExpensesTab**

Two-column layout. Left: Revenue inputs (nightly rate, occupancy %, cleaning fee, avg stay length). Right: Expense inputs grouped per spec section 6.2. Each field with tooltip from spec section 11. Sensible defaults shown.

- [ ] **Step 3: Create ResultsTab**

Scenario selector dropdown at top. Metric cards row (monthly cashflow large + prominent, then annual cashflow, CoC, cap rate, NOI, break-even occupancy, DSCR, gross yield, year-1 ROI). Each metric card color-coded. Revenue waterfall. Expense breakdown table. Sensitivity sliders (occupancy 30-100%, nightly rate +/-30%) showing cashflow chart — use a simple SVG line chart or plain table. Collapsible amortization table (first 60 months).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add revenue/expenses and results tabs

- Revenue and expense input forms with tooltips
- Results dashboard with all key metrics
- Sensitivity analysis with occupancy and rate sweeps
- Amortization table (first 5 years)"
```

---

## Task 16: Frontend — Comparison View

**Files:**
- Create: `frontend/src/components/Comparison/ComparisonView.tsx`
- Create: `frontend/src/pages/ComparePage.tsx`

- [ ] **Step 1: Create ComparisonView**

Side-by-side table (spec section 6.3). Receives property IDs via URL search params. Calls `compareProperties()` API. Rows: Price, Beds/Baths, Sqft, Cash Invested, Monthly CF, Annual CF, CoC Return, Cap Rate, NOI, Break-Even, DSCR. Best-in-class values highlighted per row. Back button to dashboard.

- [ ] **Step 2: Create ComparePage**

Reads `?ids=a,b,c` from URL, passes to `<ComparisonView />`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: add property comparison view

- Side-by-side metrics table for 2-4 properties
- Best-in-class highlighting per metric row"
```

---

## Task 17: Integration Testing & Docker Verification

**Files:**
- No new files — run existing tests and verify Docker builds

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend
pdm run pytest tests/ -v --tb=short
```

All tests must pass.

- [ ] **Step 2: Rebuild and test Docker**

```bash
docker compose build
docker compose up -d
# Wait for services
sleep 5
curl http://localhost:8000/api/health
curl http://localhost:3000
# Create a test property via API
curl -X POST http://localhost:8000/api/properties -H "Content-Type: application/json" -d '{"name":"Test","listing_price":400000}'
docker compose down
```

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from Docker testing"
```

---

## Summary

| Task | Component | Key Deliverable |
|------|-----------|----------------|
| 1 | Scaffolding | PDM + Vite + Docker Compose working |
| 2 | Database | ORM models + Alembic migrations |
| 3 | Computation | Mortgage math (TDD) |
| 4 | Computation | Revenue math (TDD) |
| 5 | Computation | Expense math (TDD) |
| 6 | Computation | Key metrics + sensitivity (TDD) |
| 7 | Schemas | Pydantic request/response models |
| 8 | API | Properties CRUD (TDD) |
| 9 | API | Scenarios CRUD (TDD) |
| 10 | API | Assumptions + Compute endpoints (TDD) |
| 11 | Frontend | Types + API client |
| 12 | Frontend | Shared components |
| 13 | Frontend | Dashboard page |
| 14 | Frontend | Property detail (info + financing) |
| 15 | Frontend | Property detail (revenue + results) |
| 16 | Frontend | Comparison view |
| 17 | Integration | Full test suite + Docker verification |
