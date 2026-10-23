# Screen Assignment: `<screen name>`

> The orchestrator copies this template, fills every field, commits shared preparation to `main`, and passes
> the completed text as the `screen-builder` agent's prompt. Delete these quoted instructions.
> The matrix row is in `docs/proposed-build-plan.md` §6. The route mapping is in `docs/screenshot-inventory.md` §5.

## Identity
- **Agent:** `<e.g. W1-orders>`
- **Screen:** `<e.g. Orders list>`
- **Route(s):** `<e.g. /orders>`. The `/` dashboard is `src/app/(app)/page.tsx`.
- **Dev port:** `300<n>` | **E2E_PORT:** `310<n>`

## Reference screenshots (inspect all, and only these)
Use absolute paths into the **main checkout** (the reference folder may not exist in your worktree). All references
are 2880 × 1800 (1440 × 900 at 2×). Ignore annotation labels such as "3.1.a" (D3).

| File (absolute path) | Variant / state | Notes |
| --- | --- | --- |
| | desktop, default / dialog-open / … | |

## Owned paths (the only files you may create or modify)
- `src/app/(app)/<route>/**`
- `src/features/<feature>/**`, including `data/fixtures.ts` and `data/queries.ts` (D2)
- `e2e/<agent-name>.spec.ts`

## Read-only inputs you will use
- Shared components: `<e.g. PageHeader, KpiRow, FilterChips, DataTable, StatusPill>`
- Shared types and master data: `<e.g. Supplier, Stage from src/types; suppliers from src/lib/data/suppliers>`
- Formatters and clock: `<e.g. formatINR, formatDate, MOCK_TODAY>`
- Token or shell notes from the screenshot inventory: `<anything specific to this screen>`

## Data (D1)
- Records to transcribe from the screenshots: `<e.g. 10 order rows, page 1 of 5, KPI values>`
- Known differences from other screens (inventory §9): `<e.g. PO-2044 item differs from Calendar>`. Keep yours as shown.

## Required behavior
- `<visible elements, in reference order>`
- `<interactions: search fields, filters, sorting, pagination, dialogs, menus>`
- `<states to show: empty, loading, error, validation>`
- `<mock mutations, if any: what changes in client state; resets on reload>`
- Actions with no reference design (D5): `<e.g. "Record payment" → notInPrototype("Record payment")>`

## Out of scope
- `<related screens owned by other agents; links to their routes are fine>`

## Acceptance
- [ ] Every listed reference compared at 1440 × 900, with remaining differences listed in the report
- [ ] Only shared components and tokens; no hardcoded colors; no records in JSX
- [ ] Fixtures live in `data/fixtures.ts`, are read only through `data/queries.ts`, and match the screenshots exactly. Deliberate differences are reported
- [ ] Undesigned actions use `notInPrototype`; no annotation labels rendered
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` pass
- [ ] `e2e/<agent-name>.spec.ts` covers the main flow and passes with the assigned `E2E_PORT`
- [ ] Keyboard-accessible, labelled controls, one `h1`
- [ ] Final report in the format from `.claude/agents/screen-builder.md`
