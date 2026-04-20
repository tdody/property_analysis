# Handoff: STR Profitability Calculator — Frontend Modernization

## Overview

This handoff defines a visual and interaction modernization of the existing **STR Profitability Calculator** React frontend (`property_analysis/frontend/`). The goal is to replace the current purple/indigo gradient + pastel-chip aesthetic with a calmer, editorial, data-dense interface that makes the financial modeling feel like a considered tool rather than a generic SaaS dashboard.

**Scope:** Visual refresh + layout/IA improvements only. The backend API, data model, routes, hooks (`useProperty`, `useScenarios`, `useAssumptions`), and business logic are **not** changing. Do not modify anything under `frontend/src/api/`, `frontend/src/hooks/`, or `frontend/src/types/`.

---

## About the Design Files

The HTML file in this bundle (`Modernized STR Calculator.html`) is a **design reference prototype**, not production code. It is a single-file React+Tailwind+Babel page using mock data to demonstrate intended layouts, typography, color, spacing, and interactions across every view.

**Your task** is to recreate this design inside the real `property_analysis/frontend/` React/TypeScript/Tailwind app, preserving all existing data wiring (React Router v7, Axios client, hooks, types). Treat the HTML as a pixel-level visual target; port the *look and structure*, not the code verbatim.

The existing codebase already has: React 19, TypeScript, Tailwind CSS, React Router v7, a `ThemeContext` for light/dark, the `components/shared/` primitives (`CurrencyInput`, `PercentInput`, `MetricCard`, `TooltipIcon`, `ConfirmDialog`). Reuse these — don't re-implement them.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and component specs below are the canonical values. Match them precisely.

---

## Design Tokens

Add these as CSS custom properties in `frontend/src/index.css` (replacing or extending current theme values). The design uses `oklch()` for perceptual uniformity — both `:root` (light) and `.dark` scopes are defined.

### Colors (light mode — `:root`)

| Token | Value | Usage |
|---|---|---|
| `--canvas` | `oklch(0.985 0.004 85)` | Page background (warm off-white) |
| `--paper` | `oklch(0.995 0.003 85)` | Card/surface background |
| `--ink` | `oklch(0.18 0.015 255)` | Primary text, primary button bg |
| `--ink-2` | `oklch(0.38 0.012 255)` | Secondary text |
| `--ink-3` | `oklch(0.62 0.010 255)` | Tertiary / caps labels |
| `--rule` | `oklch(0.90 0.008 255)` | Hairline borders, dividers |
| `--rule-strong` | `oklch(0.82 0.010 255)` | Emphasized borders, form underlines |
| `--accent` | `oklch(0.46 0.085 175)` | Primary accent (deep teal); positive values |
| `--accent-soft` | `oklch(0.93 0.035 175)` | Accent backgrounds |
| `--negative` | `oklch(0.54 0.155 30)` | Negative cashflow, warnings |
| `--negative-soft` | `oklch(0.94 0.045 30)` | Negative backgrounds |
| `--warn` | `oklch(0.66 0.13 75)` | Amber warnings (tax banner) |
| `--warn-soft` | `oklch(0.95 0.05 85)` | Amber background |

### Colors (dark mode — `.dark`)

| Token | Value |
|---|---|
| `--canvas` | `oklch(0.16 0.010 255)` |
| `--paper` | `oklch(0.20 0.012 255)` |
| `--ink` | `oklch(0.96 0.005 85)` |
| `--ink-2` | `oklch(0.78 0.008 255)` |
| `--ink-3` | `oklch(0.58 0.012 255)` |
| `--rule` | `oklch(0.28 0.012 255)` |
| `--rule-strong` | `oklch(0.36 0.014 255)` |
| `--accent` | `oklch(0.74 0.09 175)` |
| `--accent-soft` | `oklch(0.28 0.045 175)` |
| `--negative` | `oklch(0.74 0.14 30)` |
| `--negative-soft` | `oklch(0.28 0.06 30)` |

Expose these to Tailwind by adding a `theme.extend.colors` config that references the CSS vars:
```js
colors: {
  canvas: 'var(--canvas)',
  paper: 'var(--paper)',
  ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
  rule: { DEFAULT: 'var(--rule)', strong: 'var(--rule-strong)' },
  accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)' },
  negative: { DEFAULT: 'var(--negative)', soft: 'var(--negative-soft)' },
  warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
}
```

### Typography

Load three Google Fonts in `frontend/index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Family | Usage | Tailwind name (suggested) |
|---|---|---|
| **Inter** | Body, UI, buttons, labels | `font-sans` (default) |
| **Instrument Serif** | Display numerals, page titles, metric hero, serif headings | `font-serif` |
| **JetBrains Mono** | Numeric inputs, formulas, alphabetical index, tabular data | `font-mono` |

Enable tabular numerals globally where numbers appear: `font-variant-numeric: tabular-nums`. All currency, percent, and metric values should be tabular. Inter's stylistic sets `ss01` and `cv11` are enabled in body.

### Type Scale

| Class name (suggested) | Size / line-height | Font | Use |
|---|---|---|---|
| `metric-xl` | `clamp(48px, 6vw, 84px)` / 0.95, letter-spacing -0.02em | Instrument Serif | Results page hero numbers |
| `metric-lg` | 40px / 1.0 | Instrument Serif | Dashboard hero stats |
| Display 1 | 56px / 0.98, letter-spacing -0.01em | Instrument Serif | Page titles ("Settings", "Glossary", property name) |
| Display 2 | 28px / 1.0 | Instrument Serif | Section titles ("All properties", form section headings) |
| Display 3 | 22px / 1.0 | Instrument Serif | Card titles, sidebar headings |
| Body large | 15px / 1.5 | Inter | Lead paragraphs, field values |
| Body | 14px / 1.5 | Inter | Default UI |
| Small | 13px / 1.4 | Inter | Buttons, table cells, secondary |
| Caps | 11px / 1.0, uppercase, letter-spacing 0.14em, weight 500 | Inter | All labels, section captions |

### Spacing, Radii, Motion

- **Page gutter:** 40px (`px-10`), max-width 1280px, `mx-auto`
- **Section vertical rhythm:** 40px between sections, 24–32px within
- **Radii:** 8px (inputs/buttons), 12px (small cards, segmented controls), 16–20px (primary cards), 999px (pills, full-round buttons)
- **Rules/borders:** 1px `var(--rule)` for hairlines, 1px `var(--rule-strong)` for emphasized. No shadows on cards; use borders.
- **Focus:** 2px `var(--accent)` outline, 2px offset
- **Transitions:** 150ms ease on border-color, background, color. Entrance `fadeUp` 400ms cubic-bezier(.2,.8,.2,1)
- **Sparkline/line chart draw-in:** 1.4s cubic-bezier(.2,.8,.2,1), `stroke-dasharray 1000` animated to 0

### Anti-patterns to remove from current codebase

- ❌ `bg-gradient-to-r from-indigo-600 to-indigo-500` → ✅ solid `bg-ink`
- ❌ `shadow-md shadow-indigo-200` → ✅ borders only, no colored shadows
- ❌ `rounded-2xl` + drop shadow → ✅ `rounded-2xl` + 1px border
- ❌ Pastel category chips (`bg-violet-100 text-violet-700`, etc.) → ✅ outlined pills using `border-rule-strong` + caps text
- ❌ Emoji-style info banners → ✅ subtle amber rule banner for warnings
- ❌ Purple/indigo primary → ✅ near-black ink primary + teal accent

---

## Screens / Views

The existing route structure (`/`, `/property/:id`, `/compare`, `/glossary`, `/settings`) is preserved. What changes is the layout and visual treatment inside each page.

---

### 1. Dashboard (`pages/DashboardPage.tsx` → `components/Dashboard/Dashboard.tsx`)

**Purpose:** Portfolio overview + property list with filters, sort, search, multi-select compare, and add-property flow.

**Layout:**

1. **Hero section** (not a KPI card grid — an editorial block):
   - Left: `caps` label "Your Portfolio · [Month Year]", then a 56px Instrument Serif headline: *"N active properties across M markets."* with the market count italicized. Supporting paragraph (15px body, `text-ink-2`, max-width ~440px).
   - Right: 520px max-width, 2×2 grid of hero stats inside a top rule. Each stat: 11px caps label, then 40px Instrument Serif value (emphasized stat) or 28px Inter tabular-num. Stats use a left border between columns, top border across. Signed values color: positive = `text-accent`, negative = `text-negative` (with `−` Unicode minus, not hyphen).
   - Stats shown: *Avg Monthly Cashflow* (emphasized, Instrument Serif), *Best Cash-on-Cash*, *Avg Cap Rate*, *Total Invested*.

2. **Toolbar row** (48px height, flex end-aligned):
   - Left: Serif "All properties" (28px) with a muted sans count `(N)` inline; then a pill segmented control for `All` / `In portfolio` / `Pipeline` (replacing the existing "In Portfolio / Not In Portfolio" wording).
   - Right: search input (pill, 220px wide, 36px tall, `bg-paper` + `border-rule-strong`, with an inline magnifier icon on the left), sort select (same pill style), a "Compare (N)" button appearing only when ≥2 rows are selected, and a primary "+ Add property" button (full-round pill, `bg-ink` `text-canvas`, 36px).

3. **Property list — default "rows" view** (replaces the current card grid):
   - Single data table with columns (headers are 11px caps, `text-ink-3`):
     - [checkbox 32px] · Property (2.2fr, min 280px) · Listing (1fr right) · Cashflow (1fr right) · Cash-on-Cash (1fr right) · Cap (1fr right) · Break-even (1fr right) · [star 40px]
   - Each row: 56×56 thumbnail (placeholder SVG, see "Placeholder Thumbnails" below), property name (15px semibold), rental-type outlined pill (STR/LTR, 11px caps, `border-rule-strong`), optional "In portfolio" caps accent label, secondary line `City, ST · N bd · N ba · N,NNN sqft` (12px `text-ink-3`).
   - Cashflow cell: 15px semibold tabular with signed prefix, "/mo" suffix in `text-ink-3` regular.
   - Break-even cell: a custom `OccupancyGauge` component — inline with the number, a 56×6px rounded track showing current occupancy vs the break-even target marker (1px vertical ink tick at the target %).
   - Row hover: `bg-paper`. Entire row is clickable → navigates to `/property/:id`. Checkbox and star toggle isolate click via `stopPropagation`.
   - Dense mode (Tweaks: `density=compact`): rows collapse from `py-5` to `py-3`; header from `py-3` to `py-2`.

4. **Property list — alternate "cards" view** (Tweaks: `listView=cards`):
   - 3-column grid (1/2/3 responsive) of cards (`bg-paper`, `rounded-2xl`, `border border-rule`, hover → `border-ink`).
   - Each card: 16:10 thumbnail with absolute-positioned checkbox (top-left) and rental-type pill (top-right on `bg-paper/90`). Below: flex row with serif property name (22px) and price (15px tabular). Secondary address line. Top rule + 2-col grid for Cashflow and CoC stats.

5. **Add Property form** (inline, expands on "+ Add property" click):
   - `bg-paper` card with 24px padding. Heading "Add a property" (serif 24px) + helper text. Row 1: URL input (wide `.field` style with a 2px bottom rule instead of 1px) + "Fetch from Redfin" primary pill. Row 2: horizontal rule with "or enter manually" caps label centered. Row 3: Property Name + Listing Price `.field`s, plus "Create manually" secondary pill and "Close".

6. **Empty/no-match states**: dashed-border rounded box, serif headline, muted helper line.

**Placeholder Thumbnails:**
The design uses original abstract SVG placeholders (no real property photography). In production, replace with real `image_url` from the property record, falling back to these placeholders when null. Placeholders are a hatched 45° pattern + simple geometric house silhouettes at varying hues (blueish for multi-unit, warm for cape, teal for duplex) — see `PropertyThumb` in the HTML source.

---

### 2. Property Detail (`components/PropertyDetail/PropertyDetail.tsx`)

**Purpose:** Single-property workspace — info, scenarios, assumptions, results.

**Layout:**

1. **Breadcrumb:** `← All properties`, 13px `text-ink-3` with left-caret SVG icon.

2. **Header row:** flex items-end, justify-between.
   - Left: rental type pill + optional "In portfolio" caps accent; then 56px Instrument Serif property name; then address line (15px `text-ink-2`) with `type · Built year` in `text-ink-3` after a dot separator.
   - Right: "Duplicate" pill + "Add to portfolio"/"In portfolio" pill (with a star icon, outlined or filled).

3. **Metric strip:** 4-column grid inside top+bottom `border-rule-strong`. Each cell: 24px padding, caps label, value (first cell uses `metric-lg` Instrument Serif for Monthly Cashflow emphasis; others 32px Inter semibold tabular). Left borders between cells. Cells: Monthly Cashflow (emphasized, signed color), Cash-on-Cash (signed), Cap Rate (with "NOI ÷ price" sub), DSCR (colored by whether ≥1.0, sub = "passes 1.0×" / "below 1.0×").

4. **Tabs:** underlined tab bar (not pills). Row of 4 tabs (`Property Info`, `Financing`, `Revenue & Expenses`, `Results`), separated by 32px gaps, sitting on a bottom `border-rule-strong`. Active tab: `text-ink`, 2px ink underline offset to `bottom: -1px` (overlapping the container border); inactive: `text-ink-3`.

5. **Tab content:** 40px top margin, per-tab layouts below.

#### 2a. Property Info Tab (`PropertyInfoTab.tsx`)

Two-column: `1fr` main + `320px` aside.

**Main column, stacked sections** using the `FormSection` two-column pattern:
- Each section: a `200px` left column with 22px serif title + 13px `text-ink-3` subtitle; and a right column with a 2-col form grid (`gap-x-8 gap-y-5`).

- **Tax warning banner** (first, dismissible): 1px `border-warn`, `bg-warn-soft`, rounded-xl, 16px padding, flex-gap with alert triangle icon. Title 14px semibold; body 13px leading-relaxed; top-right "Dismiss".
- **Location:** Address, City, State, Zip (all scraped).
- **Details:** Bedrooms, Bathrooms, Square feet, Year built (scraped), Property type, Rental type.
- **Financials:** Listing price (scraped), Estimated value (empty placeholder), Annual taxes (scraped), Non-homestead annual taxes, HOA monthly, Source URL.
- **Notes:** Full-width textarea (`.field` style), min-height 120px.

**Fields:**
- Use the `.field` class pattern: transparent background, no border except 1px `border-rule-strong` bottom, 10px top / 8px bottom padding, 15px JetBrains Mono tabular value. Focus → bottom becomes 1px `var(--accent)`.
- Each field has a caps label above (11px, 0.14em tracking, `text-ink-3`).
- **Scraped fields** show a tiny "Redfin" label floating top-right in the accent color (9px caps bold) — see `.scraped` class in CSS. This replaces the existing blue "Redfin" pill badges.
- Currency fields use a `$` prefix in `text-ink-3` mono to the left of the input.

**Aside (`320px`):**
- "Import status" card (`bg-paper`, `rounded-2xl`, `border-rule`, 20px padding): caps label, a status line with a tiny accent dot ("Populated from Redfin"), a summary sentence ("11 of 14 fields auto-filled"), a vertical list of `ScrapeRow` items ("Address ✓ imported", "Estimated value ○ missing" in `text-warn`), and a "View source listing →" link in accent with underline.
- "Shortcut" card: small prompt to jump to Financing, with an inline underline link.

#### 2b. Financing Tab (`FinancingTab.tsx`)

Two-column: `280px` scenario rail + `1fr` editor.

**Left rail (scenarios):**
- Caps "Scenarios" header, "+ New" accent button top-right.
- Vertical list of scenario tiles (`rounded-xl`, `p-4`). Active tile: `border-ink` + `bg-paper`; inactive: `border-rule` hover `border-rule-strong`. Each: scenario name (14px semibold) + optional caps accent "Primary" flag top-right, then a 12px `text-ink-3` tabular detail line ("25% down · 7.25% · 30y").

**Editor:**
- Top bar: bottom rule separating an inline-editable serif scenario name (28px, transparent input), a short helper paragraph, and a right-aligned "Make primary" / "Primary scenario" button.
- **Live summary row:** 4-column grid inside a single `rounded-2xl` `border-rule` `bg-paper` card: Loan amount, Monthly P&I, Cash in, LTV. Each cell: caps label + 22px tabular semibold. Left borders between cells.
- **FormSection: Loan terms:** four `SliderField`s — Down payment (5–50%, step 1, shows dollar sub-label below), Interest rate (3–12%, step 0.05, suffix `%`), Term (10–30y, step 5), Closing costs (0–6%, step 0.25).
  - `SliderField` layout: row with caps label + mono value right-aligned on top; full-width native `<input type="range">` styled with `accent-color: var(--ink)`; optional mono sub-text below.
- **FormSection: Upfront costs:** four `.field` inputs — Purchase price, Renovation, Furniture, Other upfront (all with `$` prefix).
- **Amortization chart section:** `FormSection` layout with left title/subtitle; right contains a 640×200 SVG chart with:
  - Dashed horizontal rules at 25/50/75% of height in `var(--rule)`
  - Solid ink line = remaining balance over years
  - Dashed accent line = cumulative interest
  - 12px legend below: Balance (solid ink), Cumulative interest (dashed accent), "Total interest: $XXX" right-aligned in `text-ink-3` mono.
  - Lines animate on mount via `stroke-dasharray: 1000; animation: drawIn 1.4s`.

#### 2c. Revenue & Expenses Tab (`RevenueExpensesTab.tsx`)

Two-column: `1fr` main + `340px` sticky aside.

**Main column sections:**
- **Revenue assumptions:** Avg nightly rate ($), Occupancy (%), Avg stay length (nights), Platform fee (%), Cleaning fee/stay, Cleaning cost/turn. All `.field` style.
- **Seasonal occupancy:** First a toggle row — custom `Toggle` component (11×6 rounded pill, moving dot), label "Model seasonal occupancy". When on: Peak months slider (1–12), Peak occupancy (%), Off-peak occupancy (%), and a full-width `SeasonalBars` chart.
  - `SeasonalBars`: 12 bars with month initials (J F M A M J J A S O N D) at the bottom. Peak months (centered on June) are solid `var(--ink)`; off-peak are `var(--accent-soft)`. Peak months show their occupancy value as a tiny tabular mono label just above the bar. 90px height, bars gap 1.
- **Operating expenses:** 8 `.field`s — Utilities/mo, Insurance/yr, Supplies/mo, Lawn & snow/mo, Software/mo, Marketing/mo, Accounting/yr, Legal/yr. All with `$` prefix.
- **Reserves:** Three `SliderField`s (Maintenance %, Capex %, Damage %).
- **VT tax configuration:** Collapsible `<details>` panel. Summary row has title + caption + right-aligned "Expand ↓". Expanded: 2-col grid with State rooms tax, STR surcharge, Local option, Registration fee. Use the `.field` style.

**Sticky aside (`340px`, `lg:sticky lg:top-24`):**
- "Live preview" card (`bg-paper`, 1px `border-rule-strong`, rounded-2xl, 24px padding).
  - Caps label; then `metric-lg` Instrument Serif Monthly revenue value.
  - Top rule, then 2-col split: Monthly expenses (20px tabular semibold) and Estimated cashflow (20px tabular semibold, signed color).
  - Helper footnote in 12px `text-ink-3`.

#### 2d. Results Tab (`ResultsTab.tsx`)

Full-width, no sidebar.

- **Headline strip:** 3-column grid inside top+bottom `border-rule-strong`. Each column: 32px padding, caps label, `metric-xl` (up to 84px) Instrument Serif value, then a 13px `text-ink-3` sub-line. Cells: Annual cashflow · Year 1 (signed), IRR · 10yr + "Equity multiple Nx" sub, Break-even occupancy + "You project N%" sub.
- **10-year projection** `FormSection`:
  - Simple table, 13px tabular. Header row in caps `text-ink-3`, bottom rule. Columns: Year · NOI · Cashflow · Equity · CoC · [inline bar].
  - Each row: signed colors on Cashflow/CoC. Last column (34% wide) contains a horizontal bar anchored at center: positive years extend right in `accent`; negative years extend left in `negative`. A 1px center rule sits on `rule-strong`.
- **Sensitivity** `FormSection`:
  - Right area has a 2-col grid of two sensitivity cards (`bg-paper` `rounded-2xl` `border-rule`, 20px padding). Each card: caps title, then 5 rows. Each row: `[80px mono axis value] [1fr bar] [80px right-aligned impact]`. Bar: 6px rounded track, 1px ink center tick, colored fill from center to reflect the signed impact.
- **Where the money goes** `FormSection`:
  - `ExpenseBreakdown` component: a horizontal 12px stacked bar divided by expense category (Mortgage = `var(--ink)`, then shades of teal for the rest). Below: 2-col legend with 10×10 colored squares + labels + tabular values. Bottom rule then a "Total monthly" row in semibold tabular.

---

### 3. Compare (`components/Comparison/ComparisonView.tsx`)

**Purpose:** Side-by-side metric comparison of 2+ selected properties.

**Layout:**
- Breadcrumb back.
- 56px serif "Side by side" title.
- Full-width table: first column is 220px of caps metric labels; remaining columns are 200px+ each, one per property. Column headers: 26px serif property name + 12px city/state.
- Rows: top `border-rule`, caps label left, 17px values per property. The *best* value per row is bolded and gets a small caps accent label "Best". Cashflow/CoC/DSCR/GrossYield score higher = better; BreakEven occupancy scores lower = better (invert).

---

### 4. Glossary (`pages/GlossaryPage.tsx`)

**Purpose:** Reference for every metric and term used in the calculator.

**Layout:**
- Header row: left side "Reference" caps + 56px serif "Glossary" + 15px supporting paragraph. Right side: search input (pill, 260px).
- Category segmented pill: All / Metrics / Revenue / Expenses / Financing / Tax.
- A–Z index row inside top+bottom `border-rule`: 26 letter buttons (32×32, rounded-full, JetBrains Mono 12px). Letters without entries are disabled in `rule-strong` color. Clicking scrolls to that section.
- Sections: `id="sec-A"` etc. Each section is a `grid-cols-[80px_1fr]`: 64px Instrument Serif letter on the left, divided list of entries on the right.
- Each entry: 2-col grid with term block on left + category caps on right.
  - Term block: 16px semibold name, 14px body leading-relaxed, optional **Formula** box (tiny inline box: `bg-paper`, `border-rule`, `rounded-lg`, px-4 py-3; caps "Formula" label then 13px mono expression), optional **Related** line (12px, accent underlined links).

---

### 5. Settings (`pages/SettingsPage.tsx`)

**Purpose:** Workspace preferences + default values applied to new properties.

**Layout:**
- Header: caps "Workspace" + 56px serif "Settings".
- **Appearance section** (`FormSection`): Theme seg (Light/Dark), Accent swatches (teal/indigo/ember/ink, 22×22 circles; active has 2px ink outline with 2px offset), Density seg (Comfortable/Compact), Properties view seg (List/Cards).
- **Seasonal occupancy defaults** (`FormSection`): Peak months slider, Peak %, Off-peak %, plus the `SeasonalBars` chart for preview.
- **Vermont tax defaults** (`FormSection`): State rooms tax, STR surcharge, Local option, Registration fee.
- Footer: "Save settings" primary pill + "Reset to defaults" secondary pill.

---

## Shared Components / Primitives

Create (or update) these under `frontend/src/components/shared/`:

| Component | Replaces / Adds | Notes |
|---|---|---|
| `FormSection` | New | Two-column layout: 200px title block + content grid. Title = 22px serif + 13px `text-ink-3` sub. Content grid defaults to 2-col with `gap-x-8 gap-y-5`. |
| `Field` | Rework of inputs | Transparent input with bottom rule, caps label, optional `$`/`%` prefix/suffix, optional `scraped` flag that renders the "Redfin" micro-badge. |
| `SliderField` | New | Range input styled with `accent-[color:var(--ink)]`, caps label + mono value row, optional sub-line. |
| `Toggle` | Rework | 44×24 rounded-full track, 20×20 dot that translates. On → `bg-ink`. |
| `Segmented` / `.seg` | New | `inline-flex` in a `rounded-full` `border-rule-strong` `bg-paper` shell. Active button: `bg-ink text-canvas`. |
| `OccupancyGauge` | New | Inline gauge (see Dashboard row spec). |
| `MetricCell` / `StripMetric` | Replaces `MetricCard` usage on detail page | Flat bordered cell; emphasis mode swaps in `metric-lg` serif. |
| `RentalBadge` | Replaces pastel STR/LTR chip | Outlined caps pill. |
| `PropertyThumb` | New | Hatched SVG placeholder (see prototype). Fallback for null `image_url`. |
| `SparklineAmort` | New | Amortization line chart (SVG, draw-in animation). |
| `SensitivityCard`, `SeasonalBars`, `ExpenseBreakdown` | New | See Results/Revenue tab specs. |

Keep reusing existing: `ConfirmDialog`, `TooltipIcon`, `ErrorBoundary`, `PropertyTypeIcon`. `CurrencyInput` / `PercentInput` can stay for form wiring, but restyle to match `.field` visuals.

---

## Interactions & Behavior

- **Route transitions:** 400ms `fadeUp` on main content mount (translateY 6px → 0, opacity fade). CSS animation, no library.
- **Hover:** Rows → `bg-paper`. Cards → `border-ink`. Icon buttons → `text-ink`.
- **Focus:** 2px accent outline, 2px offset, no focus rings on borders.
- **Theme toggle:** Existing `ThemeContext` stays; flips `.dark` on `<html>`. Moon/sun icons in the top nav.
- **Sliders:** Live-update dependent preview values (loan amount, P&I, LTV, monthly revenue, estimated cashflow, seasonal bar chart). No debouncing needed — pure client math.
- **Scenario editor:** Editing name/params mutates only the active scenario. "Make primary" sets `active: true` on this scenario and `false` on siblings.
- **Import status:** Fields populated from scrape show the "Redfin" micro-badge. Missing fields show orange "○ missing" in the side panel.
- **Glossary A–Z:** Clicking a letter smooth-scrolls to `#sec-<letter>`. Disabled letters (no entries) do nothing.
- **Compare:** Requires 2+ selected rows on Dashboard; when met, a "Compare (N)" pill appears in the toolbar and navigates to `/compare?ids=...`.
- **Dashboard view toggle:** List (default) vs Cards — user preference, persist to `localStorage` via `ThemeContext` or a new preferences context.
- **No more emoji info banners** (e.g. "ℹ️ Property data populated from Redfin") — replace with the amber warning banner pattern for actionable warnings only; drop the neutral "info" blue banner (info is now surfaced in the Import Status aside).

---

## State Management

No new global state is introduced. Within the detail page:
- Active tab: local `useState<TabName>`.
- Active scenario in Financing: local state; persist to backend via existing `onActivateScenario` prop.
- Dashboard filter/sort/search/selection/view-mode: local state (view-mode can go in a new `UIPreferencesContext` if persistent).

Existing hooks (`useProperty`, `useScenarios`, `useAssumptions`, `useLTRAssumptions`) stay unchanged.

---

## Recommended Migration Order

Ship as a sequence of reviewable PRs:

1. **Tokens & fonts PR** — add CSS custom props, Google Font imports, Tailwind color extension. Delete indigo/violet references from existing components (temporarily falls back to ink/teal). App should still boot with mildly-updated look.
2. **Shared primitives PR** — `FormSection`, `Field`, `SliderField`, `Toggle`, `Segmented`, `RentalBadge`. No page changes yet.
3. **Dashboard PR** — hero + toolbar + list view + cards view + add form.
4. **PropertyDetail shell PR** — header + metric strip + tabs.
5. **Tabs PRs** — Property Info, Financing (+ amortization chart), Revenue & Expenses (+ seasonal bars + sticky preview), Results (+ sensitivity + expense breakdown). One PR per tab.
6. **Glossary + Compare PR**.
7. **Settings PR**.
8. **Cleanup PR** — remove unused legacy chip/banner styles, audit shadow classes, verify dark-mode pairs.

---

## Files in This Bundle

- `README.md` — this document
- `Modernized STR Calculator.html` — the reference prototype. Open in any browser. Interactions are functional (routing between views is internal state; scenario/slider edits update previews in real time).
- `screenshots/` — PNG captures of each major view:
  - `01-dashboard.png` — Dashboard (list view)
  - `02-property-info.png` — Property Detail · Property Info tab
  - `03-financing.png` — Property Detail · Financing tab
  - `04-results.png` — Property Detail · Results tab
  - `05-glossary.png` — Glossary
  - `06-settings.png` — Settings

### Target files in `property_analysis/frontend/`

| Design area | Target file(s) |
|---|---|
| Tokens | `src/index.css`, `tailwind.config.*` (add if missing; config can live in `vite.config.ts` via `@tailwindcss/vite`) |
| Top nav | `src/App.tsx` |
| Dashboard | `src/pages/DashboardPage.tsx`, `src/components/Dashboard/Dashboard.tsx`, `src/components/Dashboard/PropertyCard.tsx` |
| Property Detail shell | `src/pages/PropertyPage.tsx`, `src/components/PropertyDetail/PropertyDetail.tsx` |
| Info tab | `src/components/PropertyDetail/PropertyInfoTab.tsx` |
| Financing tab | `src/components/PropertyDetail/FinancingTab.tsx`, `ScenarioCard.tsx` |
| Revenue tab | `src/components/PropertyDetail/RevenueExpensesTab.tsx` |
| Results tab | `src/components/PropertyDetail/ResultsTab.tsx` |
| Compare | `src/components/Comparison/ComparisonView.tsx`, `src/pages/ComparePage.tsx` |
| Glossary | `src/pages/GlossaryPage.tsx` |
| Settings | `src/pages/SettingsPage.tsx` |
| Shared primitives | `src/components/shared/` |

---

## Assets

- **Fonts:** Inter, Instrument Serif, JetBrains Mono — all from Google Fonts (no licensing cost).
- **Icons:** All UI icons in the prototype are inline SVGs (moon, sun, search, arrow-left, star, star-fill, alert). Port them directly or substitute with `lucide-react` equivalents (`Moon`, `Sun`, `Search`, `ArrowLeft`, `Star`, `AlertTriangle`) if the team prefers a library.
- **Property thumbnails:** Original abstract SVG placeholders (no real photography). Use them as a fallback only; prefer real `image_url` from the property record when present.
- **No brand assets from third parties** (Airbnb, Redfin, etc.) are used. The "Redfin" word-label on scraped fields is plain text in the accent color — don't use Redfin's logomark or brand colors.

---

## Suggested First Prompt to Claude Code

> I've attached a design handoff in `design_handoff_modernization/`. Read `README.md` end-to-end, then do the first migration step only: the **Tokens & fonts PR**.
>
> - Add the CSS custom properties from the *Design Tokens* section to `frontend/src/index.css` (both `:root` and `.dark` scopes).
> - Add the three Google Fonts imports to `frontend/index.html`.
> - Update Tailwind config so the `canvas`, `paper`, `ink`, `rule`, `accent`, `negative`, `warn` color families resolve to the CSS variables.
> - Add a `font-serif` family for Instrument Serif and `font-mono` for JetBrains Mono; keep Inter as `font-sans`.
> - Audit `src/` for any `indigo-*`, `violet-*`, `from-indigo`, colored `shadow-indigo` classes and list them in your summary (do not replace yet).
>
> Do **not** touch `src/api/`, `src/hooks/`, `src/types/`, or any business logic. Do not start visual refactors of components yet. When done, open the app and confirm it still boots. Then stop and wait for the next PR prompt.
