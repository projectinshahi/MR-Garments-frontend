# Screen Assignment: Delivery Calendar (Month, Week, List)

## Identity
- **Agent:** `W1-calendar`
- **Screen:** Delivery Calendar
- **Routes:** `/calendar` (Month), `/calendar/week`, `/calendar/list`
- **Dev port:** `3006` | **E2E_PORT:** `3106`

## Reference screenshots
Each file is in `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\`.

| File | View | Notes |
| --- | --- | --- |
| `18_6.a_Month.jpeg` (identical to `17_6_Delivery_Calendar.jpeg`) | a Month, October 2026, today 30 Sep | Has no tab bar. **D6: add Month/Week/List tabs**, as in 19 and 20 |
| `19_6.b_Week.jpeg` | b Week, 28 Sep – 4 Oct 2026 | Late banner |
| `20_6.c_List.jpeg` | c List, "All (16)" | |

## Owned paths
- `src/app/(app)/calendar/**`. You may add `calendar/layout.tsx` for the shared header and tabs.
- `src/features/calendar/**`
- `e2e/w1-calendar.spec.ts`

## Read-only inputs
`PageHeader`, `RouteTabs` (chips a/b/c), `FilterSelect`, `TodayPill`, `FilterChips`, `SectionCard`/`CardNote`, `DataTable`, `StatusPill`,
`BarChart`, `Callout`, `notInPrototype`, `formatShortDate`, `MOCK_TODAY`.

## Data (D1)
- **Month:** 16 PO chips with status tones.
- **Week:** 7 day columns of event cards.
- **List:** 16 rows.
- **Side cards:** deliveries per day (Thu 1 to Wed 7 Oct), 3 late deliveries.
- Several POs show different items from the Orders screens (inventory §9). Keep the calendar values as shown.

## Required behavior
- **Header** (all views): title "Delivery Calendar". Actions: `FilterSelect` "All suppliers" and `TodayPill`.
- **Tabs:** a Month, b Week, c List (`RouteTabs`).
- **Month:**
  - **Calendar card:** ‹ October 2026 ›; legend (Late, Due within 2 days, On track).
  - **Grid:** Mon–Sun, 5 weeks from 28 Sep to 1 Nov. Each day has its number and a count. PO chips are tinted by status: danger soft, warning soft, info soft. The today circle is on 30. Days outside the month are muted.
  - **Right column:** "Deliveries per day" (`BarChart`, note "next 7 days"), "Late deliveries" (count pill plus three rows with day pills), and the "Reminders" info card.
- **Week:**
  - Warning `Callout` banner: "Late from before this week: …".
  - Card with ‹ 28 Sep – 4 Oct 2026 › and the legend.
  - Seven columns with day headers. Wed 30 Sep is highlighted as "· Today".
  - Event cards show PO (colored), supplier, "item · qty", and a status line. Empty days show "No deliveries".
- **List:**
  - `FilterSelect` "All suppliers" and "Next 30 days".
  - `FilterChips`: All (16), Late (3), Due within 2 days (3), On track (10). They filter the rows client-side.
  - Bordered table: Due date, PO (bold), Supplier, Item, Quantity, Status pill.
- **Undesigned:** the ‹ › month and week navigation calls `notInPrototype("Previous month")` and so on. Clicking a PO calls `notInPrototype` unless the PO is PO-2028.

## Out of scope
Deliveries report (W2-reports), and order detail.

## Acceptance
- [ ] `visual-diff` per view (content region; the Month view's added tab bar is a D6 difference) reviewed
- [ ] lint, typecheck, test pass; `e2e/w1-calendar.spec.ts` passes with `E2E_PORT=3106`
- [ ] Report, including the D1 differences
