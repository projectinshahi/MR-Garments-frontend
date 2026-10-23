# Build Plan

**Status (2026-10-23):**
- **Approved:** D1–D6 and B1–B4 (B5 is advisory).
- **Phase 2 shared setup is complete and validated** (§10). It is committed to `main` as the baseline.
- **No screen code exists** beyond placeholders, and **no agents have been launched.**
- **Next:** Wave 1, after explicit user approval and the open items in §11.
- **Source analysis:** `docs/screenshot-inventory.md`.

## 1. Product scope (confirm before implementation)

- **Product:** **MR Garments**, an **Import Tracking System**. It follows each purchase order from a China supplier, through receiving in China, container shipping, clearing at an Indian port and road transport, to the India warehouse. It calculates the **landed cost in INR**.
- **The six stages** (named in the login screen and sidebar):
  1. Order and deposit
  2. Receiving in China
  3. Container loading
  4. Clearing in India
  5. Transport
  6. India warehouse and landed cost
- **Users** (roles matrix, 16.3): Management (full access), Procurement, Accounts, China staff, India staff, Warehouse staff. Entry-only staff see only their own stage (staff home, 39). Agents and transporters do not log in.
- **This is not a generic garment-inventory app.** The foundation's provisional inventory model (`InventoryItem`, stock status, the 8-item navigation) is **replaced** in Phase 2 and not extended.
- **Unchanged constraints:**
  - Frontend only, with deterministic local mock data.
  - No backend, database, auth API or persistence.
  - Roles exist only as mock data (current user, sidebar variant, the visible "Management only" chips). Nothing is enforced.
  - The project name stays **MR Garments**. "Import Tracking System" is the product subtitle shown on the auth screens.

## 2. Approved decisions

| # | Decision | What it means in practice |
| --- | --- | --- |
| D1 | **Screenshot-faithful, per-screen mock data** where the references contradict each other. Shared master fixtures where consistency is appropriate. | Each screen shows exactly the records in its screenshot, even when another screenshot disagrees (for example PO-2044 is "Ladies kurtis 3,200 pcs" on Orders and "Men's shirts 1,800 pcs" on Calendar). Master data (suppliers, shipping agents, clearing agents, transport companies, offices and warehouses, teams, item master, users, roles, current user) is canonical and shared. Every deliberate difference is logged in `docs/screenshot-inventory.md` §9 and in the agent's report. |
| D2 | **Screen agents own their screen fixtures** inside their feature folder. **The orchestrator owns master data and the common data contracts.** | Feature layout: `components → data/queries.ts → data/fixtures.ts`. UI never imports fixtures directly. Agents may import shared types and master data. They may **not** modify `src/types`, `src/mocks` or `src/lib/data`. Requests go to the orchestrator. The guard hook already blocks those paths. |
| D3 | **Exclude annotation labels** ("1.1", "3.1.a", "13.4" and so on, header-left and bottom-right) | Not rendered, and ignored in visual comparison. The **letter and number chips inside tabs** (a–i, a–c, 1–7, 1–3) are part of the tab design and **are** implemented. |
| D4 | **Arimo** as the initial font | Loaded through `next/font/google` at weights 400 and 700 (Arimo has no semibold), set as the `--font-sans` token. Phase 2 verifies it by overlaying a `/preview` capture on screenshot #4. |
| D5 | **No invented pages, dialogs or workflows.** Undesigned actions show one consistent informational toast. | One shared helper, `notInPrototype(action)` (section 4), produces the toast "**⟨Action⟩** is not included in the current prototype." To replace it later, grep for that one function. |
| D6 | **Consistent navigation** | The ADMIN section (Settings, Users) is visible on every authenticated Management screen. Month, Week and List tabs show on all calendar views. **The one exception is role-specific:** the staff sidebar (39) shows only Home and "YOUR STAGE", as the screenshot clearly shows. |

## 3. Defaults for the remaining open questions

| Topic | Default (documented, not invented UI) |
| --- | --- |
| **Notifications access** | No header bell or link exists in any reference. The sidebar user block (present on every screen) becomes a trigger for a small dropdown menu (shared `DropdownMenu` primitive) with **My profile**, **Notifications** and **Sign out**. It looks identical to the screenshots until clicked. `/notifications` also works by direct URL. *This menu is the one interaction not shown in the references. If you prefer, drop it and keep direct URLs only.* |
| **Profile access** | The same user-block menu goes to `/profile`. On the profile page, "Change password" goes to `/change-password` (3), and "Sign out" goes to `/login` with no auth logic. |
| **Currencies** | Supplier-side amounts are in **CNY (¥)** and converted amounts are in **INR (₹)**. Both use Indian digit grouping (`₹15,00,000`, `¥1,41,000`), exactly as shown. Each payment uses the rate of its own date. The currency select (New order, Add supplier) lists **CNY only**. USD ("Y or $" in the handwritten notes) is added only when the requirement is confirmed. Spacing variants ("¥ 62,780" against "¥80,000") and the lakh short form ("₹42.6 L") follow each screenshot. |
| **Printable PO** | **Not built**, because no reference exists (file 17.3 is a duplicate of the Add supplier dialog). "Print order" on the order detail header calls `notInPrototype("Print order")`. No route is created. |
| **Other undesigned actions** | Same D5 toast: Record payment, + Add deposit, Edit order, Excel/PDF exports, Export Excel/PDF, + Add (shipping agent, clearing agent, transport company, office or warehouse, team, item), row "Edit" links in settings, Mark all as read, Landed Cost "By team" and "By item" segments (the segmented control renders; only "By order" is active). |
| **Mock clock** | `MOCK_TODAY = 2026-09-30` (Wednesday) for screens that display "Today, 30 Sep 2026" and relative labels. Some references are snapshots from later days (PO-2028 received in the warehouse on 3 Oct). Per D1, those screens show their screenshot values **as stored fixture values**, not values recomputed from the clock (inventory §9). |
| **Viewport** | 1440 × 900 desktop is the only reference. Below 768 px (not designed): the sidebar becomes the existing sheet, wide tables scroll inside their card, and the page never scrolls horizontally. |

## 4. Shared design tokens and components (reviewed)

**Tokens.** These replace the placeholders in `src/app/globals.css`, using the measured values in `docs/screenshot-inventory.md` §4 (JPEG tolerance about ±3 per channel):

| Group | Values |
| --- | --- |
| Surfaces | page `#f5f6fb`, card and header `#ffffff`, border `#e2e4ec`, row divider `#eff0f3`, table head `#f8f9fd` |
| Text | foreground (navy-black, measured `#0a1b39` to `#12192d`, finalized by overlay), muted `#6b6e7c`, table head `#5f6f7e`, label `#393c4b` |
| Brand | primary `#2f6fed`, navy `#13213c`, sidebar gradient `#14223f → #1c3160` (item text `#c1ccec`, active `#323d59`, section label `#8b97bd`, bullet `#5e72a9`, divider `#263964`) |
| Inputs | border `#d2d4e1`, background `#fbfcfe`, read-only `#f2f3f8` |
| Status tones (bg / text) | danger `#fceced/#ac2c39`, warning `#fff2df/#9a5605`, success `#e6f5ee/#226d4e`, info `#eaf0ff/#3964c0`, purple `#f4ebfc/#6b41a3` (border `#d5caea`), neutral `#f2f3f8/#363a53`; strong red `#bf2837`, strong green `#1a7f4b` |
| Callouts | info `#eff3ff/#313e6a`, success `#e6f5ee/#2a6b49`, warning `#fff7ea/#ebd8b8/#604113` |
| Charts | blue `#2f6fed`, amber `#efa021`, green `#1d7e4d`, navy `#13213c`, track `#eef1f8`, today line `#c82e40` |
| Overlay | navy at 50% |
| Geometry | sidebar 240, header 68, tabs 46, page padding 32 / 22 (top), gap 18, radius: card 12, control 8, dialog 16, pill full |
| Type (Arimo) | 11 (section caps), 12 (pills), 13 (labels, KPI label, table head), 14 (body, tables), 15 (sidebar), 16 (card title), 20 (page title), 22 (detail title, dialog title), 30 (KPI value). Emphasis is 700. |

**Components to build or restyle in Phase 2.** Each one goes into `docs/component-contract.md` with its props before Wave 1:

| Component | Purpose | Used by (screenshot #) |
| --- | --- | --- |
| `AppShell` / `AppSidebar` | Management and staff variants: navy gradient, square bullets (no icons), section labels, user block with menu (§3), no collapse rail. | all app screens, 39 |
| `PageHeader` | renders **inside the 68 px header bar**: title or breadcrumb ("Orders / **PO-2028**") plus an actions slot (search, filter selects, `TodayPill`, buttons). Holds the page's `h1`. | all app screens |
| `RouteTabs` | link tabs with a letter or number chip and a 3 px underline, active state taken from the pathname (wrapped in Suspense). | 6–14, 18–20, 40–49 |
| `KpiCard` / `KpiRow` | label, value (`tone="danger"` option), sub-line | 4, 8, 9, 12, 16, 22, 24, 26, 28, 30, 31, 33–38 |
| `SectionCard` | titled card with optional right link or note | nearly all |
| `StatusPill` (replaces `StatusBadge`/`StockStatusBadge`), `TermsBadge` (FOB/CNF), `RoleBadge` | tinted pills in six tones | most screens |
| `FilterChips` | pill group with optional counts, active = navy. The segmented variant is used on 31 | 5, 20, 22, 24, 26, 28, 31, 40–47, 50 |
| `FilterSelect`, `SearchInput` | restyled: no search icon, optional inline small label ("Stage All stages ▾", "Search name or phone") | list screens |
| `DataTable` | tinted header, `density` (`compact` 39 / `default` 53 / `tall` 58), right-aligned numeric columns through column meta, totals row under a 2 px navy rule, selected-row highlight, numbered pagination ("Showing 1 to 10 of 50 orders", ‹ 1 … 5 ›) | all tables |
| `KeyValueList` | label and value rows, muted sub-rows, total under a 2 px rule | 6, 7, 8, 11, 13, 15, 21, 23, 25, 27, 29 |
| `ProgressBar`, `StageProgress` (6 segments), `StackedBar` with legend | bars | 4, 5, 7, 13, 23, 29, 31, 33 |
| `Journey` (horizontal steps), `ProgressTimeline` (done / current / pending), `ActivityList` | timelines | 6, 9, 10, 21, 23, 25, 27 |
| `Callout` (info, success, warning) | notes and banners | 8, 10, 12, 19, 25, 27, 29, 31, 32, 39 |
| `BarChart` (Recharts, value labels) | charts | 18, 34, 38 |
| Form kit | 42 px input, read-only and dashed-empty variants, required asterisk, select with ▾, textarea, `Switch`, `Checkbox`, "Attach photo" file input, right-aligned numeric cell input, `FormFooter` (Save draft + primary) | 15, 21, 23, 25, 27, 29, 48, 51, 53 |
| `Dialog` restyle | radius 16, navy 50% overlay, close × | 53 |
| `AuthLayout` | split navy panel with the six-stage list, centered card | 1–3 |
| `TodayPill` | "Today, 30 Sep 2026" from `MOCK_TODAY` | 4, 18–20, 39 |
| `notInPrototype(action)` | **D5** informational toast, the single replaceable helper | every undesigned action |
| Order-detail frame: `orders/[po]/layout.tsx`, `OrderContextStrip` | header breadcrumb, Print/Edit (D5), tabs a–i, context strip (each tab passes its own fact text) | 6–14 |
| Formatters | `formatINR`, `formatCNY` (spacing option), `formatLakh`, `formatRate`, `formatQty(value, unit)`, `formatDate` variants (`30 Sep 2026`, `26 Sep`, `3 Oct 2026, 16:10`, `Today, 09:12`, `Yesterday, 17:05`) | all |

**Dependencies:** `npx shadcn add switch checkbox textarea` and nothing else. The calendar grid and the Gantt
timeline are custom (date-fns and CSS grid). Arimo comes through `next/font/google` and needs no npm package.

## 5. Routes (reviewed)

The full mapping is in `docs/screenshot-inventory.md` §5. Review notes:
- **Route groups:** `(app)` for the Management shell (renamed from `(dashboard)`), `(staff)` for `/home` with the staff sidebar, and `(auth)` for `/login`, `/forgot-password` and `/change-password` with `AuthLayout` and no shell.
- **Dynamic segments** (`/orders/[po]`, `/clearing/[container]`, `/transport/[container]`): add `generateStaticParams` from the fixture IDs, so `cacheComponents` prerenders them and the sidebar's `usePathname` does not suspend.
- **`?dialog=add-supplier`:** read with `useSearchParams` inside a `<Suspense>` boundary. A dialog driven by the URL also resets correctly under `<Activity>`.
- **`/settings`** redirects to `/settings/suppliers`. `/users/edit` is the "Add or edit user" tab (48), shown prefilled with the screenshot user.
- **No route** for Printable PO, Record payment, Edit order or Add deposit (D5).

## 6. Screen ownership matrix (reviewed)

There are 22 logical screens (51 unique images), more than 7 agents can take at once, so the work runs in **three waves of up to 7 agents**.
Each agent owns one screen or one route family. A list and its form for the same stage stay with one agent, because they share a
route segment and a feature folder. Order detail is split by tab ownership.

| Wave | Agent | Screen(s) | Routes | Refs | Owned feature path(s) |
| --- | --- | --- | --- | --- | --- |
| 1 | W1-dashboard | Management dashboard | `/` | 4 | `src/features/dashboard/` |
| 1 | W1-orders | Orders list | `/orders` | 5 | `src/features/orders/` |
| 1 | W1-order-detail-a | Order detail tabs a–e | `/orders/[po]` (`page.tsx`), `/items`, `/payments`, `/receiving`, `/containers` | 6–10 | `src/features/order-detail/{overview,items,payments,receiving,containers}/` |
| 1 | W1-order-detail-b | Order detail tabs f–i | `/orders/[po]/clearing-transport`, `/warehouse`, `/cost`, `/history` | 11–14 | `src/features/order-detail/{clearing-transport,warehouse,cost,history}/` |
| 1 | W1-payments | Deposits & Payments | `/payments` | 16 | `src/features/payments/` |
| 1 | W1-calendar | Delivery Calendar (Month, Week, List) | `/calendar`, `/calendar/week`, `/calendar/list` (plus the calendar `layout.tsx`) | 18, 19, 20 | `src/features/calendar/` |
| 1 | W1-receiving | Receiving (China): list and Record receipt | `/receiving`, `/receiving/new` | 22, 21 | `src/features/receiving/` |
| 2 | W2-new-order | New order | `/orders/new` | 15 | `src/features/order-form/` |
| 2 | W2-containers | Containers: list and Load container | `/containers`, `/containers/new` | 24, 23 | `src/features/containers/` |
| 2 | W2-clearing | Clearing: list and form | `/clearing`, `/clearing/[container]` | 26, 25 | `src/features/clearing/` |
| 2 | W2-transport | Transport: list and form | `/transport`, `/transport/[container]` | 28, 27 | `src/features/transport/` |
| 2 | W2-warehouse | Warehouse: list and Receive goods | `/warehouse`, `/warehouse/receive` | 30, 29 | `src/features/warehouse/` |
| 2 | W2-landed-cost | Landed Cost | `/landed-cost` | 31 | `src/features/landed-cost/` |
| 2 | W2-reports | Reports hub and 6 reports | `/reports/**` | 32–38 | `src/features/reports/` |
| 3 | W3-settings | Settings (7 tabs) and Add supplier dialog | `/settings/**` | 40–46, 53 | `src/features/settings/` |
| 3 | W3-users | Users list, add/edit, roles | `/users/**` | 47–49 | `src/features/users/` |
| 3 | W3-staff-home | Staff home | `/home` | 39 | `src/features/staff-home/` |
| 3 | W3-account | Notifications and My profile | `/notifications`, `/profile` | 50, 51 | `src/features/notifications/`, `src/features/profile/` |
| 3 | W3-auth | Sign in, Forgot password, Change password | `/login`, `/forgot-password`, `/change-password` | 1–3 | `src/features/auth/` |

**Every agent owns exactly** its route folder(s), its feature folder(s) including `data/` (D2), and
`e2e/<agent-name>.spec.ts`. **The orchestrator owns** `src/app/(app)/orders/[po]/layout.tsx`,
`src/features/order-detail/shared/` (context strip and shared PO-2028 header data), all route-group layouts,
`/preview`, and everything listed in §7.

**Why the waves are ordered this way:**
- Wave 1 uses nearly every shared component (KPI cards, tables, tabs, timelines, forms, calendar pills), so contract gaps surface early.
- Wave 2 repeats the list-and-form stage pattern with a stabilized kit.
- Wave 3 is the most repetitive and lowest-risk work.

## 7. Shared-file conflicts

| Hotspot | Resolution |
| --- | --- |
| `src/config/navigation.ts` (both sidebar variants) | finalized with every route in Phase 2 |
| `src/app/globals.css`, `src/app/layout.tsx` (Arimo, metadata) | finalized in Phase 2. Agents report token gaps with exact values |
| `src/components/{ui,layout,shared}`, `notInPrototype` | contract frozen for the duration of a wave. Changes are made between waves by the orchestrator, with every consumer updated |
| `src/types`, `src/mocks`, `src/lib/data` (master data, contracts), `src/lib/formatters.ts`, `MOCK_TODAY` | orchestrator only (D2), hook-enforced |
| `orders/[po]/layout.tsx` and `features/order-detail/shared/` | orchestrator only. Agents A and B own disjoint tab subfolders |
| `/orders` vs `/orders/new` vs `/orders/[po]` | separate route folders and separate feature folders, so no file is shared |
| `package.json`, lockfile, `components.json` | all installs happen in Phase 2. The hook blocks agents |
| `e2e/` | one spec per agent, named after the agent. Ports are unique per agent |
| `docs/`, `CLAUDE.md`, `.claude/` | orchestrator only, hook-enforced |

## 8. Git worktree ownership

- **Before each wave:**
  1. Merge everything onto `main` and run `npm run validate`.
  2. Commit. Worktrees branch from the **default branch**, not the current HEAD.
  3. Confirm `.claude/settings.json` still has `worktree.symlinkDirectories: ["node_modules"]`.
- **Spawning:** one `screen-builder` per matrix row, all started in the same message as background agents, each in its own worktree under `.claude/worktrees/<agent>`, with dev port `3000+n` and `E2E_PORT` `3100+n`.
- **References:** assignments give screenshot paths as **absolute paths into the main checkout**, so agents can read them even if the screenshot folder is not committed (§9).
- **Enforcement:**
  - The guard hook blocks installs, the shadcn CLI, `git push`, shared paths and paths outside the agent's tree.
  - Owned paths are disjoint by construction.
  - The orchestrator rejects any diff outside them. Per-feature ownership is not machine-enforced between two feature folders.
- **Integration:** merge **one branch at a time**, in matrix order, and run `npm run validate` plus `npm run test:e2e` after each merge. Shared-component requests are batched between waves.
- **Before Wave 1:** spawn one real agent and confirm it can run `npm run typecheck` in its worktree, and that the hook blocks `npm install` there.

## 9. Reference screenshots (about 33 MB)

**Decision B2 (approved):** the folder stays at
`D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots` and is **not committed**.
- `.gitignore` has `/docs/MR_Garments_Screenshots/`.
- **Verified:** `git check-ignore -v` matches the rule for the files, all 54 files are reported as ignored, and none appear as untracked.
- Nothing was moved, renamed or modified.
- Worktree agents read the references through absolute paths into the main checkout.

## 10. Phase 2 checklist (done 2026-10-23)

1. ✅ **Scope cleanup:**
   - The inventory model, its fixture and tests, and the shadcn sidebar are removed.
   - `(dashboard)` is renamed to `(app)`.
   - The metadata says "Import Tracking System".
2. ✅ **Tokens:** measured values applied in `globals.css`. Three tokens were found during verification: `chip-muted`, `toggle-off` and `sidebar-detail`.
3. ✅ **Font:** Arimo 400/700 through `next/font`. The overlay against the references led to these corrections: nav 14.4 px, page title 21 px, breadcrumb parent 14 px, user block 13.6/12 px, section-label tracking 0.16em.
4. ✅ **Components:** every §4 component is built or restyled, shown on `/preview`, and documented in `docs/component-contract.md`.
5. ✅ **Data:**
   - Formatters with tests, and `MOCK_TODAY`.
   - `src/types/domain.ts`.
   - Master data transcribed from references 40–49, with async accessors.
   - The order-detail header data.
6. ✅ **Routes:**
   - Groups `(app)`, `(staff)` and `(auth)`, with both sidebar variants and the B3 user menu.
   - 48 placeholder pages, the settings redirect, 3 auth placeholders, and `/preview`.
   - The order-detail frame, with `generateStaticParams` for PO-2028.
7. ✅ **Hook:** protects the group layouts, `/preview`, the order-detail frame and shared folder, `e2e/shell.spec.ts`, Impeccable files and Impeccable setup commands. 36/36 cases pass.
8. ✅ **Assignments:** `docs/assignments/wave-1/` (7 files, not launched).
9. ✅ **Tooling and checks:**
   - `scripts/visual-diff.mjs` captures at the reference size and writes reference | ours | diff.
   - `e2e/shell.spec.ts` has 6 tests.
   - Lint, typecheck, unit tests, build and e2e all run. Results are in the report.

**Shell fidelity** after the corrections. Mean channel difference per region against the references, from `scripts/visual-diff.mjs`. JPEG noise and anti-aliasing account for most of what remains:

| Region | Reference | Mean diff | Remaining named differences |
| --- | --- | --- | --- |
| Sidebar nav (0,0,240×480) | 04 | 4.5/255 | sub-pixel text rendering |
| Sidebar with ADMIN (0,0,240×900) | 07 | 4.0/255 | as above |
| Sidebar footer (0,800,240×100) | 04 | 2.6/255 (was 5.5) | fixed: text position and detail color |
| Header title (240,0,400×68) | 04 | 2.7/255 | none visible |
| Tab bar (240,68,1200×46) | 07 | 8.7/255 | about 1 px vertical offset of the tab contents; anti-aliasing |
| Staff sidebar (0,0,240×900) | 39 | 1.7/255 | none visible |
| Auth panel (0,0,700×900) | 01 | 3.4/255 | stage-list letter spacing and size adjusted |

## 11. Open items before Wave 1

| # | Item | Needed from you |
| --- | --- | --- |
| W1-A | **Approval to launch Wave 1** (7 agents, §6) | An explicit go-ahead. |
| W1-B | ✅ **Impeccable installed** at project scope and verified 2026-10-23 (CLAUDE.md, "Impeccable"). The design hook is on and non-blocking. The guard now also blocks the in-repo launcher's config verbs. | Optional: run `/impeccable init` and `/impeccable document`. |
| W1-C | **Pilot agent** (§8): `W1-dashboard` only. A pre-flight on a manual worktree passed after the `turbopack.root` fix (typecheck, dev, build, guard, Impeccable `detect`, visual-diff at 1440 × 900). See `docs/multi-agent-plan.md`. | Approval to commit the Impeccable setup (worktrees branch from `main`), then approval to spawn the pilot. |
| B5 | **Node 20.20.2** (advisory) | Upgrade to Node 22 LTS when convenient. The project runs on both, with pinned Vitest 4 and jsdom 29. |

## 12. Not planned (needs references or requirements)

- **Screens with no reference:** Printable PO, Record payment, Add deposit, Edit order, the "Paid payments page" mentioned on 13.5, export output, Add/Edit forms for the six settings tabs other than Suppliers, Landed Cost "By team" and "By item".
- **Handwritten-note requirements:** colour codes, full item history, CNY/USD choice, per-item cost details, "Sale mr", "Orders needs list", proposal engine, additional and advance payments, receivables.
- **Backend work:** real authentication, permission enforcement and persistence.
