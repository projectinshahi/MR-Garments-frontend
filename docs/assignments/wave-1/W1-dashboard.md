# Screen Assignment: Management dashboard

## Identity
- **Agent:** `W1-dashboard`
- **Screen:** Management dashboard
- **Route:** `/` (`src/app/(app)/page.tsx`, currently a placeholder)
- **Dev port:** `3001` | **E2E_PORT:** `3101`

## Reference screenshots (inspect all, and only these)
| File (absolute path) | Variant / state | Notes |
| --- | --- | --- |
| `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\04_2_Dashboard.jpeg` | desktop, default, Management user | The sidebar has no ADMIN section here. The shared shell adds it (D6), so compare `--region 240,0,1200,900` |

## Owned paths
- `src/app/(app)/page.tsx`
- `src/features/dashboard/**` (including `data/fixtures.ts`, `data/queries.ts`)
- `e2e/w1-dashboard.spec.ts`

## Read-only inputs
- `PageHeader`, `PageContainer`, `KpiRow`/`KpiCard`, `SectionCard`/`CardLink`, `ProgressBar`, `DataTable` (`variant="plain"`, `density="compact"`), `StatusPill`, `SearchInput`, `TodayPill`, `notInPrototype`
- `formatINR`, `formatLakh`, `formatShortDate`, `MOCK_TODAY`

## Data (D1)
Transcribe every visible record:
- 5 KPI cards. "Late deliveries" uses `tone="danger"`. "₹42.6 L" uses `formatLakh`.
- 6 "Orders by stage" rows: 14, 9, 11, 5, 4, 7.
- 5 late and upcoming deliveries.
- 4 payments due.
- 4 containers on the way.

Calendar screens show other items for some of these POs (inventory §9). Keep the dashboard values as shown.

## Required behavior
- **Header:** title "Dashboard". Actions: `SearchInput` ("Search PO, supplier, container", about 250 × 38) and `TodayPill`. Pressing Enter in the search calls `notInPrototype("Search")`, since no results view exists.
- **KPI row:** Active orders, Due in next 7 days, Late deliveries, Containers on the way, Payments due (INR).
- **Grid:** two rows of two `SectionCard`s.
  - "Orders by stage" (aside link "View all orders" to `/orders`) holds label, bar and count rows.
  - "Late and upcoming deliveries" (aside link "Open calendar" to `/calendar`) has columns PO, Supplier, Due date, Status pill.
  - "Payments due" (aside link "All payments" to `/payments`) has columns Supplier, PO, Payment, Due, Amount (INR), with the amount right-aligned.
  - "Containers on the way" (aside link "All containers" to `/containers`) has columns Container, Agent, Terms (plain text), ETA India.
- **States:** none beyond the default.

## Out of scope
The destination screens of the links (other agents).

## Acceptance
- [ ] `visual-diff` content region `240,0,1200,900` reviewed and remaining differences listed
- [ ] Shared components and tokens only; fixtures read only through `data/queries.ts`
- [ ] lint, typecheck, test pass; `e2e/w1-dashboard.spec.ts` passes with `E2E_PORT=3101`
- [ ] Report in the screen-builder format
