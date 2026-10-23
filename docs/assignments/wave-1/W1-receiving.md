# Screen Assignment: Receiving (China) list and Record receipt

## Identity
- **Agent:** `W1-receiving`
- **Screens:** Receiving (China) list, and Record receipt (Stage 2 form)
- **Routes:** `/receiving`, `/receiving/new`
- **Dev port:** `3007` | **E2E_PORT:** `3107`

## Reference screenshots
Each file is in `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\`.

| File | Screen | Notes |
| --- | --- | --- |
| `22_7.1_Receiving_list.jpeg` | List, "All" chip | |
| `21_7_Receiving_(China)_-_Stage_2_form.jpeg` | Record receipt, PO-2035 partly received | No ADMIN section in this shot (D6 adds it) |

## Owned paths
- `src/app/(app)/receiving/**`
- `src/features/receiving/**`
- `e2e/w1-receiving.spec.ts`

## Read-only inputs
`PageHeader` (`parent` for the form), `SearchInput`, `FilterSelect`, `FilterChips`, `KpiRow`/`KpiCard`, `DataTable`, `StatusPill`, `SectionCard`,
`Field`/`FieldLabel`, `Input`, `Textarea`, `NativeSelect`, `RequiredMark`, `FormFooter`, `Button`, `KeyValueList`, `Timeline`,
`notInPrototype`, formatters, and `listLocations` (offices).

## Data (D1)
- **List:** 4 KPIs ("Short items this month 2" in danger) and 9 receipt rows, exactly as shown.
- **Form:** PO-2035 Men's jackets (Shenzhen Apparel): two item lines, effect on payment, three delivery events.

## Required behavior
**List (`/receiving`):**
- **Header:** title "Receiving (China)". Actions: `SearchInput` ("Search PO or supplier") and primary "+ Record receipt", a link to `/receiving/new`.
- **Filters:** `FilterSelect` "All offices" and "All suppliers"; `FilterChips` All / Partly received / Short / Complete. Filtering happens client-side.
- **KPIs:** Receipts in September, Waiting to be received, Partly received, Short items this month.
- **Bordered table:** Received on, PO (bold), Supplier, Item, Ordered, This receipt, Total so far, Short (red when above zero, "–" when none), Bundles, Received by, Status pill.

**Form (`/receiving/new`):**
- **Header:** "Receiving (China) / Record receipt". Action: outline "Cancel", a link to `/receiving`.
- **Left card:**
  - Info strip "PO-2035 · Men's jackets · Shenzhen Apparel" with a warning pill "Partly received".
  - 3-column fields: Received on\*, Received at office\* (`NativeSelect`), Received by\*, Bundles received now\*, Supplier delivery note no., Photo of goods ("Attach photo").
- **Card "Ordered against received":**
  - Table with editable right-aligned "Received now" inputs. Short is computed, in red when above zero.
  - "Short remark\*" textarea.
  - `FormFooter`: "Save draft" (outline) and "Save receipt" (primary). Both call `notInPrototype`, since no saved state is designed.
- **Right cards:**
  - "Effect on payment" `KeyValueList`, with the negative line in red, and the total "Balance to pay now ¥ 29,600".
  - "Deliveries for PO-2035" `Timeline` (`ring`, current `dot`, `ring`).
- **Mock mutation:** editing Received now updates Short and the payment effect live. This is client state only and resets on reload.

## Out of scope
Staff home (W3), and the order detail receiving tab (W1-order-detail-a).

## Acceptance
- [ ] `visual-diff` for both screens (content region) reviewed; differences listed
- [ ] lint, typecheck, test pass (including a unit test for the short / balance calculation); `e2e/w1-receiving.spec.ts` passes with `E2E_PORT=3107`
- [ ] Report
