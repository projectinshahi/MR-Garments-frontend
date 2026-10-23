# Screenshot Inventory

- **Source directory:** `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots`
- **Inventoried on:** 2026-10-23
- **Total files:** 54: 53 JPEG images (51 unique, 2 byte-identical duplicates) and 1 text file (`_Notes_from_original.txt`)
- **Dimensions:** every image is **2880 × 1800 px**, a **1440 × 900 CSS px desktop viewport at 2× scale**. There are **no mobile or tablet variants**.
- **Method:** I opened every image. Colors and sizes were measured programmatically from the originals. JPEG compression adds roughly ±3 per color channel and ±0.5 px to measurements.

> **Domain finding:** the references show an **import-order tracking system** (China supplier → India warehouse,
> six stages, landed cost in INR). They do not show a generic garment-inventory app. The foundation's provisional
> `InventoryItem` type, fixture, stock-status logic and 8-item navigation do not match, and must be replaced in
> Phase 2 (see `docs/proposed-build-plan.md`).

## 1. File inventory

"Badge" means the dark screen-number pill drawn in the header and bottom-right corner (for example `3.1.a`). It
labels the screen in the original PDF and is not product UI (see open question Q1). "ADMIN nav" means the
sidebar shows the ADMIN section (Settings, Users).

| # | Filename | Dimensions | Likely screen | Variant | State shown | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `01_1_Login.jpeg` | 2880×1800 | Sign in | desktop | default, password masked, "Keep me signed in" unchecked | Split auth layout, no app shell |
| 2 | `02_1.1_Forgot_password.jpeg` | 2880×1800 | Forgot password | desktop | email filled | Badge 1.1 |
| 3 | `03_1.2_Change_password.jpeg` | 2880×1800 | Change password | desktop | strength meter 3/4, 2 of 3 rules met | Badge 1.2, auth layout with Cancel link |
| 4 | `04_2_Dashboard.jpeg` | 2880×1800 | Management dashboard | desktop | default, Management user | No ADMIN nav, no badge |
| 5 | `05_3_Orders_list.jpeg` | 2880×1800 | Orders list | desktop | "All 50" chip active, page 1 of 5 | No ADMIN nav |
| 6 | `06_3.1.a_Overview.jpeg` | 2880×1800 | Order detail › a Overview (PO-2028) | desktop | order fully received | Badge 3.1.a, no ADMIN nav |
| 7 | `07_3.1.b_Items.jpeg` | 2880×1800 | Order detail › b Items | desktop | default | Badge 3.1.b |
| 8 | `08_3.1.c_Deposits_&_payments.jpeg` | 2880×1800 | Order detail › c Deposits & payments | desktop | fully paid | Badge 3.1.c |
| 9 | `09_3.1.d_Receiving.jpeg` | 2880×1800 | Order detail › d Receiving | desktop | read-only fields, photo placeholders | Badge 3.1.d |
| 10 | `10_3.1.e_Containers.jpeg` | 2880×1800 | Order detail › e Containers | desktop | 1 container, arrived | Badge 3.1.e |
| 11 | `11_3.1.f_Clearing_&_transport.jpeg` | 2880×1800 | Order detail › f Clearing & transport | desktop | completed | Badge 3.1.f |
| 12 | `12_3.1.g_Warehouse.jpeg` | 2880×1800 | Order detail › g Warehouse | desktop | all checks green | Badge 3.1.g |
| 13 | `13_3.1.h_Cost.jpeg` | 2880×1800 | Order detail › h Cost | desktop | "Management only" chip | Badge 3.1.h |
| 14 | `14_3.1.i_History.jpeg` | 2880×1800 | Order detail › i History | desktop | 12 events, newest first | Badge 3.1.i |
| 15 | `15_4_New_order.jpeg` | 2880×1800 | New order (Stage 1 form) | desktop | PO-2050 filled, 3 items, 2 deposits | No ADMIN nav, no badge |
| 16 | `16_5_Deposits_&_Payments.jpeg` | 2880×1800 | Deposits & Payments | desktop | row PO-2041 selected, detail panel open | No ADMIN nav, no badge |
| 17 | `17_6_Delivery_Calendar.jpeg` | 2880×1800 | Delivery Calendar (month) | desktop | **identical to #18** (same MD5) | Use #18 |
| 18 | `18_6.a_Month.jpeg` | 2880×1800 | Delivery Calendar › a Month | desktop | October 2026, today 30 Sep | **No Month/Week/List tab bar** (see Q3) |
| 19 | `19_6.b_Week.jpeg` | 2880×1800 | Delivery Calendar › b Week | desktop | 28 Sep–4 Oct, late banner | Badge 6.b |
| 20 | `20_6.c_List.jpeg` | 2880×1800 | Delivery Calendar › c List | desktop | "All (16)" chip active | Badge 6.c |
| 21 | `21_7_Receiving_(China)_-_Stage_2_form.jpeg` | 2880×1800 | Record receipt (Stage 2 form) | desktop | PO-2035 partly received, 40 pcs short, remark required | No ADMIN nav |
| 22 | `22_7.1_Receiving_list.jpeg` | 2880×1800 | Receiving (China) list | desktop | "All" chip active | Badge 7.1 |
| 23 | `23_8_Container_loading_-_Stage_3_form.jpeg` | 2880×1800 | Load container (Stage 3 form) | desktop | FCIU 5527310, 3 lines, per-line FOB/CNF | No ADMIN nav |
| 24 | `24_8.1_Containers_list.jpeg` | 2880×1800 | Containers list | desktop | "Active (6)" chip | Badge 8.1 |
| 25 | `25_9_Clearing_(India)_-_Stage_4_form.jpeg` | 2880×1800 | Clearing form (Stage 4), container CAIU 2298076 | desktop | duty paid waiting, empty date fields dashed | No ADMIN nav |
| 26 | `26_9.1_Clearing_list.jpeg` | 2880×1800 | Clearing (India) list | desktop | totals row | Badge 9.1 |
| 27 | `27_10_Transport_-_Stage_5_form.jpeg` | 2880×1800 | Transport form (Stage 5), CAIU 2298076 | desktop | loading done, unloading waiting | No ADMIN nav |
| 28 | `28_10.1_Transport_list.jpeg` | 2880×1800 | Transport list | desktop | totals row | Badge 10.1 |
| 29 | `29_11_Warehouse_-_Stage_6_form.jpeg` | 2880×1800 | Receive goods (Stage 6 form) | desktop | bundles match, all pcs assigned | No ADMIN nav |
| 30 | `30_11.1_Warehouse_list.jpeg` | 2880×1800 | Warehouse list | desktop | totals row, management note | Badge 11.1 |
| 31 | `31_12_Landed_Cost.jpeg` | 2880×1800 | Landed Cost | desktop | "By order" segment, PO-2028 selected | "Management only" chip, no ADMIN nav |
| 32 | `32_13_Reports.jpeg` | 2880×1800 | Reports hub | desktop | 6 report cards, recent downloads | No ADMIN nav |
| 33 | `33_13.1_Order_status.jpeg` | 2880×1800 | Report › Order status | desktop | default | Badge 13.1 |
| 34 | `34_13.2_Deliveries_per_day.jpeg` | 2880×1800 | Report › Deliveries per day | desktop | 14-day bar chart | Badge 13.2 |
| 35 | `35_13.3_Ordered_vs_received.jpeg` | 2880×1800 | Report › Ordered vs received | desktop | default | Badge 13.3 |
| 36 | `36_13.4_Containers_timeline.jpeg` | 2880×1800 | Report › Containers timeline | desktop | Gantt with today line | Badge 13.4 |
| 37 | `37_13.5_Payments_per_supplier.jpeg` | 2880×1800 | Report › Payments per supplier | desktop | totals row | Badge 13.5 |
| 38 | `38_13.6_Landed_cost_by_month.jpeg` | 2880×1800 | Report › Landed cost by month | desktop | bar chart and table | Badge 13.6 |
| 39 | `39_14_Staff_home.jpeg` | 2880×1800 | Staff home (China staff) | desktop | Chen Yu, entry-only role | **Different sidebar**: Home + "YOUR STAGE" |
| 40 | `40_15.1_Suppliers.jpeg` | 2880×1800 | Settings › 1 Suppliers | desktop | "Active" chip | Badge 15.1 |
| 41 | `41_15.2_Shipping_agents.jpeg` | 2880×1800 | Settings › 2 Shipping agents | desktop | default | Badge 15.2 |
| 42 | `42_15.3_Clearing_agents.jpeg` | 2880×1800 | Settings › 3 Clearing agents | desktop | default | Badge 15.3 |
| 43 | `43_15.4_Transport_companies.jpeg` | 2880×1800 | Settings › 4 Transport companies | desktop | default | Badge 15.4 |
| 44 | `44_15.5_Offices_&_warehouses.jpeg` | 2880×1800 | Settings › 5 Offices & warehouses | desktop | default | Badge 15.5 |
| 45 | `45_15.6_Teams.jpeg` | 2880×1800 | Settings › 6 Teams | desktop | default | Badge 15.6 |
| 46 | `46_15.7_Item_list.jpeg` | 2880×1800 | Settings › 7 Item list | desktop | default | Badge 15.7 |
| 47 | `47_16.1_Users_list.jpeg` | 2880×1800 | Users › 1 Users | desktop | "Active (8)" chip | Badge 16.1 |
| 48 | `48_16.2_Add_or_edit_user.jpeg` | 2880×1800 | Users › 2 Add or edit user | desktop | editing Wang Fang (China staff) | Badge 16.2 |
| 49 | `49_16.3_Roles.jpeg` | 2880×1800 | Users › 3 Roles (permission matrix) | desktop | read-only | Badge 16.3 |
| 50 | `50_17.1_Notifications.jpeg` | 2880×1800 | Notifications | desktop | 3 unread ("New") | Badge 17.1 |
| 51 | `51_17.2_My_profile.jpeg` | 2880×1800 | My profile | desktop | 3 of 4 toggles on | Badge 17.2 |
| 52 | `52_17.3_Printable_PO.jpeg` | 2880×1800 | **Not the Printable PO.** It shows the Add supplier pop-up | desktop | **identical to #53** (same MD5) | The real Printable PO screen is missing from the source PDF |
| 53 | `53_17.4_Add_supplier_(pop-up).jpeg` | 2880×1800 | Add supplier dialog over Settings › Suppliers | desktop | dialog open, partly filled | Badge 17.4, navy overlay at 50% |
| – | `_Notes_from_original.txt` | – | Handwritten notes from the PDF | – | – | Requirements not shown in any screenshot (section 7) |

## 2. Screens (grouped)

| Screen | Files (#) | Desktop | Mobile | Other states | Open questions |
| --- | --- | --- | --- | --- | --- |
| Auth: sign in, forgot, change password | 1, 2, 3 | yes | – | strength meter | Q1 |
| Management dashboard | 4 | yes | – | – | Q2 |
| Orders list | 5 | yes | – | – | – |
| Order detail (9 tabs a–i) | 6–14 | yes | – | – | Q2, Q6 |
| New order | 15 | yes | – | – | Q8 |
| Deposits & Payments | 16 | yes | – | selected row | Q6 |
| Delivery Calendar (Month/Week/List) | 18 (=17), 19, 20 | yes | – | late banner | Q3, Q5 |
| Receiving (China): list and Record receipt | 22, 21 | yes | – | short receipt | – |
| Containers: list and Load container | 24, 23 | yes | – | – | – |
| Clearing (India): list and clearing form | 26, 25 | yes | – | waiting step | – |
| Transport: list and transport form | 28, 27 | yes | – | waiting step | – |
| Warehouse: list and Receive goods | 30, 29 | yes | – | – | – |
| Landed Cost | 31 | yes | – | – | Q7 |
| Reports hub and 6 reports | 32–38 | yes | – | – | Q6 |
| Staff home (entry-only role) | 39 | yes | – | – | Q4 |
| Settings (7 master-data tabs) and Add supplier dialog | 40–46, 53 (=52) | yes | – | dialog open | Q9 |
| Users (list, add/edit, roles) | 47–49 | yes | – | – | – |
| Notifications | 50 | yes | – | unread | Q10 |
| My profile | 51 | yes | – | – | Q10 |
| Printable PO | **missing** | – | – | – | Q11 |

## 3. Shared layout patterns

- **App shell:** fixed **240 px** sidebar (full height, navy gradient), white **68 px** header with a 1 px bottom border, and page background `#f5f6fb`. Content padding is **32 px** left and right and about **22 px** top. Grid gap is **18 px**. No visible shadows.
- **Sidebar:**
  - **Brand:** a 36 px blue "MR" logo square (radius about 8) next to "MR Garments" (bold, about 18 px, white).
  - **Sections:** an untitled main group, then **STAGES**, **MANAGEMENT** and **ADMIN**. Section labels are uppercase, about 11 px, letter-spaced, `#8b97bd`.
  - **Items:** 36 px tall at a 38 px pitch, inset 16 px (208 px wide), radius about 8. Each has a **small square bullet**, not an icon: `#5e72a9`, or primary blue when active. Item text is `#c1ccec`.
  - **Active item:** background `#323d59` (about 12% white over navy) with white bold text.
  - **Footer:** user block (avatar initials circle `#3d5289`, name bold, role line muted) above a divider `#263964`.
  - **No collapse control is shown.**
- **Header:** the page title (about 20 px bold, `#0a1b39`) sits in the header bar, not in the content. Detail and form pages use an inline breadcrumb ("Orders / **PO-2028**": muted parent and bold current). The right side holds the actions: primary button, outline button, search field (about 340 × 40), filter selects, and the "Today, 30 Sep 2026" pill (`#eff3ff` background, blue text).
- **Tab bar (detail pages):** white, **46 px**, below the header, with a bottom border. Each tab has a small **18 × 18 chip** with a letter (a–i, a–c) or number (1–7, 1–3). The active tab shows a blue chip, blue text and a 3 px blue underline. Inactive chips are `#e5ebf6`.
- **Context strip:** on order-detail tabs, a white card above the content: "**Denim jeans** · Guangzhou Textile Co. · ⟨tab-specific fact⟩" with a status pill on the right.
- **KPI cards:** a row of 3–5 equal white cards about 104 px tall. Each has a label (13 px, muted), a value (30 px bold, or red for alerts) and a sub-line (13 px, muted).
- **Content cards:** white, 1 px border `#e2e4ec`, **radius 12**, **padding 20**, title 16 px bold. An optional right-aligned link ("View all orders") or muted note goes on the title line.
- **Tables:** header row tinted `#f8f9fd` with 13 px bold `#5f6f7e` labels. Body text is 14 px. Rows have 1 px dividers `#eff0f3`. **Row height varies by screen**: dashboard about 39 px, settings about 53 px, orders about 58 px (two-line stage cell). Numbers are right-aligned. The first-column ID (PO, container) is bold.
  - **Totals row:** separated by a **2 px navy rule** (`#1b2033`), bold.
  - **Selected row:** `#eff3ff` with a 3 px blue left bar.
  - **Pagination:** "Showing 1 to 10 of 50 orders" plus ‹ 1 2 3 4 5 ›, with 30 × 30 boxed buttons and the active page filled blue.
- **Filter row:** search input and dropdown selects ("Stage All stages ▾", with an optional inline small label) on the left, and **filter chips** on the right (pill, 33 px, white with border, bold label; the active chip is navy `#13213c` with white text; counts inline).
- **Status pills:** 20 px tall, fully rounded, 12–13 px bold, as a tinted background with dark text. Tones are listed in section 4.
- **Forms:**
  - **Layout:** label above input (13 px bold `#393c4b`, red `*` for required), 3-column grid inside a card, about 22 px between rows.
  - **Inputs:** about 42 px tall, radius about 8, border `#d2d4e1`, background `#fbfcfe`. Read-only inputs use background `#f2f3f8`. Empty optional dates use a dashed border with a "Select date" placeholder.
  - **Selects:** native-looking with a ▾ glyph.
  - **Footers:** "Save draft" (outline) and a primary action, about 46 px tall, right-aligned.
  - **Side column:** a summary card (key-value rows) and a vertical progress timeline.
- **Key-value rows:** label on the left (regular), value on the right (bold), with 1 px dividers. A total row sits under a 2 px navy rule. Cost sub-rows use a muted label color.
- **Timelines:**
  - Horizontal 6-step journey (green check circles, green connecting line).
  - 3-point container journey (blue dots on a light-blue line).
  - Vertical progress list: green check = done, blue ring with number = current, grey ring with number = pending.
  - Activity list with blue dots.
- **Callouts:** info (`#eff3ff` background, `#313e6a` text), success (`#e6f5ee` background, `#2a6b49` text), and warning banner (`#fff7ea` background, `#ebd8b8` border, `#604113` text).
- **Charts:**
  - Bar charts: blue bars, value labels above, light track/grid.
  - Horizontal progress bars: blue fill on a `#eef1f8` track.
  - Stacked cost bar with legend rows.
  - Gantt-style container timeline with a red "today" line.
- **Dialog:** centered, radius about 16, white, padding about 28 px, title 22 px bold, close ×, footer divider. Overlay is the navy `#13213c` at **50%** opacity.
- **Auth layout:** left half is a navy gradient panel with brand, "Import Tracking System" hero (about 42 px bold), a subtitle, and the "EVERY ORDER, SIX STAGES" list (numbered circles, stage 6 filled blue). Right half is `#f5f6fb` with a centered white card (about 454 px wide, radius about 16, soft shadow).

## 4. Design tokens observed

Values measured from the 2× originals. Font sizes are inferred from cap heights (Arial cap height = 0.716 em), with ±1 px tolerance.

| Token (proposed) | Observed value | Where seen | Current value in globals.css | Action |
| --- | --- | --- | --- | --- |
| `--background` (page) | `#f5f6fb` | all app pages, auth right side | `oklch(1 0 0)` (white) | change |
| `--card` | `#ffffff` | cards, header, tab bar | white | keep |
| `--border` | `#e2e4ec` | cards, header bottom, tabs bar, chips, outline buttons | `oklch(0.922 0 0)` | change |
| `--border-subtle` (table rows) | `#eff0f3` | table row dividers | – | add |
| `--input` (border) / input background | `#d2d4e1` / `#fbfcfe` | form inputs | `oklch(0.922 0 0)` | change and add |
| `--input-readonly` | `#f2f3f8` | read-only inputs (3.1.d, 3.1.e, 11) | – | add |
| `--foreground` | `#0a1b39` (headings) to `#12192d` (body) | titles, table text | `oklch(0.145 0 0)` | change (one navy-black, verify by overlay) |
| `--muted-foreground` | `#6b6e7c` | KPI labels, sub-lines, notes | `oklch(0.556 0 0)` | change |
| `--table-head-foreground` | `#5f6f7e` | table headers | – | add |
| `--label` | `#393c4b` | form labels | – | add |
| `--primary` | `#2f6fed` | buttons, active nav bullet, bars, toggles, checkboxes, active page | `oklch(0.205 0 0)` | change |
| `--primary` text / links | about `#3462c8` | "View all orders", active tab text | – | verify; may equal primary |
| `--navy` | `#13213c` | active filter chip, segmented control, chart series, 2 px total rules (`#1b2033`), modal overlay | – | add |
| `--sidebar` gradient | `#14223f` (top) → `#1c3160` (bottom) | sidebar; staff welcome banner `#13213d` → `#1c3160` | `oklch(0.985 0 0)` | change |
| `--sidebar-foreground` | `#c1ccec` | nav text | – | change |
| `--sidebar-accent` | `#323d59` | active nav item | – | change |
| `--sidebar-muted` | `#8b97bd` (labels), `#5e72a9` (bullets), `#263964` (divider) | sidebar | – | add |
| `--status-danger` (bg / text) | `#fceced` / `#ac2c39`; strong red `#bf2837` | Late, short, KPI alert | placeholder | change |
| `--status-warning` (bg / text) | `#fff2df` / `#9a5605` | Due soon, Partly received, Loading, Estimate, Waiting | placeholder | change |
| `--status-success` (bg / text) | `#e6f5ee` / `#226d4e`; strong green `#1a7f4b` | On track, Active, Complete, Paid, Final, journey checks | placeholder | change |
| `--status-info` (bg / text) | `#eaf0ff` / `#3964c0` | In clearing, On the sea, View, New, Excel/PDF chips | placeholder | change |
| `--status-purple` (bg / text / border) | `#f4ebfc` / `#6b41a3` / `#d5caea` | CNF term, Management role | – | add |
| `--status-neutral` (bg / text) | `#f2f3f8` / `#363a53` | "Management only" | muted | change |
| `--callout-info` (bg / text) | `#eff3ff` / `#313e6a` | info boxes, today pill, selected row, PO strip | – | add |
| `--callout-warning` (bg / border / text) | `#fff7ea` / `#ebd8b8` / `#604113` | late banner, transport hint | – | add |
| `--chart-1..5` | blue `#2f6fed`, amber `#efa021`, green `#1d7e4d`, navy `#13213c`, track `#eef1f8`; today line `#c82e40` | charts and progress bars | greys | change |
| `--overlay` | `#13213c` at 50% | dialog backdrop | black/50 (shadcn) | change |
| `--radius` (cards) | **12 px** (inputs, buttons, nav items about 8; dialog and auth card about 16; pills full) | all | `0.625rem` (10 px) | change to 0.75rem |
| Font family | **Arial metrics** (spurred G, slanted t, double-storey a). Matches Liberation Sans, so use **Arimo** | all | Geist | change |
| Type scale | page title 20 bold, detail title 22 bold, KPI value 30 bold, card title 16 bold, body/table 14, labels/KPI label 13, table head 13 bold, pills 12 bold, sidebar 15, section label 11 caps | all | defaults | add tokens |
| `--sidebar-width` | **240 px** | shell | 16rem (256 px) | change |
| `--header-height` | **68 px** (incl. border) | shell | 3.5rem (56 px) | change |
| `--tabs-height` | **46 px** | detail pages | – | add |
| `--page-padding` | **32 px** horizontal, about 22 px top | all | 1.5rem | change |
| `--page-gap` | **18 px** | grids, card rows | 1.5rem | change |
| Control heights | input about 42, header button 34, form button about 46, filter input/select 40, chip 33, pill 20, pager 30 | – | shadcn 32 (h-8) | add variants |

## 5. Reference-to-route mapping

Route plan, reviewed 2026-10-23 (review notes in `docs/proposed-build-plan.md` §5). Every route is new. The
current `/` placeholder is replaced, and `/preview` stays as the orchestrator's component preview. Owners come from the
build plan §6 (W = wave). `(app)` is the Management shell group (renamed from `(dashboard)` in Phase 2).

| Screenshot(s) | Route | Page file | Feature folder | Owner agent | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `/login` | `src/app/(auth)/login/page.tsx` | `src/features/auth/` | W3-auth | not started |
| 2 | `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | `src/features/auth/` | W3-auth | not started |
| 3 | `/change-password` | `src/app/(auth)/change-password/page.tsx` | `src/features/auth/` | W3-auth | not started |
| 4 | `/` | `src/app/(app)/page.tsx` | `src/features/dashboard/` | W1-dashboard | not started |
| 5 | `/orders` | `src/app/(app)/orders/page.tsx` | `src/features/orders/` | W1-orders | not started |
| 15 | `/orders/new` | `src/app/(app)/orders/new/page.tsx` | `src/features/order-form/` | W2-new-order | not started |
| 6 | `/orders/[po]` | `src/app/(app)/orders/[po]/page.tsx` | `src/features/order-detail/overview/` | W1-order-detail-a | not started |
| 7 | `/orders/[po]/items` | `…/[po]/items/page.tsx` | `src/features/order-detail/items/` | W1-order-detail-a | not started |
| 8 | `/orders/[po]/payments` | `…/[po]/payments/page.tsx` | `src/features/order-detail/payments/` | W1-order-detail-a | not started |
| 9 | `/orders/[po]/receiving` | `…/[po]/receiving/page.tsx` | `src/features/order-detail/receiving/` | W1-order-detail-a | not started |
| 10 | `/orders/[po]/containers` | `…/[po]/containers/page.tsx` | `src/features/order-detail/containers/` | W1-order-detail-a | not started |
| 11 | `/orders/[po]/clearing-transport` | `…/[po]/clearing-transport/page.tsx` | `src/features/order-detail/clearing-transport/` | W1-order-detail-b | not started |
| 12 | `/orders/[po]/warehouse` | `…/[po]/warehouse/page.tsx` | `src/features/order-detail/warehouse/` | W1-order-detail-b | not started |
| 13 | `/orders/[po]/cost` | `…/[po]/cost/page.tsx` | `src/features/order-detail/cost/` | W1-order-detail-b | not started |
| 14 | `/orders/[po]/history` | `…/[po]/history/page.tsx` | `src/features/order-detail/history/` | W1-order-detail-b | not started |
| (6–14 shared) | `/orders/[po]/layout.tsx` (header, breadcrumb, actions, tab bar) | `src/app/(app)/orders/[po]/layout.tsx` | `src/features/order-detail/shared/` | **orchestrator** | not started |
| 16 | `/payments` | `src/app/(app)/payments/page.tsx` | `src/features/payments/` | W1-payments | not started |
| 18 (=17) | `/calendar` | `src/app/(app)/calendar/page.tsx` | `src/features/calendar/` | W1-calendar | not started |
| 19 | `/calendar/week` | `src/app/(app)/calendar/week/page.tsx` | `src/features/calendar/` | W1-calendar | not started |
| 20 | `/calendar/list` | `src/app/(app)/calendar/list/page.tsx` | `src/features/calendar/` | W1-calendar | not started |
| 22 | `/receiving` | `src/app/(app)/receiving/page.tsx` | `src/features/receiving/` | W1-receiving | not started |
| 21 | `/receiving/new` | `src/app/(app)/receiving/new/page.tsx` | `src/features/receiving/` | W1-receiving | not started |
| 24 | `/containers` | `src/app/(app)/containers/page.tsx` | `src/features/containers/` | W2-containers | not started |
| 23 | `/containers/new` | `src/app/(app)/containers/new/page.tsx` | `src/features/containers/` | W2-containers | not started |
| 26 | `/clearing` | `src/app/(app)/clearing/page.tsx` | `src/features/clearing/` | W2-clearing | not started |
| 25 | `/clearing/[container]` | `src/app/(app)/clearing/[container]/page.tsx` | `src/features/clearing/` | W2-clearing | not started |
| 28 | `/transport` | `src/app/(app)/transport/page.tsx` | `src/features/transport/` | W2-transport | not started |
| 27 | `/transport/[container]` | `src/app/(app)/transport/[container]/page.tsx` | `src/features/transport/` | W2-transport | not started |
| 30 | `/warehouse` | `src/app/(app)/warehouse/page.tsx` | `src/features/warehouse/` | W2-warehouse | not started |
| 29 | `/warehouse/receive` | `src/app/(app)/warehouse/receive/page.tsx` | `src/features/warehouse/` | W2-warehouse | not started |
| 31 | `/landed-cost` | `src/app/(app)/landed-cost/page.tsx` | `src/features/landed-cost/` | W2-landed-cost | not started |
| 32 | `/reports` | `src/app/(app)/reports/page.tsx` | `src/features/reports/` | W2-reports | not started |
| 33 | `/reports/order-status` | `…/reports/order-status/page.tsx` | `src/features/reports/` | W2-reports | not started |
| 34 | `/reports/deliveries-per-day` | `…/reports/deliveries-per-day/page.tsx` | `src/features/reports/` | W2-reports | not started |
| 35 | `/reports/ordered-vs-received` | `…/reports/ordered-vs-received/page.tsx` | `src/features/reports/` | W2-reports | not started |
| 36 | `/reports/containers-timeline` | `…/reports/containers-timeline/page.tsx` | `src/features/reports/` | W2-reports | not started |
| 37 | `/reports/payments-per-supplier` | `…/reports/payments-per-supplier/page.tsx` | `src/features/reports/` | W2-reports | not started |
| 38 | `/reports/landed-cost-by-month` | `…/reports/landed-cost-by-month/page.tsx` | `src/features/reports/` | W2-reports | not started |
| 39 | `/home` | `src/app/(staff)/home/page.tsx` | `src/features/staff-home/` | W3-staff-home | not started |
| 40 | `/settings/suppliers` (`/settings` redirects here) | `src/app/(app)/settings/suppliers/page.tsx` | `src/features/settings/` | W3-settings | not started |
| 53 (=52) | `/settings/suppliers?dialog=add-supplier` | same page, dialog driven by search param | `src/features/settings/` | W3-settings | not started |
| 41 | `/settings/shipping-agents` | `…/settings/shipping-agents/page.tsx` | `src/features/settings/` | W3-settings | not started |
| 42 | `/settings/clearing-agents` | `…/settings/clearing-agents/page.tsx` | `src/features/settings/` | W3-settings | not started |
| 43 | `/settings/transport-companies` | `…/settings/transport-companies/page.tsx` | `src/features/settings/` | W3-settings | not started |
| 44 | `/settings/offices` | `…/settings/offices/page.tsx` | `src/features/settings/` | W3-settings | not started |
| 45 | `/settings/teams` | `…/settings/teams/page.tsx` | `src/features/settings/` | W3-settings | not started |
| 46 | `/settings/items` | `…/settings/items/page.tsx` | `src/features/settings/` | W3-settings | not started |
| 47 | `/users` | `src/app/(app)/users/page.tsx` | `src/features/users/` | W3-users | not started |
| 48 | `/users/edit` | `src/app/(app)/users/edit/page.tsx` | `src/features/users/` | W3-users | not started |
| 49 | `/users/roles` | `src/app/(app)/users/roles/page.tsx` | `src/features/users/` | W3-users | not started |
| 50 | `/notifications` | `src/app/(app)/notifications/page.tsx` | `src/features/notifications/` | W3-account | not started |
| 51 | `/profile` | `src/app/(app)/profile/page.tsx` | `src/features/profile/` | W3-account | not started |
| missing | (Printable PO) | **no route**. "Print order" shows the D5 toast | – | – | not built (no reference) |

## 6. Data needed per screen

Mock clock: `MOCK_TODAY` = **Wednesday 30 Sep 2026**, used by screens that show "Today, 30 Sep 2026" and relative labels.
Screens captured on later days keep their screenshot values as stored fixture values (see §9).

Per D2, **screen-specific fixtures live in each feature's `data/` folder** (owned by the screen agent).
**Shared master data and data contracts** (types, suppliers, agents, transport companies, offices and warehouses, teams,
item master, users, roles, current user, formatters, `MOCK_TODAY`) are created by the orchestrator in Phase 2.

| Screen | Entities and fields visible | Existing type/fixture | Shared contract (orchestrator) / screen fixture (agent) |
| --- | --- | --- | --- |
| Dashboard | order counts by stage, late/upcoming deliveries, payments due (INR), containers on the way | none (`InventoryItem` is wrong) | dashboard view fixture |
| Orders list | PO, item, supplier, qty + unit, delivery date, stage (1–6), status, paid so far INR | none | `Order`, `Supplier`, stage enum, status enum |
| Order detail a–i | order header (item, supplier, contact, dates, qty, bundles, terms, entered by, landed cost, per piece); items (colour/style, qty, bundles, price ¥, line total); size breakdown; payments (date, type, paid to, ¥, rate, ₹); receipt; container; clearing; transport; warehouse team split; cost breakdown; history events | none | `OrderItem`, `SizeQty`, `Payment`, `Receipt`, `Container`, `ClearingRecord`, `TransportTrip`, `WarehouseReceipt`, `TeamAllocation`, `CostLine`, `HistoryEvent` |
| New order | PO no., dates, supplier, currency (CNY ¥), contact, phone, city, item lines (rate ¥, qty + unit), deposits (payee, date, rate, mode) | none | currency enum (Q8), payment mode |
| Deposits & Payments | per order: order value ¥, paid ¥, paid ₹, balance ¥, next due; schedule with expected rate and short-receipt deduction | none | payment schedule |
| Delivery Calendar | due date, PO, supplier, item, qty, status (late / due ≤2 days / on track) | none | delivery view (Q5) |
| Stage lists and forms 2–6 | receipts, containers (number, seal, BL, agent, FOB/CNF, ports, ETD/ETA, contents per order), clearing (agent, BE no., dates, duty lines), transport (company, LR, vehicle, driver, bundles, charges), warehouse (team split) | none | per-stage records |
| Landed Cost, Reports | derived totals, monthly aggregates, recent downloads | none | report fixtures |
| Settings | suppliers, shipping agents, clearing agents, transport companies, offices/warehouses, teams, item master (unit, pieces per bundle) | none | master data |
| Users | users (name, email, role, office, last sign-in, status), role matrix (Full / Enter / View / –), per-user stage access | none | `User`, `Role`, permission matrix |
| Notifications, Profile | notifications (type tone, title, detail, time, unread), profile with notification toggles | none | `Notification`, profile |

**The screenshots contradict each other on the same PO.** Per decision D1, each screen reproduces its own screenshot.
The known differences are logged in §9.

## 7. Requirements in the notes file that no screenshot shows

From `_Notes_from_original.txt`. These are recorded only and not designed. **Do not build them until requirements are provided.**
- Items: "Need colour codes to add" and "full history of any [item]".
- Deposits & payments: "Need Y or $ choose option" (currency choice CNY/USD) and "one item one cost details".
- Other: "Sale mr", "Orders needs list", "Proposal engine", "Additional payments mentions", "Advance payment collected details", "RECEIVABLES".

## 8. Open questions: resolution

Decisions D1–D6 were approved on 2026-10-23 (`docs/proposed-build-plan.md` §2–3).

| # | Question | Resolution |
| --- | --- | --- |
| Q1 | Screen-number badges ("1.1", "3.1.a", …) | **D3:** annotations, so not rendered and excluded from visual comparison. Tab letter and number chips **are** UI and are rendered. |
| Q2 | ADMIN nav missing on 13 screenshots (4, 5, 6, 15, 16, 18, 21, 23, 25, 27, 29, 31, 32) | **D6:** always visible for Management. |
| Q3 | Month view (18) has no tab bar | **D6:** Month, Week and List tabs on all calendar views. |
| Q4 | Staff home (39) reachability and sidebar | Kept as a **role-specific** exception to D6: `/home` in the `(staff)` group with the staff sidebar (Home, "YOUR STAGE"), driven by the mock current user. No auth. |
| Q5 | Calendar data contradicts Orders | **D1:** each screen keeps its screenshot data. Logged in §9. |
| Q6 | Undesigned actions (Record payment, Edit order, Print order, Add deposit, exports, Mark all as read, …) | **D5:** shared `notInPrototype(action)` toast. No invented UI. |
| Q7 | Landed Cost "By team" / "By item" | Segmented control renders. The two undesigned segments use the D5 toast. |
| Q8 | Currencies | **Default:** CNY (¥) supplier amounts and INR (₹) conversions, both with Indian grouping, as shown. Currency selects list CNY only. USD waits for confirmed requirements. |
| Q9 | Add/Edit forms for the six other settings tabs | **D5** toast. The Add supplier dialog (53) is the only designed form. |
| Q10 | Access to Notifications and My profile | **Default (pending approval, plan B3):** the sidebar user block opens a menu with My profile, Notifications and Sign out. It looks unchanged in its resting state. |
| Q11 | Printable PO missing | **Not built.** "Print order" uses the D5 toast and has no route. |
| Q12 | Money formatting variants ("¥ 62,780", "¥80,000", "₹42.6 L") | Match each screenshot. Formatters support both spacing styles and the lakh short form. |

## 9. Deliberate data differences (D1 log)

Each screen reproduces its own screenshot. The differences below are **intentional** and must not be "fixed" in screen
fixtures. Screen agents add any new differences they find to their report, and the orchestrator appends them here.

| Record | Screens and values | Note |
| --- | --- | --- |
| PO-2044 | Orders (5), Staff home (39): **Ladies kurtis, 3,200 pcs** · Calendar Week/List (19, 20): **Men's shirts, 1,800 pcs** | Supplier (Shenzhen Apparel) and due date (29 Sep) agree |
| PO-2041 | Orders (5), Staff home (39): **Cotton fabric rolls, 5,000 m** · Calendar List (20): **Ladies tops, 2,000 pcs** | due 26 Sep, Guangzhou Textile Co. agree |
| PO-2047 | Orders (5), Staff home (39): **Polo shirts, 1,800 pcs** · Calendar Week/List (19, 20): **Ladies leggings, 2,000 pcs** | due 1 Oct agrees |
| PO-2049 | Orders (5), Staff home (39): **Cotton denim fabric, 2,400 m** · Calendar Week/List (19, 20): **Polyester fabric, 3,000 m** | due 3 Oct agrees |
| PO-2038 | Orders (5), Staff home (39): **Buttons and zips, 40,000 pcs** · Calendar List (20): **Zips and buttons, 30,000 sets** | due 27 Sep agrees |
| PO-2050 | New order (15): Cotton denim fabric, Denim lining, Metal buttons · Calendar List (20): **Denim fabric, 5,000 m** · Item list (46): listed under **Denim jeans** | |
| PO-2028 timeline | Orders (5): stage **4. Clearing in India / In clearing** · Containers list (24): **Arrived, in clearing** · Clearing form (25): duty paid **waiting** · Transport form (27): unloading **waiting** · Order detail (6–14), Clearing list (26), Transport list (28), Warehouse (29, 30), Landed cost (31, 38): **received in warehouse 3 Oct** | Snapshots from different days, some after `MOCK_TODAY` (30 Sep). Store the shown values; do not recompute them from the clock. |
| Chen Yu | Users list (47): last sign-in **Yesterday, 15:31** · Staff home (39): signed in today (30 Sep) | Keep as shown |
| PO-2041 rates | Deposits & Payments (16): deposit rate **20.00**, expected balance rate **30.00** (other orders show 11.60–14.00) | Implausible but shown, so keep as shown |
