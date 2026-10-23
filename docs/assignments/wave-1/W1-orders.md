# Screen Assignment: Orders list

## Identity
- **Agent:** `W1-orders`
- **Screen:** Orders list
- **Route:** `/orders` (`src/app/(app)/orders/page.tsx`)
- **Dev port:** `3002` | **E2E_PORT:** `3102`

## Reference screenshots
| File (absolute path) | Variant / state | Notes |
| --- | --- | --- |
| `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\05_3_Orders_list.jpeg` | desktop, "All 50" active, page 1 of 5 | No ADMIN section in this shot (D6 adds it) |

## Owned paths
- `src/app/(app)/orders/page.tsx`
- `src/features/orders/**`
- `e2e/w1-orders.spec.ts`

Not yours:
- `orders/new` (W2-new-order)
- `orders/[po]/**` (order-detail agents and the orchestrator)

## Read-only inputs
`PageHeader`, `PageContainer`, `SearchInput`, `FilterSelect` (`showLabel`), `FilterChips`, `DataTable` (`density="tall"`, `pagination`),
`StageProgress`, `StatusPill`, `Button`, `notInPrototype`, `formatINR`, `formatQty`, `formatShortDate`, and `listSuppliers` (for the supplier options).

## Data (D1)
- Transcribe the 10 visible rows exactly: PO-2049, 2047, 2044, 2041, 2038, 2035, 2031, 2028, 2024, 2019.
- Each row has item, supplier, quantity and unit, delivery date, stage 1–6, status label and tone, and paid so far (INR).
- The total is 50 orders: use `pagination={{ pageSize: 10, rowCount: 50, itemLabel: "orders", onPageChange }}`. Pages 2–5 are not designed, so `onPageChange` calls `notInPrototype("More orders")`.
- PO-2028 here is at stage 4, "In clearing", while the order detail shows it received. Keep both (inventory §9).

## Required behavior
- **Header:** title "Orders". Action: primary "+ New order", a link to `/orders/new`.
- **Filter row:**
  - `SearchInput` ("Search PO, item or supplier").
  - `FilterSelect` "Stage / All stages".
  - `FilterSelect` "Supplier / All suppliers".
  - `FilterChips`: All 50 (active), Late 3 (danger tone), Due soon 5, Short received 2, Completed. The labels are static, as shown.
  - Search, selects and chips filter the transcribed rows client-side.
- **Table:** PO (bold), Item, Supplier, Quantity, Delivery date, Stage (`StageProgress`), Status (`StatusPill`), Paid so far (INR) (right-aligned).
- **Rows:** PO-2028 links to `/orders/PO-2028`. Every other row calls `notInPrototype("Order detail for <PO>")`, since only PO-2028 has a detail design.

## Out of scope
New order form, order detail.

## Acceptance
- [ ] `visual-diff` content region reviewed; differences listed
- [ ] lint, typecheck, test pass; `e2e/w1-orders.spec.ts` passes with `E2E_PORT=3102`
- [ ] Report, including the PO-2028 data difference
