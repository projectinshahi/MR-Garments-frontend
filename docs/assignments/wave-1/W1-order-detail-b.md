# Screen Assignment: Order detail, tabs f–i (PO-2028)

## Identity
- **Agent:** `W1-order-detail-b`
- **Screen:** Order detail tabs f Clearing & transport, g Warehouse, h Cost, i History
- **Routes:** `/orders/[po]/clearing-transport`, `/warehouse`, `/cost`, `/history`
- **Dev port:** `3004` | **E2E_PORT:** `3104`

## Reference screenshots
Each file is in `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\`.

| File | Tab |
| --- | --- |
| `11_3.1.f_Clearing_&_transport.jpeg` | f Clearing & transport |
| `12_3.1.g_Warehouse.jpeg` | g Warehouse |
| `13_3.1.h_Cost.jpeg` | h Cost |
| `14_3.1.i_History.jpeg` | i History |

## Owned paths
- `src/app/(app)/orders/[po]/{clearing-transport,warehouse,cost,history}/page.tsx`
- `src/features/order-detail/{clearing-transport,warehouse,cost,history}/**`
- `e2e/w1-order-detail-b.spec.ts`

**Not yours:**
- The frame (`orders/[po]/layout.tsx`) and `src/features/order-detail/shared/**`, both orchestrator-owned.
- Tabs a–e (W1-order-detail-a).

## Read-only inputs
- `OrderContextStrip({ po, fact })`, `PageContainer`, `SectionCard`, `KeyValueList`, `KpiRow`/`KpiCard`, `DataTable` (with a `footer` totals row), `Callout`.
- `StackedBar`/`LegendSwatch`, `StatusPill`.
- Formatters: `formatINR`, `formatDate`, `formatDateTime`.

## Data (D1)
Transcribe each tab exactly.

## Required behavior
**f Clearing & transport:**
- **Strip:** "Container CAIU 2298076".
- **Two cards:**
  - "Clearing in India": bold facts, then muted cost rows, then the total "Total clearing cost ₹3,70,500".
  - "Transport to warehouse": facts, then muted charges, then the total "Total transport cost ₹26,500".

**g Warehouse:**
- **Strip:** "Received 3 Oct 2026".
- **KPIs:** Received in warehouse, Received on, Received by.
- **"Given to teams":** bordered table with Team, Pieces, Share, Cost per piece, Cost, and a Total row.
- **"Check":** two success callouts and one info callout.

**h Cost:**
- **Strip:** "Landed cost ₹13,77,000".
- **"Cost breakdown":** bordered table with Cost part, Detail, Amount (INR), Per piece, and a total row "Landed cost · 2,500 pcs".
- **"Where the money goes":** `StackedBar` (goods `chart-1`, duty `chart-2`, transport `chart-3`) plus legend rows with label, small percentage, and value on the right.
- **"Per piece":** big "₹550.80", the formula line, and `StatusPill tone="neutral"` "Management only".

**i History:**
- **Strip:** "Everything that happened, newest first".
- **Bordered table:** When, Who (bold), Team, What happened (bold title plus muted detail line), with 12 rows.

## Out of scope
Tabs a–e, and the frame actions.

## Acceptance
- [ ] `visual-diff` per tab (content region) reviewed; differences listed
- [ ] lint, typecheck, test pass; `e2e/w1-order-detail-b.spec.ts` passes with `E2E_PORT=3104`
- [ ] Report
