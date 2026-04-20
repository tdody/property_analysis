# CLAUDE.md — Project instructions for Claude Code

This file tells Claude Code how to work in this repository. Read it in full at the start of every session.

---

## What this repo is

A short-term-rental profitability calculator. Python/FastAPI backend under `backend/`, R analysis scripts under `analysis/`, React+TypeScript frontend under `frontend/`.

We are in the middle of a **frontend modernization** (branch `design/modernization`). All design work is driven by the spec in `design_handoff_modernization/`.

---

## Golden rules

1. **Read the design spec first.** Before any design or frontend work, read `design_handoff_modernization/README.md` in full. Also read `design_handoff_modernization/PROGRESS.md` to know which PRs are already done.

2. **Scope is sacred.** Every session works on exactly one PR from the progress list. Do not start the next PR until the current one is merged and the progress file is updated.

3. **Never touch these directories** unless the PR explicitly says so:
   - `backend/`
   - `analysis/`
   - `.github/`
   - any file outside `frontend/src/` and `design_handoff_modernization/`

4. **The prototype is the pixel target.** `design_handoff_modernization/Modernized STR Calculator.html` is the reference. Open it in a browser while working. The screenshots in `design_handoff_modernization/screenshots/` are frozen snapshots of each view.

5. **Don't reinvent — migrate.** When updating a component, preserve its existing props API, data-fetching logic, and test coverage. Change visuals and composition; keep behavior.

6. **Use tokens, never hex.** All colors come from the CSS variables defined in PR 1. If you find yourself typing a hex code in a component, stop and use the token.

---

## How to start any session

Respond to the first user prompt by doing, in this order:

1. Read `design_handoff_modernization/README.md`.
2. Read `design_handoff_modernization/PROGRESS.md`.
3. Read any screenshot(s) relevant to the current PR.
4. **List the files you plan to modify and any new files you plan to create.** Include a rationale for each.
5. **Stop and wait for user approval.** Do not write code yet.

Only after the user approves the plan, begin implementation. When done, show the diff and wait for review before merging.

---

## Stack specifics

- **React 18 + TypeScript.** Functional components, hooks only.
- **Routing:** React Router v6. Check existing patterns in `frontend/src/App.tsx` before adding routes.
- **Data:** React Query (TanStack Query). Mutations go through the existing hooks in `frontend/src/hooks/`.
- **Styling:** CSS variables + plain CSS modules. No Tailwind, no styled-components, no Emotion. If a PR introduces a new utility, check the design spec first — it probably has a token already.
- **Types:** Shared types live in `frontend/src/types/index.ts`. Prefer importing over redefining.
- **Tests:** Vitest + React Testing Library. Every new shared component needs a basic render test.

---

## Spec files you will reference constantly

| File | When to use |
|---|---|
| `design_handoff_modernization/README.md` | The master spec. Tokens, type scale, component inventory, PR order. |
| `design_handoff_modernization/PROGRESS.md` | Which PRs are done, which is next. Update it when merging. |
| `design_handoff_modernization/Modernized STR Calculator.html` | The working prototype. Open in a browser, inspect in DevTools to read exact spacing/colors. |
| `design_handoff_modernization/Font & Chart Proposals.html` | Refinements to apply after PRs 1–8 land. Three PRs: type system, expense breakdown, chart primitives. |
| `design_handoff_modernization/screenshots/*.png` | Frozen visual targets per view. |
| `design_handoff_modernization/brand/` | Logo, favicon, brand exploration. |

---

## When stuck

If the spec is unclear or the prototype contradicts the README, **stop and ask the user** — do not guess. The user is iterating on the design in a parallel Claude conversation; an ambiguity usually means the spec needs an update before you proceed.
