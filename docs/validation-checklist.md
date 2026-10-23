# Validation Checklist

Run this after the foundation changes, after merging each screen, and before calling a phase done.
Record the actual result. Never mark an item done without running it.

## Automated
- [ ] `npm ci` installs cleanly (lockfile consistent, no new peer-dependency errors)
- [ ] `npm run lint`: 0 errors (only the documented `incompatible-library` warning)
- [ ] `npm run typecheck`: 0 errors
- [ ] `npm run test`: all Vitest tests pass
- [ ] `npm run build`: succeeds, and the route table lists every expected route
- [ ] `npm run test:e2e`: all Playwright specs pass
- [ ] `npm audit --omit=dev`: 0 vulnerabilities (dev-only advisories noted in CLAUDE.md)

## Runtime
- [ ] `npm run dev` starts and every nav route renders without console or server errors
- [ ] `/preview` still renders every shared component correctly after token changes
- [ ] No hydration warnings in the browser console

## Visual fidelity (per screen)
- [ ] Each reference screenshot compared with `node scripts/visual-diff.mjs` at 1440 × 900 (2×), with `compare.png` reviewed and the mean diff recorded
- [ ] Layout, spacing, typography, colors, borders, shadows, icons, and alignment match. Remaining differences are listed
- [ ] Every visible state in the references (empty, error, dialog, menu) is reproducible with the fixtures
- [ ] Mobile/tablet variants checked where references exist. Otherwise no horizontal scroll at 360px

## Architecture and rules
- [ ] Route files are thin. Logic lives in `src/features`, shared code in shared folders
- [ ] No imports of `src/mocks` outside `src/lib/data` and tests. A feature's `data/fixtures.ts` is imported only by that feature's `data/queries.ts` (D2)
- [ ] Screen fixtures match their screenshots exactly, and every deliberate difference is logged in `docs/screenshot-inventory.md` §9 (D1)
- [ ] Screen agents did not modify shared master data or contracts (`src/types`, `src/mocks`, `src/lib/data`)
- [ ] No annotation labels ("3.1.a" and so on) rendered (D3)
- [ ] Every undesigned action calls `notInPrototype`; no invented pages, dialogs or flows (D5)
- [ ] ADMIN nav visible on all Management screens, and all calendar views show Month, Week and List tabs (D6)
- [ ] Font renders as Arimo and matches the references in an overlay check (D4)
- [ ] No hardcoded colors, business records in JSX, `any`, or lint/type suppressions
- [ ] No duplicated shared components in feature folders
- [ ] `"use client"` only where needed
- [ ] Mock mutations are client-state only, commented, and reported
- [ ] `docs/component-contract.md` and `docs/screenshot-inventory.md` reflect the current code

## Accessibility
- [ ] One `h1` per page, logical heading order
- [ ] Every control has an accessible name, and icon-only buttons have `aria-label`
- [ ] Full keyboard path: sidebar, filters, table sorting and pagination, dialogs (focus trap, Esc), menus
- [ ] Visible focus styles. Status is not conveyed by color alone (badges have text)

## Multi-agent integration
- [ ] Each agent's diff touches only its owned paths
- [ ] Each agent's report is reviewed, and its orchestrator requests are resolved or tracked
- [ ] Branches merged one at a time with the automated checks re-run after each merge
- [ ] Leftover worktrees under `.claude/worktrees/` removed after merge
