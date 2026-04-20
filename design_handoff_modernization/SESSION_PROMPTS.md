# Session prompts — copy/paste into Claude Code

A ready-made opening prompt for each PR. The pattern is the same for all of them: reference the spec files, scope to one PR, require a plan before code.

---

## Universal scoping prompt (use for every PR)

> Read `CLAUDE.md`, `design_handoff_modernization/README.md`, and `design_handoff_modernization/PROGRESS.md`. We are working on **PR [N]** from the progress list.
>
> Before writing any code, respond with:
> 1. Your understanding of this PR's scope
> 2. The files you will modify (existing)
> 3. The files you will create (new)
> 4. Any questions or ambiguities in the spec
>
> Wait for my approval before implementing.

Swap `[N]` for the PR number (or letter for Phase 3/4).

---

## Per-PR prompts

### PR 1 — Design tokens + fonts

> Read `CLAUDE.md` and `design_handoff_modernization/README.md`. We are working on **PR 1 (design tokens + fonts)**.
>
> Scope: add the CSS token file, wire up Google Font loading, update `index.html`. **Do not touch any React component.** If `index.css` or a global stylesheet exists, update it; otherwise create `frontend/src/styles/tokens.css` and import it in `main.tsx`.
>
> Respond with your plan first (files + rationale). Wait for approval before coding.

### PR 2 — Shared primitives

> Read `CLAUDE.md` and `design_handoff_modernization/README.md`. PR 1 is merged — tokens are available. We are working on **PR 2 (shared primitives)**.
>
> Build these five components in `frontend/src/components/shared/`, each in its own file, with a basic Vitest render test:
> - `PageHeader` (eyebrow + title + optional subtitle)
> - `Card`
> - `MetricCell`
> - `Button` (primary / secondary / ghost variants)
> - `Tabs`
>
> Also create `frontend/src/components/shared/Showcase.tsx` — a simple route that renders all primitives in every variant, for visual QA. Wire it at `/_showcase` in the router.
>
> Open `design_handoff_modernization/Modernized STR Calculator.html` in DevTools to confirm exact padding, font sizes, and border-radius values. Use tokens, not hex.
>
> Plan first.

### PR 3 — Dashboard view

> PR 2 is merged — primitives exist in `frontend/src/components/shared/`. We are working on **PR 3 (Dashboard view)**.
>
> Reference: `design_handoff_modernization/screenshots/01-dashboard.png`. Migrate `frontend/src/components/Dashboard/Dashboard.tsx` to use `PageHeader`, `Card`, `MetricCell`, and `Button` from the shared library. Do not change its data-fetching logic or the `usePortfolio` hook.
>
> Plan first.

### PR 4 — Property Info view

> PR 3 is merged. We are working on **PR 4 (Property Info view)**.
>
> Reference: `design_handoff_modernization/screenshots/02-property-info.png`. Migrate the Property Info form. Two-column layout: form on the left, live preview card on the right. Use existing form state management — just change the visual layer.
>
> Plan first.

### PR 5 — Financing view

> PR 4 is merged. We are working on **PR 5 (Financing view)**.
>
> Reference: `design_handoff_modernization/screenshots/03-financing.png`. Migrate the financing form, amortization chart, and term-selector. The chart will be replaced with a proper primitive in PR C — for this PR, just restyle the existing chart to match the screenshot.
>
> Plan first.

### PR 6 — Results view

> PR 5 is merged. We are working on **PR 6 (Results view)**.
>
> Reference: `design_handoff_modernization/screenshots/04-results.png`. This is the highest-value view — metric strip at the top, 10-year projection in the middle, expense breakdown below. As with PR 5, charts will be fully refactored in PR C; just restyle for now. The expense breakdown will be rewritten in PR B.
>
> Plan first.

### PR 7 — Glossary & Settings

> PR 6 is merged. We are working on **PR 7 (Glossary and Settings)**.
>
> References: `design_handoff_modernization/screenshots/05-glossary.png` and `06-settings.png`. Migrate both views to shared primitives.
>
> Plan first.

### PR 8 — Polish pass

> PRs 1–7 are merged. We are working on **PR 8 (polish pass)**.
>
> Walk every view. For each, audit and add where missing: hover states, focus rings (match the token), empty states, loading skeletons, and keyboard navigation. Run an axe-core accessibility pass; fix any violations.
>
> Plan first — list every view and what you intend to touch.

### PR A — Unified type system

> Phase 2 is complete. We are working on **PR A (unified type system)** from `Font & Chart Proposals.html`, section 01.
>
> Read `design_handoff_modernization/Font & Chart Proposals.html` section 01. Consolidate the three current heading patterns into a single `PageHeader` component (already exists — audit it against the spec). Remove every inline heading size across all views. Enforce the rule: serif H1 for page titles, serif 22 for sub-sections, no sans-serif headings anywhere.
>
> Plan first, including a list of every view you'll touch.

### PR B — Expense breakdown rewrite

> PR A is merged. We are working on **PR B (expense breakdown)** from `Font & Chart Proposals.html` section 02.
>
> Read `design_handoff_modernization/Font & Chart Proposals.html` section 02. Rewrite `frontend/src/components/shared/ExpenseBreakdown.tsx` (or its current equivalent) as a thin SVG donut + sorted ledger rows. Zero charting dependencies.
>
> Plan first.

### PR C — Chart primitives

> PR B is merged. We are working on **PR C (chart primitives)** from `Font & Chart Proposals.html` section 03.
>
> Read `design_handoff_modernization/Font & Chart Proposals.html` section 03. Build `frontend/src/components/shared/Chart.tsx` exporting three components: `LineChart`, `SensitivityBars`, `SeasonalBars`. Pure SVG, no deps. Each component < 80 lines. Migrate every existing chart call site to use them. Delete the old chart components they replace.
>
> Plan first, including the full migration map (old component → new component).

### PR D — Brand

> Phase 3 is complete. We are working on **PR D (brand)**.
>
> Drop `design_handoff_modernization/brand/` assets into `frontend/public/`. Update the app header to use the Gable mark + wordmark. Update `index.html` — document title, `<link rel="icon">`, `<meta>` tags. Confirm against `design_handoff_modernization/brand/Brand Exploration.html`.
>
> Plan first.

### PR E — Final audit

> All prior PRs are merged. We are working on **PR E (final audit)**.
>
> Walk every view, side-by-side with the prototype. File one follow-up per gap — do not bundle them. Respond with the full list of discrepancies and your proposed order of fixes; we'll decide what to ship.

---

## When things go wrong — debugging prompts

**Colors don't match:**
> The accent color in the Results view metric strip looks wrong. Compare the current implementation against `design_handoff_modernization/screenshots/04-results.png` and the CSS variables in `tokens.css`. Report the discrepancy before fixing.

**Spacing feels off:**
> The card spacing doesn't match the prototype. Open `design_handoff_modernization/Modernized STR Calculator.html`, inspect the equivalent card, and report the actual padding/gap values you find. Fix only after confirming.

**Scope crept:**
> You modified files outside the PR's scope. Revert anything in `[directory]/` and explain why you touched them. If legitimately needed, propose a separate follow-up PR.

**Component lost behavior:**
> The [component] no longer [does X]. Diff your version against `git show HEAD~1:[path]` and restore any logic that wasn't in the visual spec.
