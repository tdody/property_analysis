# Modernization progress

Track PR status here. Claude Code reads this at the start of every session to know what's done and what's next. Update it when merging each PR.

Status: `todo` · `in-progress` · `review` · `done`

---

## Phase 2 — Base modernization (from `README.md`)

| # | PR | Status | Branch / PR link | Notes |
|---|---|---|---|---|
| 1 | Design tokens + font loading | todo | — | CSS variables, Google Fonts, no component changes |
| 2 | Shared primitives | todo | — | `PageHeader`, `Card`, `MetricCell`, `Button`, `Tabs` |
| 3 | Dashboard view | todo | — | Property list cards using new primitives |
| 4 | Property Info view | todo | — | Two-column form + preview |
| 5 | Financing view | todo | — | Amortization chart + term selector |
| 6 | Results view | todo | — | Metric strip + 10-year projection + expense breakdown |
| 7 | Glossary & Settings | todo | — | The quieter views |
| 8 | Polish pass | todo | — | Hover/focus, empty states, skeletons, a11y audit |

## Phase 3 — Refinements (from `Font & Chart Proposals.html`)

| # | PR | Status | Branch / PR link | Notes |
|---|---|---|---|---|
| A | Unified type system | todo | — | Single `PageHeader`, remove inline heading sizes |
| B | Expense breakdown rewrite | todo | — | Donut + sorted ledger rows |
| C | Chart primitives | todo | — | `shared/Chart.tsx` — LineChart, SensitivityBars, SeasonalBars |

## Phase 4 — Brand

| # | PR | Status | Branch / PR link | Notes |
|---|---|---|---|---|
| D | Gable logo + favicon | todo | — | Drop in from `brand/`, update app header + meta tags |

## Phase 5 — Final review

| # | PR | Status | Branch / PR link | Notes |
|---|---|---|---|---|
| E | Side-by-side audit | todo | — | Walk every view with prototype open; file gaps |

---

## How to update this file

When a PR lands:

1. Change its status to `done`
2. Paste the merge commit SHA or PR URL in the "Branch / PR link" column
3. Add a one-line "what shipped" note if it deviated from the spec

When starting a PR:

1. Change its status to `in-progress`
2. Note which branch you're on

Claude Code: **always read this file before planning work, and update it before closing a session.**
