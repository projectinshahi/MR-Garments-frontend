import type { Page, TestInfo } from "@playwright/test";

import type { SupplierRow } from "../src/lib/api/types";
import { type Api, expect, kpi, kv, test, toast } from "./live-api";
import { MANAGEMENT_STATE, PROCUREMENT_STATE } from "./sessions";

// Suppliers (sidebar, Management › after Landed Cost; backend docs/suppliers.md): the KPI cards, the Supplier List
// with search, filters, sorting, paging and row actions, the Add / Edit dialog, the supplier's page (View), and the
// Performance and Analytics tabs, against the live API. Role and label locators only. Records are made inside the
// tests through the API or the form, with a unique name each run.

test.use({ viewport: { width: 1440, height: 900 } });

const tag = () => String(Date.now()).slice(-6);
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const tabs = (page: Page) => page.getByRole("navigation", { name: "Supplier sections" });
const rows = (page: Page) => page.getByRole("table").getByRole("row");
const search = (page: Page) => page.getByRole("searchbox", { name: "Search supplier name, code or country" });
/** The visible card (SectionCard) titled `title`. */
const card = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }), visible: true });
/** A supplier made through MD-2 with only a name (the API assigns its code); `remove` deletes it (it has no orders). */
async function addSupplier(api: Api, name: string) {
  const response = await api.post("/suppliers", { name });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { supplier: { id: string } }).supplier;
}
const remove = async (api: Api, id: string) => expect((await api.request.delete(`/api/v1/suppliers/${id}`, { data: {} })).status()).toBe(204);
/** Full-page screenshots go to SHOTS_DIR when set (the report's folder), else the test's output folder. */
const shot = (page: Page, testInfo: TestInfo, name: string) =>
  page.screenshot({ path: process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name), fullPage: true });

test("Suppliers sits between Landed Cost and Reports; the list has the cards, search, filters, sorting and paging", async ({ page, api }, testInfo) => {
  // Two suppliers of this run's own, so there are more than five rows to page through whatever the database holds.
  const paging = [await addSupplier(api, `Paging Supplier A ${tag()}`), await addSupplier(api, `Paging Supplier B ${tag()}`)];
  await page.goto("/suppliers");
  const links = (await nav(page).getByRole("link").allInnerTexts()).map((text) => text.trim());
  expect(links.indexOf("Suppliers")).toBe(links.indexOf("Landed Cost") + 1);
  expect(links.indexOf("Reports")).toBe(links.indexOf("Suppliers") + 1);
  await expect(nav(page).getByRole("link", { name: "Suppliers", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Suppliers" })).toBeVisible();
  for (const label of ["Total Suppliers", "Open POs", "In Transit", "Unpaid Amount", "Upcoming Payments"]) await expect(kpi(page, label)).toBeVisible();
  await expect(kpi(page, "Total Suppliers")).toContainText(/Active: \d+ · Inactive: \d+/);
  await expect(tabs(page).getByRole("link", { name: "Supplier List" })).toHaveAttribute("aria-current", "page");
  for (const header of ["Supplier Code", "Supplier Name", "Country", "Contact Person", "Email / Phone", "Active POs", "YTD Value", "Balance", "Status"]) {
    await expect(page.getByRole("columnheader", { name: new RegExp(header) })).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 2, name: /^Suppliers \(\d+\)$/ })).toBeVisible();
  // The five seeded suppliers at least, with their backfilled codes and country.
  expect(await rows(page).count()).toBeGreaterThan(5);
  await expect(rows(page).filter({ hasText: "Guangzhou Textile Co." })).toContainText("SUP-001");
  await expect(rows(page).filter({ hasText: "Guangzhou Textile Co." })).toContainText("China");
  await shot(page, testInfo, "suppliers-list-1440.png");

  // Search by code, then by country; the country select; the status chips.
  await search(page).fill("sup-003");
  await expect(rows(page).filter({ hasText: "Foshan Fabrics" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "Shenzhen Apparel" })).toHaveCount(0);
  await search(page).fill("china");
  expect(await rows(page).count()).toBeGreaterThan(5);
  await search(page).fill("");
  await page.getByRole("button", { name: /^Country:/ }).click();
  await page.getByRole("menuitemradio", { name: "China" }).click();
  await expect(rows(page).filter({ hasText: "Foshan Fabrics" })).toHaveCount(1);
  await page.getByRole("button", { name: /^Country:/ }).click();
  await page.getByRole("menuitemradio", { name: "All countries" }).click();
  await page.getByRole("button", { name: /^Status:/ }).click();
  await page.getByRole("menuitemradio", { name: "Inactive" }).click();
  await expect(rows(page).filter({ hasText: "Guangzhou Textile Co." })).toHaveCount(0);
  await page.getByRole("button", { name: /^Status:/ }).click();
  await page.getByRole("menuitemradio", { name: "All" }).click();
  await expect(rows(page).filter({ hasText: "Guangzhou Textile Co." })).toHaveCount(1);

  // Rows per page and the range; sorting by code.
  await page.getByLabel("Rows per page").selectOption("5");
  await expect(rows(page)).toHaveCount(6);
  await expect(page.getByText(/^Showing 1 to 5 of \d+ suppliers$/)).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(/^Showing 6 to \d+ of \d+ suppliers$/)).toBeVisible();
  await page.getByRole("button", { name: "Page 1" }).click();
  await page.getByLabel("Rows per page").selectOption("50");
  const code = page.getByRole("columnheader", { name: /Supplier Code/ }).getByRole("button");
  const position = async (text: string) => (await rows(page).allInnerTexts()).findIndex((row) => row.includes(text));
  await code.click();
  await expect(page.getByRole("columnheader", { name: /Supplier Code/ })).toHaveAttribute("aria-sort", "ascending");
  expect(await position("SUP-001")).toBeLessThan(await position("SUP-002"));
  await code.click();
  await expect(page.getByRole("columnheader", { name: /Supplier Code/ })).toHaveAttribute("aria-sort", "descending");
  expect(await position("SUP-001")).toBeGreaterThan(await position("SUP-002"));
  await page.getByLabel("Rows per page").selectOption("10");
  for (const supplier of paging) await remove(api, supplier.id);
});

test("adds a supplier with the offered code, views, edits and deactivates it from the row actions", async ({ page, api }, testInfo) => {
  const name = `Playwright Mills ${tag()}`;
  await page.goto("/suppliers");
  await page.getByRole("link", { name: "Add Supplier" }).click();
  const dialog = page.getByRole("dialog", { name: "Add supplier" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Supplier code")).toHaveValue(/^SUP-\d{3,}$/);
  const code = await dialog.getByLabel("Supplier code").inputValue();
  await shot(page, testInfo, "add-supplier.png");

  // Validation: an email without a domain and a phone with letters are refused before any request.
  await dialog.getByLabel("Supplier name").fill(name);
  await dialog.getByLabel("Email").fill("nope");
  await dialog.getByLabel("Phone").fill("call me");
  await dialog.getByRole("button", { name: "Save supplier" }).click();
  await expect(dialog.getByText("Enter a valid email address.")).toBeVisible();
  await expect(dialog.getByText("Enter a valid phone number.")).toBeVisible();
  await dialog.getByLabel("Email").fill("sales@mills.example");
  await dialog.getByLabel("Phone").fill("+84 90 123 4567");
  await dialog.getByLabel("Country").selectOption("Vietnam");
  await dialog.getByLabel("Contact person").fill("Ms. Tran Linh");
  await dialog.getByLabel("City").fill("Hanoi");
  await dialog.getByLabel("Payment terms").fill("50% deposit, balance on shipment");
  // The rate (INR per 1 CNY) is required (docs/supplier-currency.md).
  await dialog.getByLabel(/^Exchange rate/).fill("12.5");
  await dialog.getByRole("button", { name: "Save supplier" }).click();
  await expect(toast(page, "Supplier added")).toBeVisible();
  await expect(dialog).toBeHidden();

  await search(page).fill(name);
  const row = rows(page).filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(code);
  await expect(row).toContainText("Vietnam");
  await expect(row).toContainText("sales@mills.example");
  await expect(row).toContainText("+84 90 123 4567");
  await expect(row).toContainText("Active");
  // The code is unique: the API refuses a second supplier with it.
  expect((await api.post("/suppliers", { name: `${name} B`, code })).status()).toBe(409);

  // View: the supplier's page, with the profile and the way back.
  await row.getByRole("link", { name: `View ${name}` }).click();
  await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(kv(page, "Supplier code")).toHaveText(code);
  await expect(kv(page, "Country")).toHaveText("Vietnam");
  await expect(kv(page, "Email")).toHaveText("sales@mills.example");
  await expect(kv(page, "Payment terms")).toHaveText("50% deposit, balance on shipment");
  await expect(page.getByRole("heading", { level: 2, name: "Orders" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Payments" })).toBeVisible();
  await expect(kpi(page, "Balance to pay")).toBeVisible();
  await shot(page, testInfo, "view-supplier.png");
  await page.locator("header").getByRole("link", { name: "Suppliers" }).click();
  await expect(page).toHaveURL("/suppliers");

  // Edit from the row: the same form, filled; the code stays.
  await search(page).fill(name);
  await row.getByRole("link", { name: `Edit ${name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit supplier" });
  await expect(edit.getByLabel("Supplier code")).toHaveValue(code);
  await expect(edit.getByLabel("Country")).toHaveValue("Vietnam");
  await shot(page, testInfo, "edit-supplier.png");
  await edit.getByLabel("City").fill("Da Nang");
  await edit.getByRole("button", { name: "Save supplier" }).click();
  await expect(toast(page, "Supplier saved")).toBeVisible();
  const [saved] = await api.get<SupplierRow[]>(`/suppliers?search=${encodeURIComponent(name)}`);
  expect(saved).toMatchObject({ code, city: "Da Nang", country: "Vietnam", status: "Active" });

  // More: Deactivate asks first; Activate does not.
  await search(page).fill(name);
  await row.getByRole("button", { name: `More actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Deactivate supplier" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Deactivate supplier?" });
  await confirm.getByRole("button", { name: "Deactivate supplier" }).click();
  await expect(toast(page, "Supplier deactivated")).toBeVisible();
  await expect(row).toContainText("Inactive");
  await row.getByRole("button", { name: `More actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Activate supplier" }).click();
  await expect(toast(page, "Supplier activated")).toBeVisible();
  await expect(row).toContainText("Active");
  // Deleted at the end (it has no orders or deposits), so the shared test database is left as it was found.
  await remove(api, saved!.id);
});

test("Performance and Analytics show figures from real orders and receipts, filtered by supplier", async ({ page, api }, testInfo) => {
  // An order received in China today, so the dashboards have a delivery to measure.
  const { po } = await api.createOrder({ supplier: "Foshan Fabrics" });
  await api.receive(po, { "Denim jeans": 100 });

  await page.goto("/suppliers/performance");
  await expect(tabs(page).getByRole("link", { name: "Supplier Performance" })).toHaveAttribute("aria-current", "page");
  for (const label of ["Total suppliers", "PO completion rate", "On-time delivery rate", "Delayed deliveries", "Average delivery time"]) {
    await expect(kpi(page, label)).toBeVisible();
  }
  await expect(kpi(page, "On-time delivery rate")).toContainText(/\d+%/);
  await expect(card(page, "Top-performing suppliers").getByRole("row").filter({ hasText: "Foshan Fabrics" })).toHaveCount(1);
  await expect(card(page, "Supplier-wise purchase value").getByRole("row").filter({ hasText: "Foshan Fabrics" })).toHaveCount(1);
  await expect(page.getByRole("figure", { name: "On-time delivery rate by supplier" })).toBeVisible();
  await shot(page, testInfo, "supplier-performance-1440.png");

  await page.getByRole("button", { name: /^Supplier:/ }).click();
  await page.getByRole("menuitemradio", { name: "Foshan Fabrics" }).click();
  await expect(page).toHaveURL(/supplier=/);
  // The filter pill next to the title (the Supplier select names it too).
  await expect(page.locator("header").getByText("Foshan Fabrics", { exact: true }).first()).toBeVisible();
  await expect(card(page, "Supplier-wise purchase value").getByRole("row").filter({ hasText: "Guangzhou Textile Co." })).toHaveCount(0);

  await page.goto("/suppliers/analytics");
  await expect(tabs(page).getByRole("link", { name: "Supplier Analytics" })).toHaveAttribute("aria-current", "page");
  for (const title of ["Supplier-wise purchase value", "Country-wise supplier distribution", "Monthly purchase trends", "Outstanding balance by supplier", "Top suppliers by purchase value", "Supplier payment trends"]) {
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  }
  await expect(page.getByRole("figure", { name: "Purchase value by supplier, CNY" })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Suppliers by country" })).toBeVisible();
  await expect(card(page, "Top suppliers by purchase value").getByRole("row").filter({ hasText: "Foshan Fabrics" })).toHaveCount(1);
  await shot(page, testInfo, "supplier-analytics-1440.png");
});

test("fits a phone without sideways scrolling; Procurement has no Suppliers entry and is sent away", async ({ browser }, testInfo) => {
  const phone = await browser.newContext({ storageState: MANAGEMENT_STATE, viewport: { width: 390, height: 844 } });
  const small = await phone.newPage();
  await small.goto("/suppliers");
  await expect(small.getByRole("heading", { level: 1, name: "Suppliers" })).toBeVisible();
  await expect(small.getByRole("heading", { level: 2, name: /^Suppliers \(\d+\)$/ })).toBeVisible();
  expect(await small.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await shot(small, testInfo, "suppliers-list-390.png");
  await phone.close();

  const procurement = await browser.newContext({ storageState: PROCUREMENT_STATE, viewport: { width: 1440, height: 900 } });
  const priya = await procurement.newPage();
  await priya.goto("/suppliers");
  await expect(priya).not.toHaveURL(/\/suppliers/);
  await expect(nav(priya).getByRole("link", { name: "Suppliers", exact: true })).toHaveCount(0);
  await procurement.close();
});
