# Frontend — STR Profitability Calculator

React SPA for managing properties, configuring mortgage scenarios and STR assumptions, and viewing computed financial metrics.

## Setup

Requires Node.js 20+.

```bash
npm install     # Install dependencies
npm run dev     # Start dev server on :3000
```

The Vite dev server proxies `/api` requests to `http://localhost:8000` (the backend).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
frontend/src/
├── main.tsx                 # Entry point (React 19 createRoot)
├── App.tsx                  # Router + top-level layout
├── index.css                # Global styles (Tailwind)
├── api/
│   └── client.ts            # Axios API client (all backend calls)
├── types/
│   └── index.ts             # TypeScript interfaces matching backend schemas
├── pages/
│   ├── DashboardPage.tsx    # Property list view
│   ├── PropertyPage.tsx     # Single property detail view
│   └── ComparePage.tsx      # Side-by-side property comparison
├── components/
│   ├── Dashboard/
│   │   ├── Dashboard.tsx    # Property grid + Redfin scrape form
│   │   └── PropertyCard.tsx # Summary card with key metrics
│   ├── PropertyDetail/
│   │   ├── PropertyDetail.tsx      # Tab container + scenario selector
│   │   ├── PropertyInfoTab.tsx     # Property details (address, beds, baths, taxes)
│   │   ├── FinancingTab.tsx        # Mortgage scenario editing
│   │   ├── RevenueExpensesTab.tsx  # STR assumptions editing
│   │   ├── ResultsTab.tsx          # Metrics, amortization, sensitivity charts
│   │   └── ScenarioCard.tsx        # Scenario activate/duplicate/delete
│   ├── Comparison/
│   │   └── ComparisonView.tsx      # Comparison table
│   └── shared/
│       ├── MetricCard.tsx          # Metric display (positive/negative/neutral)
│       ├── CurrencyInput.tsx       # Formatted dollar input
│       ├── PercentInput.tsx        # Percentage input
│       ├── TooltipIcon.tsx         # Help tooltip
│       └── ConfirmDialog.tsx       # Destructive action confirmation
└── hooks/
    ├── useProperty.ts       # Fetch + manage property state
    ├── useScenarios.ts      # Fetch + manage scenarios
    └── useAssumptions.ts    # Fetch + manage assumptions
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | DashboardPage | Property list with cards and Redfin scrape form |
| `/property/:id` | PropertyPage | Property detail with tabbed interface |
| `/compare` | ComparePage | Side-by-side comparison of selected properties |

## Tech Stack

- **React 19** with TypeScript 5.9
- **React Router v7** for client-side routing
- **Tailwind CSS 4.2** for styling
- **Axios** for HTTP requests
- **Vite 8** for dev server and bundling

## Production Build

The Dockerfile uses a multi-stage build: Node builds the app, then Nginx serves the static files and proxies `/api` to the backend container.

```bash
docker build -t str-frontend .
docker run -p 3000:3000 str-frontend
```
