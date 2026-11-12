import type { Locator, Page, TestInfo } from "@playwright/test";

import type { OrderOptions, SupplierRow } from "../src/lib/api/types";
import { type Api, expect, field, kpi, kv, test, toast, today } from "./live-api";

// Supplier currency and exchange rate (backend docs/supplier-currency.md), against the live API: the Add / Edit
// supplier fields (INR fixed at 1, a rate for the rest), the list columns, the supplier's page, the currency shown
// not chosen on New order and the deposit's and payment's default rate, the API's refusals, and the rate kept on an
// order when the supplier's rate moves on. Records are made inside the tests with a unique name each run.

test.use({ viewport: { width: 1440, height: 900 } });

const tag = () => String(Date.now()).slice(-6);
// fullPage: false for a phone-sized page: a full-page capture paints the page behind an open dialog above it.
const shot = (page: Page, testInfo: TestInfo, name: string, fullPage = true) =>
  page.screenshot({ path: process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name), fullPage });
/** Waits out the picker panel's open animation, so a screenshot shows it opaque. */
const pickerSettled = (page: Page) => page.locator('[data-slot="popover-content"]').evaluate((panel) => Promise.all(panel.getAnimations().map((animation) => animation.finished)));
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const currencyField = (scope: Locator) => scope.getByLabel("Preferred transaction currency");
/** Picks a currency in the searchable picker: opens it, types `text` (a code, a name or a symbol), clicks the row of `code`. */
async function pickCurrency(dialog: Locator, code: string, text = code) {
  await currencyField(dialog).click();
  await dialog.page().getByRole("searchbox", { name: "Search currencies" }).fill(text);
  await dialog.page().getByRole("option", { name: new RegExp(`^${code} `) }).click();
}
const rateField = (scope: Locator) => scope.getByLabel(/^Exchange rate/);
const search = (page: Page) => page.getByRole("searchbox", { name: "Search supplier name, code or country" });
const rowOf = (page: Page, name: string) => page.getByRole("table").getByRole("row").filter({ hasText: name });
async function supplierNamed(api: Api, name: string) {
  const [row] = await api.get<SupplierRow[]>(`/suppliers?search=${encodeURIComponent(name)}`);
  expect(row, name).toBeDefined();
  return row!;
}
/** MD-2 with a currency and rate; the supplier has no orders, so `remove` can delete it. */
async function newSupplier(api: Api, body: { name: string; currency: "CNY" | "USD" | "INR"; exchangeRate?: number }) {
  const response = await api.post("/suppliers", body);
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { supplier: SupplierRow }).supplier;
}
const remove = async (api: Api, id: string) => expect((await api.request.delete(`/api/v1/suppliers/${id}`, { data: {} })).status()).toBe(204);

test("Add supplier: INR fixes the rate at 1, CNY takes a rate (checked), the list and the supplier's page show them, Edit changes both", async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);
  const rupee = `Rupee Mills ${tag()}`;
  const yuan = `Yuan Mills ${tag()}`;

  await test.step("INR: the rate is 1, read-only", async () => {
    await page.goto("/suppliers");
    await page.getByRole("link", { name: "Add Supplier" }).click();
    const add = dialog(page, "Add supplier");
    await expect(add).toBeVisible();
    await expect(currencyField(add)).toContainText("CNY – Chinese Yuan (¥)");
    await expect(rateField(add)).toHaveValue("");
    await add.getByLabel("Supplier name").fill(rupee);
    await pickCurrency(add, "INR", "rupee");
    await expect(rateField(add)).toHaveValue("1");
    await expect(rateField(add)).toHaveJSProperty("readOnly", true);
    await expect(add.getByText("INR is the base currency: the rate is fixed at 1.")).toBeVisible();
    await shot(page, testInfo, "add-supplier-inr.png");
    await add.getByRole("button", { name: "Save supplier" }).click();
    await expect(toast(page, "Supplier added")).toBeVisible();
    await expect(add).toBeHidden();
    expect(await supplierNamed(api, rupee)).toMatchObject({ currency: "INR", exchangeRate: 1, hasTransactions: false });
  });

  await test.step("CNY: a rate above 0 with at most 4 decimals is required; the direction is spelled out", async () => {
    await page.getByRole("link", { name: "Add Supplier" }).click();
    const add = dialog(page, "Add supplier");
    await add.getByLabel("Supplier name").fill(yuan);
    await expect(rateField(add)).toHaveAccessibleName("Exchange rate (1 CNY = ? INR)");
    await rateField(add).fill("0");
    await add.getByRole("button", { name: "Save supplier" }).click();
    await expect(add.getByText("Enter the exchange rate: INR per 1 unit, above 0, with at most 4 decimals.")).toBeVisible();
    await rateField(add).fill("12.5");
    await expect(add.getByText("1 CNY = ₹12.50")).toBeVisible();
    await shot(page, testInfo, "add-supplier-cny-rate.png");
    await add.getByRole("button", { name: "Save supplier" }).click();
    // The dialog closes once the save is through; the INR step's toast may still be showing beside this one.
    await expect(add).toBeHidden();
    await expect(toast(page, "Supplier added").first()).toBeVisible();
    expect(await supplierNamed(api, yuan)).toMatchObject({ currency: "CNY", exchangeRate: 12.5, rateUpdatedAt: expect.any(String) });
  });

  await test.step("the list: Currency and Exchange Rate columns", async () => {
    await expect(page.getByRole("columnheader", { name: "Currency" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Exchange Rate" })).toBeVisible();
    await search(page).fill("Mills");
    await expect(rowOf(page, rupee).getByRole("cell").filter({ hasText: /^INR$/ })).toBeVisible();
    await expect(rowOf(page, rupee).getByRole("cell").filter({ hasText: /^1\.00$/ })).toBeVisible();
    await expect(rowOf(page, yuan).getByRole("cell").filter({ hasText: /^CNY$/ })).toBeVisible();
    await expect(rowOf(page, yuan).getByRole("cell").filter({ hasText: /^₹12\.50$/ })).toBeVisible();
    await shot(page, testInfo, "suppliers-table-currency.png");
  });

  await test.step("the supplier's page: currency information", async () => {
    await rowOf(page, yuan).getByRole("link", { name: `View ${yuan}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: yuan })).toBeVisible();
    await expect(kv(page, "Preferred currency")).toHaveText("¥ Chinese yuan");
    await expect(kv(page, "Exchange rate")).toHaveText("1 CNY = ₹12.50");
    await expect(kv(page, "Rate last updated")).not.toHaveText("–");
    await expect(kv(page, "INR equivalent")).toContainText("Amount × rate");
    await shot(page, testInfo, "supplier-details-currency.png");
  });

  await test.step("Edit: a new currency starts with an empty rate and needs one; without transactions it saves at once", async () => {
    await page.getByRole("link", { name: "Edit supplier" }).click();
    const edit = dialog(page, "Edit supplier");
    await expect(rateField(edit)).toHaveValue("12.5");
    await pickCurrency(edit, "USD");
    await expect(rateField(edit)).toHaveValue("");
    await expect(rateField(edit)).toHaveAccessibleName("Exchange rate (1 USD = ? INR)");
    await rateField(edit).fill("88.25");
    await expect(edit.getByText("1 USD = ₹88.25")).toBeVisible();
    await shot(page, testInfo, "edit-supplier-currency.png");
    await edit.getByRole("button", { name: "Save supplier" }).click();
    await expect(edit).toBeHidden();
    await expect(toast(page, "Supplier saved")).toBeVisible();
    expect(await supplierNamed(api, yuan)).toMatchObject({ currency: "USD", exchangeRate: 88.25 });
  });

  for (const name of [rupee, yuan]) await remove(api, (await supplierNamed(api, name)).id);
});

test("New order and payments take the supplier's currency and rate; the API refuses another currency; an order keeps its rate when the supplier's changes", async ({ page, api }, testInfo) => {
  test.setTimeout(150_000);
  const name = `Dollar Knits ${tag()}`;
  const supplier = await newSupplier(api, { name, currency: "USD", exchangeRate: 88 });
  const options = await api.get<OrderOptions>("/orders/options");
  const item = options.items.find((row) => row.name === "Denim jeans")!;
  let po = "";

  await test.step("New order: the currency is the supplier's, shown not chosen; a deposit starts at the supplier's rate", async () => {
    await page.goto("/orders/new");
    await page.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: name });
    await expect(page.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("USD ($)");
    await expect(page.getByRole("textbox", { name: "Currency", exact: true })).toHaveJSProperty("readOnly", true);
    await expect(page.getByText("Supplier rate now: 1 USD = ₹88.00")).toBeVisible();
    await field(page, "Delivery date").fill(today(20));
    await page.getByRole("combobox", { name: "Item, line 1", exact: true }).selectOption({ label: "Denim jeans" });
    await page.getByRole("textbox", { name: "Rate ($), line 1", exact: true }).fill("2");
    await page.getByRole("textbox", { name: "Quantity, line 1", exact: true }).fill("100");
    await page.getByRole("button", { name: "+ Add deposit" }).click();
    await expect(field(page, "Rate to INR")).toHaveValue("88");
    await page.getByRole("textbox", { name: "Amount ($), deposit 1", exact: true }).fill("50");
    await field(page, "Mode").fill("Wire");
    await expect(kv(page, "Deposits in INR")).toHaveText("₹4,400");
    await shot(page, testInfo, "new-order-supplier-currency.png");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/orders\/PO-\d+$/);
    po = new URL(page.url()).pathname.split("/").pop()!;
    expect(await api.order(po)).toMatchObject({ currency: "USD", exchangeRate: 88, orderValueCny: 200 });
  });

  await test.step("the API refuses an order or a deposit in another currency for this supplier", async () => {
    const body = { supplierId: supplier.id, currency: "CNY", orderDate: today(), deliveryDate: today(20), lines: [{ itemId: item.id, quantity: 1, rateCny: 1 }], deposits: [] };
    const refused = await api.post("/orders", body);
    expect(refused.status()).toBe(422);
    expect(((await refused.json()) as { error: { fields: object } }).error.fields).toEqual({ currency: "This supplier's orders are in USD." });
    const deposit = await api.post(`/suppliers/${supplier.id}/deposits`, { direction: "give", amount: 100, currency: "CNY", openedOn: today() });
    expect(deposit.status()).toBe(422);
    expect(((await deposit.json()) as { error: { fields: object } }).error.fields).toEqual({ currency: "This supplier's deposits are in USD." });
  });

  await test.step("Record payment: the supplier's rate now is the default, still editable", async () => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
    const form = dialog(page, "Record payment");
    await form.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: `${po} · ${name}` });
    await expect(form.getByRole("textbox", { name: "Rate (₹ per $)", exact: true })).toHaveValue("88");
    await expect(form.getByText("Supplier rate now: 1 USD = ₹88.00. Change it if this payment used another.")).toBeVisible();
    await form.getByRole("combobox", { name: "Kind", exact: true }).selectOption("Balance");
    await form.getByRole("textbox", { name: "Amount ($)", exact: true }).fill("150");
    await expect(form.getByRole("status")).toHaveText("₹13,200");
    await shot(page, testInfo, "payment-supplier-currency.png");
    await form.getByRole("button", { name: "Cancel" }).click();
  });

  await test.step("Edit a supplier with transactions: a new rate asks first and applies to new transactions only", async () => {
    await page.goto("/suppliers");
    await search(page).fill(name);
    await rowOf(page, name).getByRole("link", { name: `Edit ${name}` }).click();
    const edit = dialog(page, "Edit supplier");
    await rateField(edit).fill("90");
    await edit.getByRole("button", { name: "Save supplier" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Change this supplier's currency or rate?" });
    await expect(confirm).toContainText(`${name} already has orders or deposits.`);
    await expect(confirm).toContainText("apply to new orders and deposits only");
    await shot(page, testInfo, "edit-supplier-rate-confirm.png");
    await confirm.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).toBeHidden();
    await expect(toast(page, "Supplier saved")).toBeVisible();
    expect(await supplierNamed(api, name)).toMatchObject({ currency: "USD", exchangeRate: 90, hasTransactions: true });
    // The order placed at 88 keeps 88; a deposit opened now snapshots 90; the payment form's default is 90.
    expect(await api.order(po)).toMatchObject({ exchangeRate: 88 });
    const opened = await api.post(`/suppliers/${supplier.id}/deposits`, { direction: "give", amount: 100, openedOn: today() });
    expect(opened.status(), await opened.text()).toBe(201);
    expect(((await opened.json()) as { deposit: object }).deposit).toMatchObject({ currency: "USD", exchangeRate: 90 });
    const payments = await api.get<{ orders: { po: string; supplierRate: number | null }[] }>("/payments");
    expect(payments.orders.find((row) => row.po === po)).toMatchObject({ supplierRate: 90 });
  });
});

test("the currency picker: searchable by name, code and symbol over the ISO 4217 master; the rate label, the list and an order follow the choice", async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);
  const name = `Gulf Fabrics ${tag()}`;
  await page.goto("/suppliers");
  await page.getByRole("link", { name: "Add Supplier" }).click();
  const add = dialog(page, "Add supplier");
  await add.getByLabel("Supplier name").fill(name);
  await currencyField(add).click();
  const box = page.getByRole("searchbox", { name: "Search currencies" });
  await expect(box).toBeFocused();
  const options = page.getByRole("listbox", { name: "Currencies" }).getByRole("option");
  // The three the business uses most first, then the rest of the master by code: well over a hundred currencies.
  await expect(options.nth(0)).toHaveAccessibleName("CNY – Chinese Yuan (¥)");
  await expect(options.nth(1)).toHaveAccessibleName("USD – US Dollar ($)");
  await expect(options.nth(2)).toHaveAccessibleName("INR – Indian Rupee (₹)");
  expect(await options.count()).toBeGreaterThan(150);
  await pickerSettled(page);
  await shot(page, testInfo, "currency-dropdown-open.png");

  await box.fill("dirham");
  await expect(options.first()).toHaveAccessibleName("AED – United Arab Emirates Dirham (AED)");
  await shot(page, testInfo, "currency-search-name.png");
  // ISO's own name is searched too.
  await box.fill("UAE");
  await expect(options.first()).toHaveAccessibleName("AED – United Arab Emirates Dirham (AED)");
  await box.fill("jpy");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAccessibleName("JPY – Japanese Yen (JPY)");
  await shot(page, testInfo, "currency-search-code.png");
  await box.fill("€");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAccessibleName("EUR – Euro (€)");
  // Withdrawn currencies are not offered: the lev went with Bulgaria's move to the euro.
  await box.fill("BGN");
  await expect(page.getByRole("status")).toHaveText("No currency matches “BGN”.");
  await box.fill("zzz");
  await expect(page.getByRole("status")).toHaveText("No currency matches “zzz”.");
  await box.fill("sar");
  await box.press("Enter"); // the first match, SAR, by keyboard
  await expect(currencyField(add)).toContainText("SAR – Saudi Riyal (SAR)");
  await expect(rateField(add)).toHaveAccessibleName("Exchange rate (1 SAR = ? INR)");
  await expect(rateField(add)).toHaveValue("");
  await rateField(add).fill("23.5");
  await expect(add.getByText("1 SAR = ₹23.50")).toBeVisible();
  await shot(page, testInfo, "currency-selected-rate.png");
  await add.getByRole("button", { name: "Save supplier" }).click();
  await expect(add).toBeHidden();
  const saved = await supplierNamed(api, name);
  expect(saved).toMatchObject({ currency: "SAR", exchangeRate: 23.5 });
  await search(page).fill(name);
  await expect(rowOf(page, name).getByRole("cell").filter({ hasText: /^SAR$/ })).toBeVisible();
  await expect(rowOf(page, name).getByRole("cell").filter({ hasText: /^₹23\.50$/ })).toBeVisible();

  // Its orders are in SAR: the API fills the currency in, refuses another, snapshots the rate; the screens show "SAR 40".
  const { items } = await api.get<OrderOptions>("/orders/options");
  const item = items.find((row) => row.name === "Denim jeans")!;
  const body = { supplierId: saved.id, orderDate: today(), deliveryDate: today(20), lines: [{ itemId: item.id, quantity: 10, rateCny: 4 }], deposits: [] };
  const refused = await api.post("/orders", { ...body, currency: "CNY" });
  expect(refused.status()).toBe(422);
  expect(((await refused.json()) as { error: { fields: object } }).error.fields).toEqual({ currency: "This supplier's orders are in SAR." });
  const placed = await api.post("/orders", body);
  expect(placed.status(), await placed.text()).toBe(201);
  const po = ((await placed.json()) as { order: { po: string } }).order.po;
  expect(await api.order(po)).toMatchObject({ currency: "SAR", exchangeRate: 23.5, orderValueCny: 40 });
  await page.goto(`/orders/${po}/payments`);
  await expect(kpi(page, "Order value")).toContainText("SAR 40");
  await page.goto(`/reports/orders/${po}`);
  await expect(kv(page, "Exchange rate on this PO")).toHaveText("1 SAR = ₹23.50");
  await expect(kv(page, "PO value in INR")).toHaveText("₹940.00 at the PO rate");
});

test("the supplier form at 390 px: currency and rate stacked, no sideways scroll", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/suppliers");
  await page.getByRole("link", { name: "Add Supplier" }).click();
  const add = dialog(page, "Add supplier");
  await add.getByLabel("Supplier name").fill(`Mobile Mills ${tag()}`);
  await rateField(add).fill("12.5");
  await expect(add.getByText("1 CNY = ₹12.50")).toBeVisible();
  await shot(page, testInfo, "supplier-form-390.png", false);
  // The picker fits the phone too: as wide as the field, never taller than the screen.
  await currencyField(add).click();
  await expect(page.getByRole("searchbox", { name: "Search currencies" })).toBeFocused();
  await pickerSettled(page);
  // As wide as the screen allows, never sideways past it.
  const panel = await page.locator('[data-slot="popover-content"]').boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390);
  await page.getByRole("searchbox", { name: "Search currencies" }).fill("euro");
  await expect(page.getByRole("option").first()).toHaveAccessibleName("EUR – Euro (€)");
  await shot(page, testInfo, "currency-dropdown-390.png", false);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await add.getByRole("button", { name: "Cancel" }).click();
  await expect(add).toBeHidden();
});
