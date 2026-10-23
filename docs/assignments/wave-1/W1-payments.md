# Screen Assignment: Deposits & Payments

## Identity
- **Agent:** `W1-payments`
- **Screen:** Deposits & Payments
- **Route:** `/payments` (`src/app/(app)/payments/page.tsx`)
- **Dev port:** `3005` | **E2E_PORT:** `3105`

## Reference screenshots
| File (absolute path) | Variant / state | Notes |
| --- | --- | --- |
| `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\16_5_Deposits_&_Payments.jpeg` | desktop, PO-2041 selected | No ADMIN section in this shot (D6 adds it) |

## Owned paths
- `src/app/(app)/payments/page.tsx`
- `src/features/payments/**`
- `e2e/w1-payments.spec.ts`

## Read-only inputs
`PageHeader`, `SearchInput`, `Button`, `KpiRow`/`KpiCard`, `SectionCard`/`CardNote`, `DataTable` (`variant="plain"`, `selectedRowId`), `StatusPill`,
`Callout`, `notInPrototype`, `formatINR`, `formatCNY`, `formatRate`, `formatDate`.

## Data (D1)
- 3 KPI cards.
- 5 order rows: PO-2049, 2047, 2044, 2041, 2038.
- The PO-2041 payment schedule: Deposit paid 12 Sep 2026, ¥50,000 at 20.00; Balance due 5 Oct 2026, ¥50,000, expected rate 30.00.
- The PO-2041 rates are unusual but shown, so keep them (inventory §9).

## Required behavior
- **Header:** title "Deposits & Payments". Actions: `SearchInput` ("Search PO or supplier") and primary "+ Record payment", which calls `notInPrototype("Record payment")`.
- **KPIs:** Paid so far (INR), Due in next 7 days, Due in next 30 days.
- **Left card "Payments by order"** (aside note "Amounts in supplier currency (¥) and INR"):
  - Columns: PO / Supplier (two lines), Order value (¥), Paid (¥), Paid (INR), Balance (¥), Next due.
  - PO-2041's "5 Oct" is a warning pill.
  - PO-2041 is selected (`selectedRowId`). Only PO-2041 has a designed detail panel, so clicking another row calls `notInPrototype("Payment detail for <PO>")`.
- **Right card "PO-2041 payments"** (aside "Guangzhou Textile Co."):
  - Two bordered payment blocks. "1. Deposit" has a success "Paid" pill; "2. Balance" has a warning "Due 5 Oct" pill.
  - Each block shows a 2 × 2 facts grid and a dashed box with the formula and the INR amount.
  - Total row: "Total for this order ₹25,00,000 / ¥ 1,00,000".
  - Info `Callout`.
  - Full-width primary "+ Record payment for PO-2041", which calls `notInPrototype`.

## Out of scope
Order detail payments tab (W1-order-detail-a).

## Acceptance
- [ ] `visual-diff` content region reviewed; differences listed
- [ ] lint, typecheck, test pass; `e2e/w1-payments.spec.ts` passes with `E2E_PORT=3105`
- [ ] Report
