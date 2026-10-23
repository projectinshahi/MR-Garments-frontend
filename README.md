# MR Garments: Frontend

**MR Garments: Import Tracking System.** It follows every purchase order from a China supplier through
receiving, container shipping, clearing in India and transport to the India warehouse, with the landed cost in INR.
Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui (Radix),
TanStack Table, React Hook Form + Zod, Recharts, date-fns, and Sonner.

**Status:**
- Done: the foundation, the screenshot analysis (`docs/screenshot-inventory.md`), and the Phase 2 shared setup (shell, measured tokens, Arimo, shared components, master data, every route registered as a placeholder).
- Next: screens are built in waves by Claude Code agents (`docs/proposed-build-plan.md`, `docs/multi-agent-plan.md`).
- All data is local, deterministic mock data. There is no backend, auth API or persistence.

Reference screenshots (about 33 MB) stay at `docs/MR_Garments_Screenshots/` and are **git-ignored** (not committed).

## Requirements

- Node.js **20.19+** (22 LTS or newer recommended; Node 20 reached end-of-life in April 2026)
- npm 10+

## Setup

```bash
npm ci                              # install exactly what package-lock.json specifies
npx playwright install chromium     # one-time, for browser tests
```

## Development

```bash
npm run dev          # http://localhost:3000
```

- Every route from the screenshot mapping exists. Unbuilt screens show a placeholder naming their reference.
- `/preview` is the living component preview: every shared component rendered with sample data from the references.
- `/login` uses the auth layout. `/home` uses the staff sidebar.

## Quality checks

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run test` | Vitest + React Testing Library (jsdom), single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright. Builds, serves on port 3100 (override with `E2E_PORT`), runs `e2e/` |
| `npm run validate` | lint, then typecheck, then test, then build |
| `node scripts/visual-diff.mjs --url <url> --ref <image> --out .visual/<name> [--region x,y,w,h]` | Captures a route at 1440 × 900 (2×) and writes reference \| ours \| diff with a mean difference score |

## Build

```bash
npm run build
npm run start        # serves the production build on :3000
```

## Project layout

```
src/
  app/                   root layout, globals.css (measured design tokens)
    (app)/               management shell routes, loading/error boundaries, /preview
    (staff)/             staff shell (/home)
    (auth)/              login, forgot password, change password
  components/
    ui/                  shadcn primitives (restyled to the references)
    layout/              AppShell, AppSidebar (user menu), PageHeader, PageContainer, RouteTabs, AuthLayout
    shared/              DataTable, filters, cards, KPIs, status pills, timelines, progress, charts, form kit, notInPrototype
  features/<feature>/    screen UI, logic and data/ (screen fixtures and queries), created per assigned screen
  features/order-detail/shared/   order-detail frame shared by two agents
  lib/                   formatters, constants (MOCK_TODAY), data/master.ts (master-data accessors)
  mocks/data/master.ts   shared master data (suppliers, agents, teams, items, users, roles)
  types/domain.ts        shared data contracts
  config/navigation.ts   sidebar variants and user menu
e2e/                     Playwright specs (shell.spec.ts plus one per agent)
scripts/visual-diff.mjs  screenshot comparison tool
docs/                    inventory, build plan, contract, multi-agent plan, assignments, templates, checklist
.claude/                 agent definition, path-scoped rules, guard hook, worktree settings
```

## Documentation

- `CLAUDE.md`: project rules for humans and Claude Code
- `docs/screenshot-inventory.md`: reference inventory, design tokens, route mapping, data-difference log
- `docs/proposed-build-plan.md`: approved decisions, components, ownership matrix, blockers
- `docs/component-contract.md`: shared component APIs
- `docs/multi-agent-plan.md`: orchestrator and screen-agent workflow and ownership
- `docs/templates/screenshot-inventory.md`, `docs/templates/screen-assignment.md`
- `docs/validation-checklist.md`
