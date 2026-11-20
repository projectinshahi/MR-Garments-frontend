import type { Locator, Page } from "@playwright/test";

import type { PaymentsResponse } from "../src/lib/api/types";
import { amountCell, ANITA, type Api, expect, field, freshSignIn, inr, kpi, settled, test, toast, today } from "./live-api";
import { MANAGEMENT_STATE, PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Payments (16, unified supplier ledger) against PAY-1 and PAY-2. A supplier payment is recorded against the supplier
// (no order, no payment type) and settles its orders oldest first; sea freight is paid to an agent on the order. Each
// test uses a supplier of its own, so the FIFO figures never depend on another spec's orders. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const search = (page: Page) => page.getByRole("searchbox", { name: "Search PO or supplier" });
/** The Payments by order table (the second table; the first lists every payment). */
const ordersTable = (page: Page) => page.getByRole("table").nth(1);
const paymentsTable = (page: Page) => page.getByRole("table").first();
const rowOf = (page: Page, po: string) => ordersTable(page).getByRole("row").filter({ hasText: po });
const card = (page: Page, po: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: `${po} payments` }) });
const dialog = (page: Page, name = "Record payment") => page.getByRole("dialog", { name });
const input = (scope: Locator, name: string) => scope.getByRole("textbox", { name, exact: true });
const select = (scope: Locator, name: string) => scope.getByRole("combobox", { name, exact: true });
const balance = (scope: Locator) => scope.getByRole("status", { name: "Balance now and after" });
const paymentsOfSupplier = async (api: Api, supplierId: string) => (await api.get<PaymentsResponse>("/payments")).payments.filter((p) => p.supplierId === supplierId);

/** Selects an order's row (the header search narrows the tables to it). */
async function openOrder(page: Page, po: string) {
  await search(page).fill(po);
  await rowOf(page, po).getByRole("button", { name: po, exact: true }).click();
  await expect(page.getByRole("heading", { name: `${po} payments` })).toBeVisible();
}

test("KPIs, the payments list, an order's FIFO figures and card, with search and its empty states", async ({ page, api }) => {
  const supplier = await api.newSupplier("Knit Ledger");
  const order = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Ladies kurtis", quantity: 500, rateCny: 16 }] });
  await api.paySupplier(supplier.id, { amount: 2000, rateInr: 12, paidOn: today(-3), reference: "TXN-K1" });
  const response = await api.get<PaymentsResponse>("/payments");
  const paidInr = response.payments.filter((p) => !p.voided && !p.held && p.status === "paid").reduce((sum, p) => sum + (p.amountInr ?? 0), 0);

  await page.goto("/payments");
  await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
  await expect(kpi(page, "Paid so far (INR)")).toContainText(inr(paidInr));
  await expect(kpi(page, "Payable to suppliers")).toContainText("accounts below zero");
  await expect(kpi(page, "Available with suppliers")).toContainText("accounts above zero");
  // PAY-2 saves payments as paid, so nothing is ever due here.
  await expect(kpi(page, "Due in next 30 days")).toContainText("0 payments");

  // The payment is on the supplier's account, not on the order.
  await search(page).fill(supplier.name);
  const paymentRow = paymentsTable(page).getByRole("row").filter({ hasText: "TXN-K1" });
  await expect(paymentRow).toContainText("Supplier account");
  await expect(paymentRow).toContainText("Supplier payment");
  await expect(paymentRow).toContainText("¥2,000.00");
  await expect(paymentRow).toContainText("₹24,000");
  await expect(paymentRow).toContainText("Paid");

  // FIFO: the ¥2,000 settles part of the ¥8,000 order.
  await openOrder(page, order.po);
  const cells = rowOf(page, order.po).getByRole("cell");
  await expect(cells.nth(0)).toHaveText(`${order.po}${supplier.name}`);
  await expect(cells.nth(1)).toHaveText(amountCell("8,000.00"));
  await expect(cells.nth(2)).toHaveText(amountCell("2,000.00"));
  await expect(cells.nth(3)).toHaveText(amountCell("6,000.00"));
  await expect(cells.nth(4)).toContainText("Partly paid");
  await expect(cells.nth(5)).toHaveText("₹24,000");
  const detail = card(page, order.po);
  await expect(detail).toContainText(supplier.name);
  await expect(detail).toContainText("Settled from supplier account");
  await expect(detail).toContainText("¥ 2,000.00");
  await expect(detail).toContainText("¥ 6,000.00");
  await expect(detail).toContainText("No payment names this PO. Supplier payments are on the supplier's account.");

  // Search by supplier in any case, then one that matches nothing: the card hides until the search clears.
  await search(page).fill(supplier.name.toUpperCase());
  await expect(rowOf(page, order.po)).toBeVisible();
  await search(page).fill("no such order zzz");
  await expect(page.getByText("No orders match your search.")).toBeVisible();
  await expect(page.getByText("No payments match your search.")).toBeVisible();
  await expect(page.getByRole("heading", { name: `${order.po} payments` })).toHaveCount(0);
  await search(page).fill(order.po);
  await expect(page.getByRole("heading", { name: `${order.po} payments` })).toBeVisible();

  // The PO in the card opens the order.
  await detail.getByRole("link", { name: order.po }).click();
  await expect(page).toHaveURL(`/orders/${order.po}`);
});

test("an unpaid order shows its whole value outstanding", async ({ page, api }) => {
  const supplier = await api.newSupplier("Unpaid Ledger");
  const order = await api.createOrder({ supplier: supplier.name });
  await page.goto("/payments");
  await openOrder(page, order.po);
  await expect(rowOf(page, order.po).getByRole("cell").nth(2)).toHaveText(amountCell("0.00"));
  await expect(rowOf(page, order.po).getByRole("cell").nth(3)).toHaveText(amountCell("1,000.00"));
  await expect(rowOf(page, order.po).getByRole("cell").nth(4)).toContainText("Unpaid");
});

test("Record payment: opens, cancels, checks every field, shows the balance before and after, and saves to the supplier's account", async ({ page, api }) => {
  const supplier = await api.newSupplier("Trim Ledger");
  const order = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Kids t-shirts", quantity: 1000, rateCny: 5 }] });
  await page.goto("/payments");

  // Open and cancel; open and close with Escape.
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  await expect(dialog(page)).toContainText("A payment already made to a supplier.");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  // No payment type and no order: the supplier comes first. Every client check.
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  const form = dialog(page);
  await expect(select(form, "Payment type")).toHaveCount(0);
  await expect(select(form, "Order")).toHaveCount(0);
  await expect(field(form, "Paid on")).toHaveValue(today());
  await form.getByRole("button", { name: "Record payment" }).click();
  for (const message of ["Choose a supplier from the list.", "Enter an amount above 0.", "Enter an INR rate above 0.", "Enter the payment mode."]) {
    await expect(form.getByText(message)).toBeVisible();
  }
  await field(form, "Paid on").fill(today(1));
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByText("The payment date can't be in the future.")).toBeVisible();
  await field(form, "Paid on").fill("");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByText("Enter the date the payment was made.")).toBeVisible();

  // The supplier: its currency, its saved rate prefilled, and the balance now → after as you type.
  await select(form, "Supplier").fill(supplier.name);
  await expect(select(form, "Currency")).toHaveValue("CNY");
  await expect(input(form, "Rate (₹ per ¥)")).toHaveValue("12.5");
  await expect(balance(form)).toHaveText("Payable to supplier ¥5,000.00 → Payable to supplier ¥5,000.00");
  await input(form, "Amount (¥)").fill("1,500");
  await expect(form.getByRole("status").first()).toHaveText("₹18,750");
  await expect(balance(form)).toHaveText("Payable to supplier ¥5,000.00 → Payable to supplier ¥3,500.00");
  await field(form, "Paid on").fill(today(-1));
  await input(form, "Mode").fill("  UPI  ");
  await form.getByRole("button", { name: "Record payment" }).click();

  await expect(toast(page, `Payment recorded for ${supplier.name}. Balance: Payable to supplier ¥5,000.00 → Payable to supplier ¥3,500.00`)).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await openOrder(page, order.po);
  await expect(rowOf(page, order.po).getByRole("cell").nth(2)).toHaveText(amountCell("1,500.00"));
  await expect(rowOf(page, order.po).getByRole("cell").nth(3)).toHaveText(amountCell("3,500.00"));

  expect(await paymentsOfSupplier(api, supplier.id)).toMatchObject([
    { orderId: null, po: null, kind: "Payment", payee: supplier.name, payeeRole: "supplier", currency: "CNY", amountCny: 1500, rateInr: 12.5, paidOn: today(-1), mode: "UPI", status: "paid", voided: false },
  ]);

  // Persisted: after a reload the figures are the same.
  await page.reload();
  await openOrder(page, order.po);
  await expect(rowOf(page, order.po).getByRole("cell").nth(5)).toHaveText("₹18,750");
});

test("the card records a sea freight payment to a shipping agent; the supplier's settlement does not change", async ({ page, api }) => {
  const supplier = await api.newSupplier("Freight Ledger");
  const order = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Men's shorts", quantity: 300, rateCny: 10 }] });
  await api.paySupplier(supplier.id, { amount: 1000, rateInr: 12 });
  await page.goto("/payments");
  await openOrder(page, order.po);
  await card(page, order.po).getByRole("button", { name: "+ Record sea freight payment" }).click();

  const form = dialog(page, `Record sea freight payment for ${order.po}`);
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByText("Choose the shipping agent.")).toBeVisible();
  await expect(form.getByText("Choose Deposit or Balance.")).toBeVisible();
  await select(form, "Shipping agent").selectOption({ label: "Dragon Cargo" });
  await select(form, "Kind").selectOption("Balance");
  await input(form, "Amount (¥)").fill("500");
  await input(form, "Rate (₹ per ¥)").fill("12.25");
  await input(form, "Mode").fill("Cash");
  await form.getByRole("button", { name: "Record payment" }).click();

  await expect(toast(page, `Sea freight payment recorded for ${order.po}`)).toBeVisible();
  const detail = card(page, order.po);
  await expect(detail.getByRole("heading", { level: 4 })).toHaveText(["1. Sea freight · Balance"]);
  await expect(detail).toContainText("Paid to agents (sea freight)");
  // Settled stays the supplier's ¥1,000; Paid (INR) adds the agent's ₹6,125.
  await expect(rowOf(page, order.po).getByRole("cell").nth(2)).toHaveText(amountCell("1,000.00"));
  await expect(rowOf(page, order.po).getByRole("cell").nth(5)).toHaveText(inr(12_000 + 6125));
  const payments = await paymentsOfSupplier(api, supplier.id);
  expect(payments.map((p) => [p.kind, p.payee, p.payeeRole, p.po])).toEqual([
    ["Balance", "Dragon Cargo", "agent", order.po],
    ["Payment", supplier.name, "supplier", null],
  ]);
});

test("a server refusal (422) shows under its field; a failed or lost request keeps the dialog and its values", async ({ page, api }) => {
  const supplier = await api.newSupplier("Refusal Ledger");
  const order = await api.createOrder({ supplier: supplier.name });
  await page.goto("/payments");
  await openOrder(page, order.po);
  await card(page, order.po).getByRole("button", { name: `+ Record payment for ${supplier.name}` }).click();
  const form = dialog(page);
  // Opened from the order: its supplier, fixed.
  await expect(form.getByRole("textbox", { name: "Supplier" })).toHaveValue(supplier.name);
  await input(form, "Amount (¥)").fill("250");
  await input(form, "Mode").fill("Cheque");

  // The request reaches PAY-2 with an amount above its limit, so the real API answers 422 on amount.
  await page.route("**/api/v1/payments", (route) =>
    route.request().method() === "POST" ? route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), amount: 1e13 }) }) : route.fallback(),
  );
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByText("Enter an amount above 0.")).toBeVisible();
  await expect(input(form, "Amount (¥)")).toBeFocused();
  await page.unroute("**/api/v1/payments");

  await page.route("**/api/v1/payments", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong." } } }) : route.fallback(),
  );
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(page, "Something went wrong.").first()).toContainText("Please try again.");
  await page.unroute("**/api/v1/payments");

  await page.route("**/api/v1/payments", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  const failed = page.waitForEvent("requestfailed", (request) => request.url().endsWith("/api/v1/payments"));
  await form.getByRole("button", { name: "Record payment" }).click();
  await failed;
  await expect(toast(page, "Something went wrong.").first()).toBeVisible();
  await page.unroute("**/api/v1/payments");

  await expect(form).toBeVisible();
  await expect(input(form, "Amount (¥)")).toHaveValue("250");
  await expect(input(form, "Mode")).toHaveValue("Cheque");
  expect(await paymentsOfSupplier(api, supplier.id)).toHaveLength(0);
});

test("double-clicking Record payment records one payment", async ({ page, api }) => {
  const supplier = await api.newSupplier("Double Ledger");
  const order = await api.createOrder({ supplier: supplier.name });
  await page.goto("/payments");
  await openOrder(page, order.po);
  await card(page, order.po).getByRole("button", { name: `+ Record payment for ${supplier.name}` }).click();
  const form = dialog(page);
  await input(form, "Amount (¥)").fill("100");
  await input(form, "Mode").fill("Cash");
  await form.getByRole("button", { name: "Record payment" }).dblclick();
  await expect(toast(page, `Payment recorded for ${supplier.name}`).first()).toBeVisible();
  await expect(rowOf(page, order.po).getByRole("cell").nth(2)).toHaveText(amountCell("100.00"));
  expect(await paymentsOfSupplier(api, supplier.id)).toHaveLength(1);
});

test.describe("Accounts (payments Enter)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("records a payment that Management then sees, and has no Void", async ({ page, api, browser }) => {
    const supplier = await api.newSupplier("Accounts Ledger");
    const order = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Polo shirts", quantity: 100, rateCny: 30 }] });
    await page.goto("/payments");
    await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
    const form = dialog(page);
    await select(form, "Supplier").fill(supplier.name);
    await input(form, "Amount (¥)").fill("3000");
    await input(form, "Rate (₹ per ¥)").fill("12");
    await input(form, "Mode").fill("Bank transfer");
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(page, `Payment recorded for ${supplier.name}`)).toBeVisible();
    await search(page).fill(supplier.name);
    await expect(paymentsTable(page).getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Void payment/ })).toHaveCount(0);

    const management = settled(await browser.newPage({ storageState: MANAGEMENT_STATE, viewport: { width: 1440, height: 900 } }));
    await management.goto("/payments");
    await openOrder(management, order.po);
    await expect(rowOf(management, order.po).getByRole("cell").nth(2)).toHaveText(amountCell("3,000.00"));
    await expect(rowOf(management, order.po).getByRole("cell").nth(3)).toHaveText(amountCell("0.00"));
    await expect(rowOf(management, order.po).getByRole("cell").nth(4)).toContainText("Paid");
    await expect(rowOf(management, order.po).getByRole("cell").nth(5)).toHaveText("₹36,000");
    await management.close();
  });
});

test.describe("Procurement (payments View)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("sees payments but no Record payment buttons", async ({ page, api }) => {
    const order = await api.createOrder();
    await page.goto("/payments");
    await openOrder(page, order.po);
    await expect(page.getByRole("button", { name: /Record (sea freight )?payment/ })).toHaveCount(0);
    await card(page, order.po).getByRole("link", { name: order.po }).click();
    await expect(page).toHaveURL(`/orders/${order.po}`);
  });
});

test.describe("China staff (no payments access)", () => {
  test.use({ storageState: STAFF_STATE });

  test("the payments page goes to the staff home", async ({ page }) => {
    await page.goto("/payments");
    await expect(page).toHaveURL("/home");
  });
});
