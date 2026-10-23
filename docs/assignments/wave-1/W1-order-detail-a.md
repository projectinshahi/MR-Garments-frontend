# Screen Assignment: Order detail, tabs a–e (PO-2028)

## Identity
- **Agent:** `W1-order-detail-a`
- **Screen:** Order detail tabs a Overview, b Items, c Deposits & payments, d Receiving, e Containers
- **Routes:** `/orders/[po]` (`page.tsx`), `/orders/[po]/items`, `/payments`, `/receiving`, `/containers`
- **Dev port:** `3003` | **E2E_PORT:** `3103`

## Reference screenshots
Each file is in `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\`.

| File | Tab |
| --- | --- |
| `06_3.1.a_Overview.jpeg` | a Overview |
| `07_3.1.b_Items.jpeg` | b Items |
| `08_3.1.c_Deposits_&_payments.jpeg` | c Deposits & payments |
| `09_3.1.d_Receiving.jpeg` | d Receiving |
| `10_3.1.e_Containers.jpeg` | e Containers |

## Owned paths
- `src/app/(app)/orders/[po]/page.tsx`
- `src/app/(app)/orders/[po]/{items,payments,receiving,containers}/page.tsx`
- `src/features/order-detail/{overview,items,payments,receiving,containers}/**`
- `e2e/w1-order-detail-a.spec.ts`

**Not yours (orchestrator):** `orders/[po]/layout.tsx` (header "Orders / PO-2028", Print order and Edit order buttons, tabs a–i) and `src/features/order-detail/shared/**`.

## Read-only inputs
- The frame renders the header and tabs. Each tab page renders `PageContainer` and its content.
- Tabs b–e start with `OrderContextStrip({ po, fact })` from `@/features/order-detail/shared/order-detail-frame`.
- Components: `KpiRow`/`KpiCard`, `SectionCard`, `KeyValueList`, `Journey`, `Timeline`, `DataTable`, `StatusPill`, `TermsBadge`, `ProgressBar`, `Callout`, `Input` (`readOnly`).
- Formatters: `formatINR`, `formatCNY`, `formatRate`, `formatQty`, `formatDate`.

Each tab page receives `params` (PO-2028 is prerendered by the layout's `generateStaticParams`).

## Data (D1)
Transcribe each tab exactly from its screenshot.

## Required behavior
**a Overview:** no context strip.
- **Header card:** "Denim jeans" plus a "Received in warehouse" pill; "Guangzhou Textile Co. · Contact: Mr. Zhao Lin"; on the right "Landed cost ₹13,77,000 / ₹550.80 per piece"; a divider; a facts row: Order date, Delivery date, Quantity "2,500 pcs · 50 bundles", Terms CNF, Entered by Procurement.
- **"Journey of this order":** six `check` steps with date and detail lines.
- **Three cards:**
  - Money: `KeyValueList` with the total "Landed cost".
  - Given to teams: total "2,500 pcs".
  - Latest activity: `Timeline` with `dot` markers.

**b Items:**
- **Strip:** "Order date 5 Aug 2026".
- **"Items ordered":** bordered table with Item, Colour / style, Qty, Bundles, Price per piece, Line total, and a Total row.
- **"Quantity by size":** five `ProgressBar` rows plus the caption "300 + 600 + … = 2,500 pcs · 50 pcs in each bundle".
- **"Order terms":** bold `KeyValueList`; Terms is a `TermsBadge` CNF `md`; Currency "¥ Chinese yuan".
- **"Notes":** read-only text box.

**c Deposits & payments:**
- **Strip:** "Order value ¥80,000".
- **KPIs:** Order value, Paid so far, Balance to pay.
- **"Deposits and payments" table:** Date, Type, Paid to, Amount, Rate, In INR, plus a Total paid row.
- **"How the INR figure is found":** an info `Callout` plus rate lines and the total "Goods cost in INR".
- **"Balance rule":** card text.

**d Receiving:**
- **Strip:** "Received in China 26 Aug 2026".
- **KPIs:** Ordered, Received in China, Short.
- **"Receipt in China":** read-only inputs in a 3 × 2 grid; the item table with a green "0" short pill; the Remark.
- **"Photos and papers":** two hatched placeholders (CSS pattern from tokens) plus the file names.
- **"Receiving history":** `Timeline` with `dot` then `ring`.

**e Containers:**
- **Strip:** "1 container".
- **"Container CAIU 2298076":** `TermsBadge` CNF `md` plus "Shipping agent: Sino Freight"; `Journey align="edges"` with three `dot` points; read-only Container number, Seal number and Bill of lading.
- **"Goods of this order in the container":** bold `KeyValueList` with the total "Share of this order in container 100%".
- **"Good to know":** info `Callout`.

## Out of scope
Tabs f–i (W1-order-detail-b), and the header actions (already D5 in the frame).

## Acceptance
- [ ] `visual-diff` per tab, content region `240,0,1200,900`, reviewed; differences listed
- [ ] lint, typecheck, test pass; `e2e/w1-order-detail-a.spec.ts` passes with `E2E_PORT=3103`
- [ ] Report
