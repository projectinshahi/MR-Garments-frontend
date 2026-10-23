# MR Garments Frontend: Project Rules

@AGENTS.md

**MR Garments: Import Tracking System.** Every purchase order is tracked from a China supplier through
receiving in China, container loading, clearing in India and transport, to the India warehouse, with the
landed cost in INR. It is **not** a generic garment-inventory app. Frontend only: local typed mock data,
no backend, auth API, database, or persistence.

## Current phase

- **Done:**
  - The foundation, the screenshot inventory (`docs/screenshot-inventory.md`), and decisions D1–D6 and B1–B4 (`docs/proposed-build-plan.md`).
  - **Phase 2 shared setup:** shell, tokens, Arimo, shared components, master data, route registration, guard hook.
  - **Impeccable installed and verified** (see the Impeccable section below).
- **Next:** one pilot screen agent (`W1-dashboard`), then the rest of Wave 1, each **only after explicit user approval**.
- Every route already exists as a placeholder page. A screen agent replaces only the pages and feature folders its assignment lists.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` (http://localhost:3000) |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` (runs `next typegen` first, so `PageProps`/`LayoutProps` exist) |
| Unit/component tests | `npm run test` |
| Browser tests | `npm run test:e2e` (builds, serves on :3100, or `E2E_PORT`) |
| Everything except e2e | `npm run validate` |
| Screenshot comparison | `node scripts/visual-diff.mjs --url <url> --ref "<reference .jpeg>" --out .visual/<name> [--region x,y,w,h]` |

## Stack facts that differ from older habits

- **Next.js 16.4 with `cacheComponents` and `partialPrefetching` on.** Read `node_modules/next/dist/docs/` before using an API you have not checked.
  - Reading `params`/`searchParams` in a page, or `usePathname`/`useSearchParams` on a route with unknown dynamic params, needs a `<Suspense>` boundary or `generateStaticParams`, or the build fails. `dynamicParams` is not available.
  - `notFound()` inside a streamed segment renders the not-found UI with HTTP 200 (the shell has already streamed). Test the UI, not the status.
  - `error.tsx` receives `retry()` (stable since 16.3). Use it instead of `reset()`.
  - Visited routes stay mounted but hidden via React `<Activity>`. State such as open dialogs survives navigation. See `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`.
- **Tailwind CSS v4.** There is no `tailwind.config`. Tokens live in `src/app/globals.css` (`@theme inline`). They are the values measured from the references.
- **Font: Arimo** (D4), loaded with `next/font/google` at weights 400 and 700. Use 700 for emphasis (Arimo has no 600). Several reference sizes are fractional (for example nav 14.4 px), so keep the shared values as they are.
- **shadcn/ui (radix-nova, `radix-ui`)**, restyled to the references. Forms use the `Field` components plus `NativeSelect`/`RequiredMark` (`src/components/shared/form.tsx`).
- **TanStack Table v8**, Zod v4, React Hook Form 7 with `@hookform/resolvers` v5, Recharts v3, date-fns v4.
- **Node 20.20 is installed** (end of life; upgrading to 22 LTS is recommended). Vitest is pinned to 4.x and jsdom to 29.x because their newest majors need Node 22+.

## Where code goes

| Path | Contents | Owner |
| --- | --- | --- |
| `src/app/(app)/<route>/page.tsx`, `src/app/(staff)/home/`, `src/app/(auth)/<route>/` | Thin route: await the feature's query, render a feature component | Screen agent |
| `src/features/<feature>/` | Feature UI, column definitions, feature-only logic and its tests | Screen agent |
| `src/features/<feature>/data/` | **Screen-specific** typed fixtures (`fixtures.ts`) and query functions (`queries.ts`) | Screen agent (D2) |
| `e2e/<agent-name>.spec.ts` | Browser tests for the agent's screens | Screen agent |
| `src/components/ui/` | shadcn primitives (restyled) | Orchestrator |
| `src/components/layout/` | `AppShell`/`AppSidebar` (with the user menu), `PageHeader`, `PageContainer`, `RouteTabs`, `AuthLayout`, `RoutePlaceholder` | Orchestrator |
| `src/components/shared/` | Cross-screen components and `notInPrototype` (docs/component-contract.md) | Orchestrator |
| `src/types/domain.ts` | Shared data contracts (stages, tones, terms, currency, roles, master entities) | Orchestrator |
| `src/mocks/data/master.ts` | **Shared master** fixtures: suppliers, agents, transport companies, offices/warehouses, teams, items, users, roles, current users | Orchestrator |
| `src/lib/data/master.ts` | Async accessors for master data | Orchestrator |
| `src/lib/`, `src/config/` | Formatters, constants (`MOCK_TODAY`), navigation | Orchestrator |
| `src/app/layout.tsx`, `globals.css`, route-group layouts and boundaries, `/preview` | Root layout, font, tokens, shells, component preview | Orchestrator |
| `src/app/(app)/orders/[po]/layout.tsx`, `src/features/order-detail/shared/` | Order-detail header, tabs, context strip (shared by two agents) | Orchestrator |
| `e2e/shell.spec.ts`, `scripts/`, `package.json`, lockfile, configs, `CLAUDE.md`, `.claude/`, `docs/` | Shell tests, tooling and process | Orchestrator |

Create a feature folder only when a screen is assigned. Do not create empty modules.

## Rules

**Components**
- Server Components by default. Add `"use client"` only for state, effects, event handlers, or browser-only libraries. Keep it at the leaf.
- Reuse `src/components/shared`, `src/components/layout` and `src/components/ui` before writing anything new. Never copy a shared component into a feature folder to change it. Ask the orchestrator to extend the contract instead.
- Colors, radii, spacing and fonts come from tokens (`bg-primary`, `text-danger`, `bg-success-soft`, `p-(--page-padding)`). No raw hex, rgb or oklch values in feature code. Pixel sizes measured from a reference (`h-[58px]`) are allowed.
- Use `cn()` from `@/lib/utils` for class merging and the `@/` import alias everywhere.

**Data (D1, D2)**
- **Screenshot-faithful:** each screen's fixture reproduces the records in its own screenshot, even when another screenshot disagrees. Never change visible screenshot content to make records consistent. Log every deliberate difference in the screen report; the orchestrator keeps them in `docs/screenshot-inventory.md` §9.
- **Dependency direction:** `components → data/queries.ts → data/fixtures.ts`. UI components never import fixtures directly. Queries are `async`, so a real API can replace them later.
- **Shared master data and contracts** (`src/types`, `src/mocks`, `src/lib/data`, formatters, `MOCK_TODAY`) are orchestrator-owned. Screen agents import them but never modify them. If a field is missing, request it.
- Store values the screenshot states (dates, statuses, labels such as "Late 4 days") as fixture values. Compute them only when the computation reproduces the screenshot exactly. Some screens are snapshots taken after `MOCK_TODAY` (30 Sep 2026).
- Never hardcode business records in JSX. Static UI copy is fine.
- Fixtures are deterministic: no `Math.random()`, no `Date.now()`/`new Date()` without a fixed input.
- No fake API routes, no `localStorage` persistence, no pretending data was saved to a server.
- Mock mutations (add, edit, delete) live in the screen's client state, seeded from the loaded data, and reset on reload. Mark the state with `// Mock mutation: client state only, resets on reload` and say so in the screen report.
- Format money, numbers and dates with `src/lib/formatters.ts` (`formatINR`, `formatCNY`, `formatLakh`, `formatRate`, `formatQty`, `formatDate`, …): INR and CNY both use Indian digit grouping.

**Reference fidelity (D3, D5, D6)**
- **The reference screenshots are the source of truth.** Recreate them. Do not redesign, simplify, or "improve" them.
- **D3:** do not render the screenshot annotation labels ("1.1", "3.1.a", "13.4", …, header-left and bottom-right). Tab letter and number chips are real UI (`RouteTabs`).
- **D5:** never invent pages, dialogs or workflows for actions without a reference design. Call `notInPrototype("<Action label>")` from `@/components/shared/prototype`.
- **D6:** the ADMIN nav (Settings, Users) is always visible to Management, and every calendar view shows the Month, Week and List tabs. Only a screenshot that clearly shows a role-specific restriction (the staff sidebar, 39) overrides this.
- **B3:** the sidebar user block opens a menu with My profile, Notifications and Sign out. It is the only shell interaction without a reference.

**Types and quality**
- TypeScript strict. No `any` (lint error), no `@ts-ignore`/`@ts-expect-error`, and no `eslint-disable` to get past a check (the one documented exception is listed below).
- Accessible by default: semantic elements, labelled controls, keyboard-reachable actions, visible focus, one `h1` per page (from `PageHeader`).
- Desktop 1440 × 900 matches the references. Narrower widths are not designed: never scroll the page horizontally (down to 360 px). Wide tables scroll inside their card, and the sidebar becomes a sheet below 768 px.

**Testing**
- Vitest + React Testing Library tests sit next to the code as `*.test.ts(x)`. Test logic and component behavior, not markup snapshots.
- Playwright specs live in `e2e/`. Use role/label locators (`getByRole`, `getByLabel`), because hidden `<Activity>` routes stay in the DOM.
- Async Server Components cannot be rendered in Vitest. Cover them with Playwright.

## Screenshot-fidelity workflow (every screen)

1. Open every assigned reference (2880 × 1800 = 1440 × 900 at 2×) before coding. Note layout, spacing, type, colors, borders, tables, tabs, icons and every visible state.
2. Build only from the shell, the shared components and the tokens.
3. Run the app on your assigned port and compare at the reference size:
   `node scripts/visual-diff.mjs --url http://localhost:<port>/<route> --ref "<absolute reference path>" --out .visual/<route>`.
   Use `--region` to compare parts, for example `240,0,1200,900` for the content area without the sidebar.
4. Open `.visual/<route>/compare.png` (reference | ours | diff). Fix every visible mismatch that is not an annotation label (D3) or a D6 normalization, then repeat.
   For calibration, the shared shell scores mean diff 2–5/255 per region against the references.
5. Report the regions compared, the final numbers, and any remaining named differences. **Never claim pixel-perfect.**

## Impeccable (design skill): status and allowed use

- **Status (verified 2026-10-23): installed at project scope.** Source: github.com/pbakaus/impeccable, docs at impeccable.style.
  - Skill `.claude/skills/impeccable/` (skill 4.7.0, engine 0.1.16). Invoke as `/impeccable <command> [target]`.
  - Four agents, `.claude/agents/impeccable-*.md`. Only `new-work` and `live` use them, and neither is allowed here, so they stay idle.
  - Design hook in `.claude/settings.local.json`: per machine, not committed. Settings live in `.impeccable/`.
  - **Not run yet:** `/impeccable init` (writes `PRODUCT.md`) and `/impeccable document` (writes `DESIGN.md` from the code). The user or the orchestrator runs them.
- **Discovery:** a session ignores a `.claude/skills/` directory created after it started. Run `/reload-skills` or start a new session. This is why `/impeccable init` returned `Unknown command` in the session that was open during the install.
- **CLI:** `.claude/skills/impeccable/scripts/impeccable detect <path|url>` from Git Bash, or `impeccable.cmd` from PowerShell. Use this launcher rather than `npx impeccable`, so the engine matches the skill.
  - The 20 MB engine under `scripts/bin/` is git-ignored. Without it, the launcher downloads a checksum-verified copy (network needed).
  - A worktree therefore has no engine, so call the main checkout's launcher by its absolute path.
  - A path scan uses regex rules only. Scan the running URL for the full rule set.
- **Hook:** after every Edit/Write of a UI file (`.tsx`, `.ts`, `.css`, …), it runs the immediate-tier rules and posts its findings into context. `Stop` runs the full deep pass. It never blocks an edit.
  - Its message invites the agent to add ignores itself. **In this project only the orchestrator adds ignores.**
  - The screen-agent guard blocks `impeccable hooks` (except `status`), `ignores`, `install`, `update`, `pin` and `link`.
- **It is a QA aid only.** It never authorizes redesign, and the reference screenshot always wins over its suggestions.
  - **Allowed:** `/impeccable audit <target>` and `/impeccable critique <target>` (reports), `detect` (deterministic anti-pattern scan), and `/impeccable hooks status`.
  - **Orchestrator or user only:** `init`/`teach`, `document`, `doctor`, `pin`, and `hooks on|off|ignore-*|reset`.
  - **Handling findings:** fix findings that the reference does not contradict (accessibility, overflow, broken states). A finding that conflicts with the reference (for example the gradient sidebar, the selected-row side stripe, or the Arial-metric font) is reported and **not changed**. The orchestrator records it as an Impeccable ignore with the reason "matches reference screenshot".
  - **Not allowed on referenced screens:** `craft`, `shape`, `bolder`, `quieter`, `colorize`, `typeset`, `layout`, `animate`, `delight`, `overdrive`, `distill`, `polish`, `live`, `generate`, `adapt`, `harden`, `onboard`, `clarify`, `optimize`, `extract`. They change the design or copy. The orchestrator may approve one explicitly for undesigned states.

## Known, accepted warnings and exceptions

- `react-hooks/incompatible-library` warning on `useReactTable` in `src/components/shared/data-table.tsx`. React Compiler is off, so it is informational.
- One `eslint-disable-next-line @typescript-eslint/no-unused-vars` in `data-table.tsx`: TanStack's `ColumnMeta` augmentation must repeat the library's unused type-parameter names.
- `npm audit` reports `braces` (via ESLint/shadcn CLI tooling). Dev-only, and no patched version exists. `npm audit --omit=dev` is clean.

## Multi-agent work

Read docs/multi-agent-plan.md before spawning or acting as a screen agent. Screen agents use
`.claude/agents/screen-builder.md`. A hook in that file blocks installs, Impeccable setup commands, `git push`,
and edits to orchestrator-owned paths.
