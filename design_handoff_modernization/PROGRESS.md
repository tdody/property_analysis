# Modernization progress

Track PR status here. Claude Code reads this at the start of every session to know what's done and what's next. Update it when merging each PR.

Status: `todo` · `in-progress` · `review` · `done`

---

## Phase 2 — Base modernization (from `README.md`)

| # | PR | Status | Branch / PR link | Notes |
|---|---|---|---|---|
| 1 | Design tokens + font loading | done | THI-45 / 8956e23 (#16) | Pre-dated this tracker; confirmed no drift vs spec on 2026-04-19 |
| 2 | Shared primitives | done | THI-46 / 14729af (#17) | Shipped set: `Field`, `FormSection`, `MetricCell`, `OccupancyGauge`, `PropertyThumb`, `RentalBadge`, `Segmented`, `SliderField`, `Toggle` (README inventory). `Card` / `Button` / `Tabs` deliberately not extracted — views use inline token-based patterns; extract only on demand. `PageHeader` rolled into Phase 3 PR A. |
| 3 | Dashboard view | done | THI-47 / ecb7f4e (#23) | Pre-dated this tracker |
| 4 | Property Info view | done | THI-48 shell / 0dc7edb (#18) + THI-49 info / 98bb894 (#19) | Shell + tab landed as two PRs |
| 5 | Financing view | done | THI-50 / 32b4662 (#20) | Pre-dated this tracker |
| 6 | Results view | done | THI-51 rev&exp / 3558ca7 (#21) + THI-52 results / 2619bd7 (#22) | Revenue+Expenses and Results landed as two PRs |
| 7 | Glossary & Settings | done | THI-53 / 078e8bd (#24) + THI-54 / 6f10594 (#25) | Glossary+Compare and Settings landed as two PRs |
| 8 | Polish pass | review | #26, #27, #28 + commits `b925ee3`, `5fabe8d`, `2e9a622`, `606e974`, `e09fd6f`, `f4f286c`, `aec4fbf` on `design/modernization` | **Tier 1** focus rings + global `:focus-visible` ✓. **Tier 2** `Skeleton` + `EmptyState` primitives, loading skeletons across views ✓. **Tier 3** roving tabindex on tablists, dialog focus trap + Escape (ConfirmDialog / HistoryDrawer / SnapshotButton) ✓. **Tier 4a** DEV-only `axe-core` reporter ✓. **Tier 4b** `label` / `select-name` / `heading-order` fixes (Field/SliderField/CurrencyInput/PercentInput `htmlFor`, PropertyInfoTab select, Settings file input, FormSection/PropertyCard h3→h2, aside h4→h3) ✓. **Tier 5** vitest + RTL + jest-axe infrastructure and tests for PR 8's new primitives (Skeleton, EmptyState, Segmented, useEscapeKey, useFocusTrap, ConfirmDialog — 23 tests) ✓. **Deferred**: systemic `color-contrast` failures on `--ink-3` → tracked in [THI-58](https://linear.app/thibault-dody/issue/THI-58); CI integration of `npm test` (`.github/` out of scope per CLAUDE.md); test backfill for pre-PR-8 primitives. Color-audit of residual non-token classes in `QuickTest.tsx`, `SnapshotButton.tsx`, `HistoryDrawer.tsx`, `MetricCard.tsx`, `PropertyTypeIcon.tsx`, `App.tsx` recorded in commit marking PR 1 done (2026-04-19) |

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
