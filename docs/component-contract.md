# Shared Component Contract

These are the shared building blocks every screen uses (Phase 2, measured from the references). The orchestrator
owns them. Screen agents use them as documented and never copy, fork, or edit them. If a screen needs a change, the
agent reports it with exact values, and the orchestrator changes the contract and updates every consumer.

Living examples: **`/preview`** (`src/app/(app)/preview/`). Geometry is in CSS px at the 1440 × 900 reference.

## Layout (`src/components/layout`)

| Component | Kind | Contract |
| --- | --- | --- |
| `AppShell` | Server | Applied by the `(app)` and `(staff)` group layouts with the mock current user. Screens never render it. |
| `AppSidebar` / `MobileNav` | Client | 240 px navy-gradient sidebar: brand, sections (main, STAGES, MANAGEMENT, ADMIN), square bullets, active item, and the user block that opens the B3 menu (My profile, Notifications, Sign out). Navigation comes from `src/config/navigation.ts`. Below 768 px it opens in a sheet. |
| `PageHeader` | Server | **First element of every page.** 68 px header bar. Props: `title` (the page's only `h1`, 21 px bold), `parent?: { label, href }` (breadcrumb "Orders / **PO-2028**"), `titleAddon?` (for example `<StatusPill tone="neutral">Management only</StatusPill>`), `actions?` (search, `FilterSelect`, `TodayPill`, buttons; 14 px gap). |
| `PageContainer` | Server | Page body after the header (and tabs): 22 px top, 32 px sides, 18 px gap. |
| `RouteTabs` | Client | 46 px tab bar. Props: `tabs: { href, label, chip }[]`, `label` (accessible name). Active means the exact pathname: blue chip, bold blue label, 3 px underline. Render it after `PageHeader` in a route layout or page. |
| `AuthLayout` | Server | Applied by the `(auth)` group: 700 px navy panel (brand, "Import Tracking System", six stages) plus a centered 454 px card with 48 px padding. Auth pages render only the card content. |
| `RoutePlaceholder` | Server | Orchestrator placeholder. Screen agents replace the whole `page.tsx`. |

## Shared (`src/components/shared`)

| Export | Kind | Props and usage |
| --- | --- | --- |
| `SectionCard` | Server | `title?`, `aside?` (use `CardLink` for "View all orders" or `CardNote` for muted notes), children. 12 px radius, 1 px border, padding 16/20/20, 16 px bold title. `titleGap?: "default" \| "none"`: 16 px between the title row and the content, or none, so a `density="dense"` table header sits right under the title (dashboard). |
| `CardLink`, `CardNote` | Server | Right-side title-row link (15 px bold primary; `size="sm"` 13 px, dashboard) and muted note (14 px). |
| `KpiCard`, `KpiRow` | Server | `KpiCard`: `label`, `value`, `sub?`, `tone?: "default" \| "danger"` (strong red value), `size?: "default" \| "sm"` (106 px tall, or 104 px with tighter spacing, dashboard). `KpiRow`: equal-width cards, `gap?: "default" \| "sm"` (18 px, or 16 px on the dashboard). |
| `Callout` | Server | `tone?: "info" \| "success" \| "warning"`. Tinted note box (warning has a border, as in the week view's late banner). |
| `TodayPill` | Server | `style?: "today" \| "weekday"`, giving "Today, 30 Sep 2026" or "Wed, 30 Sep 2026" from `MOCK_TODAY`. `size?: "default" \| "sm"`: 14 px text, or 13.5 px (dashboard). |
| `StatusPill` | Server | `tone: "danger" \| "warning" \| "success" \| "info" \| "purple" \| "neutral"`. 20 px pill, 12 px bold. |
| `TermsBadge` | Server | `terms: "FOB" \| "CNF"`, `size?: "sm" \| "md"`. Boxed FOB (info) and CNF (purple). |
| `KeyValueList` | Server | `items: { label, value, muted? }[]`, `total?: { label, value }` (under a 2 px navy rule), `boldValues?`. |
| `ProgressBar` | Server | `value`, `max`, `label`, `size?: "lg" (18 px) \| "sm" (8 px)`. |
| `StageProgress` | Server | `stage: 1–6`. Six 16 × 6 segments plus caption "2. Receiving in China" (orders list). |
| `StackedBar`, `LegendSwatch` | Server | `segments: { label, value, color: "chart-1".."chart-4" }[]`. 34 px bar. The screen renders its own legend rows using `LegendSwatch`. |
| `Journey` | Server | `steps: { title, lines?, marker, number? }[]`, `align?: "center" \| "edges"`. Horizontal steps (order journey: all `check`; container route: `dot`/`ring` with `edges`). |
| `Timeline` | Server | `items: { title, detail?, marker, number? }[]`. Vertical list. Markers: `check` (done), `current` (blue ring + number), `pending` (grey ring + number), `dot`, `ring`. |
| `BarChart` | Client | `data: { label, value }[]`, `label` (accessible), `formatValue?`, `className` (set the height, e.g. `h-72`). Value labels above bars; zero values show a track-colored stub. |
| `DataTable` | Client | See below. |
| `FilterChips` | Client | `options: { value, label, tone?: "danger" }[]`, `value`, `onValueChange`, `label`, `variant?: "chips" \| "segmented"`. Labels include counts exactly as shown ("All 50", "Active (6)"). |
| `FilterSelect` | Client | `label`, `showLabel?` ("Stage  All stages ▾"), `value`, `options`, `onValueChange`. A 40 px button that opens a radio menu. The trigger renders before hydration. |
| `SearchInput` | Client | `label` (accessible), `inlineLabel?` ("Search" prefix on settings and users), `placeholder`, `value`, `onValueChange`, `size?: "default" \| "sm"`. No icon. Default 40 px with 15 px text; `sm` 38 px with 13.5 px text (the dashboard header search). Set the width with `className` (`w-[250px]` in the header). |
| `RequiredMark`, `NativeSelect`, `FormFooter` | Server-safe | Red `*` after a label, a 42 px native select with ▼, and right-aligned form actions (use `Button size="lg"`). |
| `notInPrototype(action)` | Client fn | **D5.** Shows the toast "⟨action⟩ is not included in the current prototype." The only allowed behavior for undesigned actions. |
| `LoadingState`, `EmptyState`, `ErrorState` | Server-safe | Used by the `(app)` loading and error boundaries and by placeholders. |

### DataTable (`@/components/shared/data-table`)

| Prop | Contract |
| --- | --- |
| `columns`, `data`, `getRowId?` | TanStack v8 column definitions. The caller filters `data`. |
| `density?` | `dense` (dashboard cards, 04): 12 px headers in a 36 px header row, 13.5 px cells, rows sized by 9 px padding around a 16 px line (35 px text rows, 39 px rows with a `StatusPill`), 6 px outer cell padding in `plain`. Pair it with `SectionCard titleGap="none"`. `compact` (39 px rows, 36 px header), `default` (53 px, settings), `tall` (58 px, orders). Header 13 px and cells 14 px unless `dense`. |
| `variant?` | `card` (bordered box with a tinted header, list pages) or `plain` (no box, white header, tables inside a `SectionCard`). |
| column `meta` | `{ align?: "left" \| "right" \| "center", className? }`. Numbers are right-aligned. |
| column `footer` | Any column with `footer` makes a totals row under a 2 px navy rule ("Total, 4 containers"). |
| `selectedRowId?`, `onRowClick?` | Selected row: blue tint plus a 3 px primary left bar. |
| `pagination?` | `{ pageSize, rowCount?, itemLabel?, onPageChange? }`. Shows "Showing 1 to 10 of 50 orders" and ‹ 1 … › boxed pages. With `rowCount`, only the current page is loaded (manual mode). Omit it to show all rows. |
| `emptyState?` | Shown when there are no rows. |

## UI primitives (`src/components/ui`, shadcn radix-nova, restyled)

`button` (variants `default` / `outline` / `ghost` / `link` / `destructive`; sizes `default` 36 px, `sm`, `lg` 46 px
form buttons, `icon`, `icon-sm`), `input` (42 px; `readOnly` gets the grey fill; `className="border-dashed"` for empty
optional fields), `textarea`, `checkbox` (20 px), `switch` (38 × 22), `dialog` (16 px radius, navy 50% overlay, 22 px
title), `dropdown-menu`, `sheet`, `tooltip`, `sonner`, `chart`, `field`, `label`, `separator`, `skeleton`, `spinner`,
`empty`, `table`.

Not installed: the Radix select, card, badge, breadcrumb, link pagination and alert-dialog (superseded by the components
above or not in the references). Request anything missing from the orchestrator.

## Toasts

`<Toaster />` is mounted once in the root layout. Use `notInPrototype` for undesigned actions, and `toast` from `sonner`
only where a reference shows feedback. Never mount another `Toaster`.

## Forms

React Hook Form, Zod v4 and the shadcn `Field` components, as in the `/preview` form kit:

```tsx
<Field>
  <FieldLabel htmlFor="delivery-date">Delivery date <RequiredMark /></FieldLabel>
  <Input id="delivery-date" required {...field} aria-invalid={fieldState.invalid} />
  <FieldError errors={[fieldState.error]} />
</Field>
```

- Selects in forms use `NativeSelect`. Filter dropdowns in toolbars use `FilterSelect`.
- Number inputs: `onChange={(e) => field.onChange(e.target.valueAsNumber)}` and `value={Number.isNaN(field.value) ? "" : field.value}`.
- Put each schema in the feature folder next to its form.

## Data contract (D1, D2)

| Layer | Path | Owner | Contract |
| --- | --- | --- | --- |
| Shared types | `src/types/domain.ts` | Orchestrator | `STAGES`, `StageNumber`, `Tone`, `Terms`, `Currency`, `Role`, `Access`, and the master entity types (`Supplier`, `ShippingAgent`, `ClearingAgent`, `TransportCompany`, `Location`, `Team`, `ItemMaster`, `User`, `RoleMatrixRow`, `CurrentUser`) |
| Master fixtures | `src/mocks/data/master.ts` | Orchestrator | Transcribed from references 40–49. Canonical. |
| Master accessors | `src/lib/data/master.ts` | Orchestrator | `listSuppliers`, `listShippingAgents`, `listClearingAgents`, `listTransportCompanies`, `listLocations`, `listTeams`, `listItems`, `listUsers`, `getRoleMatrix`, `getCurrentUser(variant)`. All async, returning deep copies. |
| Formatters and clock | `src/lib/formatters.ts`, `src/lib/constants.ts` | Orchestrator | `formatINR(n, decimals?)`, `formatCNY(n, { decimals?, spaced? })`, `formatLakh`, `formatRate`, `formatQty(n, unit)`, `formatNumber`, `formatDate`, `formatShortDate`, `formatDateTime`, `formatRelativeDateTime`, `formatToday`. `MOCK_TODAY = "2026-09-30"`. |
| Order-detail header | `src/features/order-detail/shared/` | Orchestrator | `getOrderDetailHeader(po)`, `listOrderDetailPOs()`, `OrderContextStrip({ po, fact })` for tabs b–i |
| Screen fixtures | `src/features/<feature>/data/fixtures.ts` | Screen agent | Typed and deterministic, reproducing **its own screenshot exactly** (D1) |
| Screen queries | `src/features/<feature>/data/queries.ts` | Screen agent | Async functions. The only importers of `fixtures.ts`. |

Rules:
- Dependency direction: `page.tsx → queries.ts → fixtures.ts` (plus master accessors). Components receive data as props.
- Screen fixtures may reference master records and define screen-local view types. Shared types and master data are never edited by screen agents. Request missing fields instead.
- Deliberate differences from other screens go in the agent's report. The orchestrator logs them in `docs/screenshot-inventory.md` §9.

## Tokens (`src/app/globals.css`)

Measured values (inventory §4), exposed as Tailwind colors:
- **Surfaces:** `background`, `card`, `border`, `border-subtle`, `table-head`, `table-head-foreground`, `input`, `input-background`, `input-readonly`, `placeholder`, `chip-muted`, `toggle-off`.
- **Text and brand:** `foreground`, `muted-foreground`, `label`, `primary`, `navy`, `overlay`.
- **Status tones:** `danger | warning | success | info | purple | neutral` plus `-soft` backgrounds, `danger-strong`, `success-strong`, `purple-border`.
- **Callouts:** `callout-info(-foreground)`, `callout-success-foreground`, `callout-warning(-border|-foreground)`.
- **Sidebar:** `sidebar-from|to|foreground|accent|muted|detail|bullet|border|avatar`.
- **Charts:** `chart-1..5`, `chart-track`.
- **Radii:** sm 4, md 6, lg 8, xl 12, 2xl 16.
- **Layout variables:** `--sidebar-width` 240, `--header-height` 68, `--tabs-height` 46, `--page-padding` 32, `--page-padding-top` 22, `--page-gap` 18.

## Changing this contract

1. A screen agent reports the need with exact props or values.
2. The orchestrator implements it between waves, updates this document and `/preview`, and fixes every consumer.
3. The change is committed to `main` before any agent depends on it.
