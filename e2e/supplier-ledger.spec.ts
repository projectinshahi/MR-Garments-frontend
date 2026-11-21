import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import type { Locator, Page } from "@playwright/test";

import type { PaymentsResponse } from "../src/lib/api/types";
import { ANITA, expect, field, freshSignIn, kpi, kv, settled, test, toast, today, unloadedTrip } from "./live-api";
import { downloadReport } from "./report-download";

// The unified supplier ledger (backend docs/unified-ledger.md) in the browser, against the live API on the browser-test
// database: Record payment against a supplier (currency, rate, balance before → after), the supplier's statement with
// its running balance, New order's balance and the order debit, an order's FIFO settlement and Deposit Required
// milestone, voids, Management adjustments, Accounts' limits, the old-currency option, a held account, the maintenance
// guard, the old /deposits address, the statement download and Receive goods' previous outstanding. Every test makes
// a supplier of its own, so its account holds only what the test records. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

// Test data written straight into the browser-test database (a held account, the maintenance switch), through the
// backend worktree's own pg client. Refuses anything but the a1 test database.
type Sql = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; end: () => Promise<void> };
async function sql<T>(run: (db: Sql) => Promise<T>): Promise<T> {
  const backend = resolve(process.env.BACKEND_DIR ?? "../MR-Garments-Backend");
  const url = parseEnv(readFileSync(resolve(backend, ".env.test"), "utf8")).DATABASE_URL!;
  expect(new URL(url).pathname, "only the a1 browser-test database").toBe("/mr_garments_a1");
  const { Client } = createRequire(resolve(backend, "package.json"))("pg") as { Client: new (options: { connectionString: string }) => Sql & { connect: () => Promise<void> } };
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

const HELD = "This supplier's account is pending review.";
const ledgerPage = (id: string) => `/supplier-ledger/${id}`;
const dialog = (page: Page, name: string | RegExp) => page.getByRole("dialog", { name });
const input = (scope: Locator, name: string) => scope.getByRole("textbox", { name, exact: true });
const select = (scope: Locator, name: string) => scope.getByRole("combobox", { name, exact: true });
const balance = (scope: Locator) => scope.getByRole("status", { name: "Balance now and after" });
/** The statement's rows (the Statement tab's table). */
const statement = (page: Page) => page.getByRole("tabpanel").getByRole("row");
const entry = (page: Page, text: string | RegExp) => statement(page).filter({ hasText: text });
const account = (page: Page, currency = "CNY") => kpi(page, `${currency} account`);

async function recordPayment(page: Page, supplier: string, amount: string, extra: { mode?: string; reference?: string } = {}) {
  await page.goto("/payments");
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  const form = dialog(page, "Record payment");
  await select(form, "Supplier").fill(supplier);
  await input(form, "Amount (¥)").fill(amount);
  await input(form, "Mode").fill(extra.mode ?? "Bank transfer");
  if (extra.reference) await input(form, "Reference").fill(extra.reference);
  return form;
}

test("Record payment: pick the supplier, its currency and rate, see the balance now → after; the ledger shows it with the running balance", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Pay");
  const order = await api.createOrder({ supplier: supplier.name });

  await page.goto("/payments");
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  const form = dialog(page, "Record payment");
  await expect(select(form, "Currency")).toBeDisabled();
  await select(form, "Supplier").fill(supplier.name);
  await expect(select(form, "Currency")).toHaveValue("CNY");
  await expect(select(form, "Currency").getByRole("option")).toHaveText(["CNY"]);
  await expect(input(form, "Rate (₹ per ¥)")).toHaveValue("12.5");
  await expect(form.getByText("Supplier rate now: 1 CNY = ₹12.50. Change it if this payment used another.")).toBeVisible();
  await expect(balance(form)).toHaveText("Payable to supplier ¥1,000.00 → Payable to supplier ¥1,000.00");
  await input(form, "Amount (¥)").fill("600");
  await expect(balance(form)).toHaveText("Payable to supplier ¥1,000.00 → Payable to supplier ¥400.00");
  await expect(form.getByRole("status").first()).toHaveText("₹7,500");
  await input(form, "Mode").fill("Bank transfer");
  await input(form, "Reference").fill("TXN-L1");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(page, `Payment recorded for ${supplier.name}. Balance: Payable to supplier ¥1,000.00 → Payable to supplier ¥400.00`)).toBeVisible();

  await page.goto(ledgerPage(supplier.id));
  await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
  await expect(account(page)).toContainText("¥400.00");
  await expect(account(page)).toContainText("Payable to supplier");
  // Newest first: the payment (+, balance after ¥400 payable), then the order's debit (−, ¥1,000 payable).
  await expect(statement(page)).toHaveCount(3);
  const payment = entry(page, "TXN-L1");
  await expect(payment).toContainText("Payment");
  await expect(payment).toContainText("+¥600.00");
  await expect(payment).toContainText("12.50");
  await expect(payment).toContainText("₹7,500.00");
  await expect(payment).toContainText("¥400.00Payable to supplier");
  const debit = entry(page, "Order debit");
  await expect(debit).toContainText(order.po);
  await expect(debit).toContainText("−¥1,000.00");
  await expect(debit).toContainText("¥1,000.00Payable to supplier");
  await expect(debit.getByRole("link", { name: order.po })).toHaveAttribute("href", `/orders/${order.po}`);

  // The Orders tab: the account settles the order, oldest first.
  await page.getByRole("tab", { name: "Orders" }).click();
  const row = page.getByRole("tabpanel").getByRole("row").filter({ hasText: order.po });
  await expect(row).toContainText("¥1,000.00");
  await expect(row).toContainText("¥600.00");
  await expect(row).toContainText("¥400.00");
  await expect(row).toContainText("Partly paid");

  // The overview lists the account, payable.
  await page.goto("/supplier-ledger");
  await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
  const line = page.getByRole("row").filter({ hasText: supplier.name });
  await expect(line).toContainText("¥400.00Payable to supplier");
  await expect(line).toContainText("¥600.00"); // credits
});

test("New order shows the supplier's balance; the order's debit makes it payable", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Order");
  await api.paySupplier(supplier.id, { amount: 1500, rateInr: 12 });

  await page.goto("/orders/new");
  await page.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: supplier.name });
  await expect(kv(page, "Supplier balance now")).toHaveText("Available with supplier ¥1,500.00");
  await field(page, "Delivery date").fill(today(20));
  await page.getByRole("combobox", { name: "Item, line 1" }).selectOption({ label: "Denim jeans" });
  await page.getByRole("textbox", { name: "Rate (¥), line 1" }).fill("20");
  await page.getByRole("textbox", { name: "Quantity, line 1" }).fill("100");
  await expect(kv(page, "Supplier balance after this order")).toHaveText("Payable to supplier ¥500.00");
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/PO-\d+$/);
  const po = new URL(page.url()).pathname.split("/").pop()!;
  await expect(toast(page, `Order ${po} placed. Debited ¥2,000.00; supplier balance Payable to supplier ¥500.00.`)).toBeVisible();

  await page.goto(ledgerPage(supplier.id));
  const debit = entry(page, "Order debit");
  await expect(debit).toContainText(po);
  await expect(debit).toContainText("−¥2,000.00");
  await expect(debit).toContainText("¥500.00Payable to supplier");
  await expect(account(page)).toContainText("¥500.00");
  await expect(account(page)).toContainText("Payable to supplier");
});

test("an order's settled, outstanding and status, and its Deposit Required milestone: not met, partly met, met", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Milestone");
  const order = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 200, rateCny: 10 }], depositRequiredCny: 800 });
  const term = (start: string) => page.getByRole("term").filter({ hasText: new RegExp(`^${start}`), visible: true });
  const value = (start: string) => term(start).locator("xpath=following-sibling::dd[1]");

  await page.goto(`/orders/${order.po}`);
  await expect(value("Outstanding")).toHaveText("¥2,000.00");
  await expect(term("Outstanding")).toContainText("Unpaid");
  await expect(term("Deposit required")).toContainText("Deposit not met");
  await expect(value("Deposit required")).toHaveText("¥800.00 pending");

  await api.paySupplier(supplier.id, { amount: 500, rateInr: 12 });
  await page.reload();
  await expect(kv(page, "Settled from supplier account")).toHaveText("¥500.00");
  await expect(value("Outstanding")).toHaveText("¥1,500.00");
  await expect(term("Outstanding")).toContainText("Partly paid");
  await expect(term("Deposit required")).toContainText("Deposit partly met");
  await expect(value("Deposit required")).toHaveText("¥300.00 pending");

  await api.paySupplier(supplier.id, { amount: 300, rateInr: 12.5 });
  await page.reload();
  await expect(value("Outstanding")).toHaveText("¥1,200.00");
  await expect(term("Deposit required")).toContainText("Deposit met");
  await expect(value("Deposit required")).toHaveText("¥0.00 pending");

  // The Payments tab: settled by both credits, each at its own rate; the milestone met.
  await page.goto(`/orders/${order.po}/payments`);
  await expect(kpi(page, "Settled")).toContainText("¥800.00");
  await expect(kpi(page, "Outstanding")).toContainText("¥1,200.00");
  await expect(kpi(page, "Deposit required")).toContainText("Deposit met · ¥0.00 pending");
  const settledBy = page.locator("section").filter({ has: page.getByRole("heading", { name: "Settled by" }) });
  await expect(settledBy.getByRole("row").filter({ hasText: "¥500.00" })).toContainText("₹6,000");
  await expect(settledBy.getByRole("row").filter({ hasText: "¥300.00" })).toContainText("₹3,750");
  expect(await api.order(order.po)).toMatchObject({ settledCny: 800, outstandingCny: 1200, paymentStatus: "partly", depositStatus: "met", depositPendingCny: 0, settledInr: 9750 });
});

test("Management voids a payment with a reason: it stays listed, voided, and leaves every total", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Void");
  const order = await api.createOrder({ supplier: supplier.name });
  await api.paySupplier(supplier.id, { amount: 400, rateInr: 12, reference: "TXN-KEEP" });
  const { payment } = await api.paySupplier(supplier.id, { amount: 300, rateInr: 12, reference: "TXN-VOID" });

  await page.goto(ledgerPage(supplier.id));
  await expect(account(page)).toContainText("¥300.00");
  await entry(page, "TXN-VOID").getByRole("button", { name: /^Void payment of .*¥300/ }).click();
  const ask = dialog(page, "Void payment?");
  await expect(ask).toContainText(`A void entry takes ¥300.00 off ${supplier.name}'s CNY account`);
  await ask.getByRole("button", { name: "Void payment" }).click();
  await expect(ask.getByText("Enter the reason for voiding this payment.")).toBeVisible();
  await ask.getByRole("textbox", { name: "Reason" }).fill("Wrong amount");
  await ask.getByRole("button", { name: "Void payment" }).click();
  const done = dialog(page, "Payment voided");
  await expect(done).toContainText(`${supplier.name}'s CNY account: Payable to supplier ¥300.00 before, Payable to supplier ¥600.00 after.`);
  await done.getByRole("button", { name: "Close" }).first().click();

  // The payment row is flagged and has no Void; a void entry (it carries the payment's details too) takes it off the account.
  const paid = entry(page, "TXN-VOID").filter({ hasNotText: "Payment void" });
  await expect(paid.getByText("Voided", { exact: true }).first()).toBeVisible();
  await expect(paid).toContainText("Voided by Suresh Menon");
  await expect(paid.getByRole("button", { name: /^Void payment/ })).toHaveCount(0);
  const voidRow = entry(page, "Payment void");
  await expect(voidRow).toContainText("−¥300.00");
  await expect(voidRow).toContainText("Reason: Wrong amount");
  await expect(voidRow).toContainText("¥600.00Payable to supplier");
  await expect(account(page)).toContainText("¥600.00");

  // Out of every total: the account, the order's settlement and Payments' list.
  const ledger = await api.get<{ accounts: { currency: string; balanceCny: number; paidInr: number }[] }>(`/suppliers/${supplier.id}/ledger`);
  expect(ledger.accounts).toMatchObject([{ currency: "CNY", balanceCny: -600, paidInr: 4800 }]);
  expect(await api.order(order.po)).toMatchObject({ settledCny: 400, outstandingCny: 600 });
  const listed = (await api.get<PaymentsResponse>("/payments")).payments.find((p) => p.id === payment.id)!;
  expect(listed).toMatchObject({ voided: true, voidReason: "Wrong amount" });
  // At 1440 px the statement, void and adjustment details included, fits with its Actions column: no sideways scroll.
  await expect.poll(() => page.locator('[data-slot="table-container"]').first().evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  // The Entries filter shows the corrections only.
  await page.getByRole("button", { name: /^Entries: / }).click();
  await page.getByRole("menuitemradio", { name: "Voids and adjustments" }).click();
  await expect(statement(page)).toHaveCount(2);
});

test("Management adjustments, increase and decrease, with a reason: the statement shows each with its balance before and after", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Adjust");
  await api.createOrder({ supplier: supplier.name });
  await page.goto(ledgerPage(supplier.id));

  async function adjust(direction: "Increase" | "Decrease", amount: string, reason: string, before: string, after: string) {
    await page.getByRole("button", { name: "Adjust balance" }).click();
    const form = dialog(page, `Adjust ${supplier.name}'s account`);
    await expect(form).toContainText("An adjustment changes the supplier's account balance. It is not a supplier payment.");
    await form.getByRole("radio", { name: new RegExp(`^${direction}`) }).check();
    await input(form, "Amount (¥)").fill(amount);
    await expect(input(form, "Rate (₹ per ¥)")).toHaveValue("12.5");
    await input(form, "Reason").fill(reason);
    await expect(balance(form)).toHaveText(`${before} → ${after}`);
    await form.getByRole("button", { name: "Record adjustment" }).click();
    const done = dialog(page, "Adjustment recorded");
    await expect(done).toContainText(`${supplier.name}'s CNY account: ${before} before, ${after} after.`);
    await done.getByRole("button", { name: "Close" }).first().click();
  }

  // Every check first: nothing chosen, nothing typed.
  await page.getByRole("button", { name: "Adjust balance" }).click();
  const form = dialog(page, `Adjust ${supplier.name}'s account`);
  await form.getByRole("button", { name: "Record adjustment" }).click();
  for (const message of ["Choose increase or decrease.", "Enter an amount above 0, with at most 2 decimals.", "Enter the reason for the adjustment."]) {
    await expect(form.getByText(message)).toBeVisible();
  }
  await form.getByRole("button", { name: "Cancel" }).click();

  await adjust("Increase", "200", "Supplier discount on PO", "Payable to supplier ¥1,000.00", "Payable to supplier ¥800.00");
  await adjust("Decrease", "50", "Bank charge", "Payable to supplier ¥800.00", "Payable to supplier ¥850.00");

  const plus = entry(page, "Supplier discount on PO");
  await expect(plus).toContainText("Adjustment");
  await expect(plus).toContainText("+¥200.00");
  await expect(plus).toContainText("When recorded: Payable to supplier ¥1,000.00 → Payable to supplier ¥800.00");
  const minus = entry(page, "Bank charge");
  await expect(minus).toContainText("−¥50.00");
  await expect(minus).toContainText("When recorded: Payable to supplier ¥800.00 → Payable to supplier ¥850.00");
  await expect(minus).toContainText("¥850.00Payable to supplier");
  await expect(account(page)).toContainText("¥850.00");
  // At 1440 px the statement fits its card with the Actions column (Void): no sideways scroll.
  await expect.poll(() => page.locator('[data-slot="table-container"]').first().evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
});

test.describe("Accounts (payments Enter)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("sees the ledger and Record payment, but no Adjust balance and no Void; the API refuses both", async ({ page, api }) => {
    const supplier = await api.newSupplier("Ledger Accounts");
    await api.createOrder({ supplier: supplier.name });
    const { payment } = await api.paySupplier(supplier.id, { amount: 250, rateInr: 12 });
    await page.goto(ledgerPage(supplier.id));
    await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Record payment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adjust balance" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Void payment/ })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    const origin = { Origin: new URL(page.url()).origin };
    expect((await page.request.delete(`/api/v1/payments/${payment.id}`, { data: { reason: "x" }, headers: origin })).status()).toBe(403);
    const adjustment = { currency: "CNY", amount: 10, entryDate: today(), rateInr: 12, reason: "x", idempotencyKey: crypto.randomUUID() };
    expect((await page.request.post(`/api/v1/suppliers/${supplier.id}/ledger/adjustments`, { data: adjustment, headers: origin })).status()).toBe(403);
  });
});

test("after the supplier's currency changes, Record payment still offers the old currency while it has a balance", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Currency");
  await api.createOrder({ supplier: supplier.name });
  const changed = await api.patch(`/suppliers/${supplier.id}`, { currency: "USD", exchangeRate: 88 });
  expect(changed.status(), await changed.text()).toBe(200);

  await page.goto("/payments");
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  const form = dialog(page, "Record payment");
  await select(form, "Supplier").fill(supplier.name);
  // The supplier's currency now first chosen; CNY still offered (¥1,000 payable), in the fixed order CNY, USD.
  await expect(select(form, "Currency")).toHaveValue("USD");
  await expect(select(form, "Currency").getByRole("option")).toHaveText(["CNY", "USD"]);
  await expect(input(form, "Rate (₹ per $)")).toHaveValue("88");
  await select(form, "Currency").selectOption("CNY");
  await expect(input(form, "Rate (₹ per ¥)")).toHaveValue("");
  await expect(form.getByText("No saved rate for CNY: enter this payment's.")).toBeVisible();
  await expect(balance(form)).toHaveText("Payable to supplier ¥1,000.00 → Payable to supplier ¥1,000.00");
  await input(form, "Amount (¥)").fill("1000");
  await input(form, "Rate (₹ per ¥)").fill("12.2");
  await input(form, "Mode").fill("Wire");
  await expect(balance(form)).toHaveText("Payable to supplier ¥1,000.00 → Settled");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(page, `Payment recorded for ${supplier.name}. Balance: Payable to supplier ¥1,000.00 → Settled`)).toBeVisible();

  // Settled: CNY is no longer an option.
  const choices = await api.get<{ suppliers: { id: string; currencyOptions: string[] }[] }>("/supplier-advances/suppliers");
  expect(choices.suppliers.find((s) => s.id === supplier.id)!.currencyOptions).toEqual(["USD"]);
  await page.reload();
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  await select(dialog(page, "Record payment"), "Supplier").fill(supplier.name);
  await expect(select(dialog(page, "Record payment"), "Currency").getByRole("option")).toHaveText(["USD"]);
});

test("a held account: the review banner, and Record payment and New order refuse it", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Held");
  // Forms opened and filled before the hold lands, so the server's refusal is what the user sees.
  const form = await recordPayment(page, supplier.name, "100");
  await sql((db) => db.query("insert into supplier_ledger_holds (supplier_id, currency, reason) values ($1, 'CNY', 'E2E: opening balance pending review')", [supplier.id]));
  try {
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(page, HELD).first()).toBeVisible();
    await expect(form).toBeVisible();

    const newOrder = settled(await page.context().newPage());
    await newOrder.goto("/orders/new");
    await expect(newOrder.getByRole("heading", { level: 1, name: "New order" })).toBeVisible();
    // The page loaded after the hold: the supplier is blocked up front.
    await newOrder.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: supplier.name });
    await expect(newOrder.getByRole("alert").filter({ hasText: HELD })).toContainText("No order can be placed for it until the review is done.");
    await expect(newOrder.getByRole("button", { name: "Place order" })).toBeDisabled();
    await newOrder.close();
    // The API refuses both writes with the same words.
    const order = await api.post("/orders", { supplierId: supplier.id, orderDate: today(), deliveryDate: today(20), lines: [{ itemId: (await api.options()).items[0]!.id, quantity: 1, rateCny: 1 }] });
    expect(order.status()).toBe(409);
    expect(await order.text()).toContain(HELD);
    const paid = await api.post("/payments", { supplierId: supplier.id, amount: 1, rateInr: 12, paidOn: today(), mode: "Cash", clientRequestId: crypto.randomUUID() });
    expect(paid.status()).toBe(409);
    expect(await paid.text()).toContain(HELD);

    // Its ledger: the banner, the account pending review, and nothing to pay into.
    await page.goto(ledgerPage(supplier.id));
    await expect(page.getByRole("status").filter({ hasText: HELD })).toContainText("CNY: Opening balance pending review. E2E: opening balance pending review. Its records");
    await page.getByRole("button", { name: "+ Record payment" }).click();
    const blocked = dialog(page, "Record payment");
    await expect(blocked.getByRole("alert")).toHaveText(`${HELD} No payment can be recorded for it until the review is done.`);
    await expect(blocked.getByRole("button", { name: "Record payment" })).toBeDisabled();
  } finally {
    await sql((db) => db.query("delete from supplier_ledger_holds where supplier_id = $1", [supplier.id]));
  }
});

test("while the ledger is in maintenance a payment is refused with the maintenance message, and nothing is recorded", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Maintenance");
  const form = await recordPayment(page, supplier.name, "100");
  await sql((db) => db.query("update ledger_state set state = 'maintenance', note = 'E2E maintenance check'"));
  try {
    await form.getByRole("button", { name: "Record payment" }).click();
    const message = toast(page, "Paused for maintenance").first();
    await expect(message).toBeVisible();
    await expect(message).toContainText("Payments and order money are paused for maintenance. Try again later.");
    await expect(form).toBeVisible();
    // Reads keep working.
    expect((await api.get<PaymentsResponse>("/payments")).payments.filter((p) => p.supplierId === supplier.id)).toHaveLength(0);
  } finally {
    await sql((db) => db.query("update ledger_state set state = 'live', note = 'browser-test reset'"));
  }
  // Live again: the same dialog records it.
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(page, `Payment recorded for ${supplier.name}`).first()).toBeVisible();
});

test("in maintenance, Edit order refuses a new order date (the cutover baseline holds it) but saves a new delivery date", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Maintenance Edit");
  const { po } = await api.createOrder({ supplier: supplier.name });
  await page.goto(`/orders/${po}`);
  await page.getByRole("button", { name: "Edit order" }).click();
  const edit = dialog(page, "Edit order");
  await sql((db) => db.query("update ledger_state set state = 'maintenance', note = 'E2E maintenance check'"));
  try {
    await field(edit, "Order date").fill(today(-1));
    await edit.getByRole("button", { name: "Save order" }).click();
    await expect(toast(page, "Order dates, PO numbers, deposits and items are paused for maintenance. The delivery date and container terms can still change.").first()).toBeVisible();
    await expect(edit).toBeVisible();
    expect((await api.order(po)).orderDate).toBe(today());
    // The same date back and a new delivery date: only the delivery date is sent, and it saves.
    await field(edit, "Order date").fill(today());
    await field(edit, "Delivery date").fill(today(25));
    await edit.getByRole("button", { name: "Save order" }).click();
    await expect(toast(page, "Order saved")).toBeVisible();
    expect((await api.order(po)).deliveryDate).toBe(today(25));
  } finally {
    await sql((db) => db.query("update ledger_state set state = 'live', note = 'browser-test reset'"));
  }
});

test("a held account's open order is not an Active PO: the Suppliers page names it pending review, on the row and the card", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Held POs");
  await api.createOrder({ supplier: supplier.name });
  await sql((db) => db.query("insert into supplier_ledger_holds (supplier_id, currency, reason) values ($1, 'CNY', 'E2E: open orders pending review')", [supplier.id]));
  try {
    await page.goto("/suppliers");
    await expect(kpi(page, "Open POs")).toContainText(/\d+ POs? pending review, not counted/);
    await page.getByRole("searchbox", { name: "Search supplier name, code or country" }).fill(supplier.name);
    const row = page.getByRole("row").filter({ hasText: supplier.name });
    await expect(row).toContainText("+1 pending review");
    await expect(row).toContainText("CNY pending review");
  } finally {
    await sql((db) => db.query("delete from supplier_ledger_holds where supplier_id = $1", [supplier.id]));
  }
});

test("the old Supplier advance address opens the supplier ledger, and the statement downloads", async ({ page, api }) => {
  const supplier = await api.newSupplier("Ledger Download");
  const order = await api.createOrder({ supplier: supplier.name });
  await api.paySupplier(supplier.id, { amount: 700, rateInr: 12, reference: "TXN-DL" });

  await page.goto("/deposits/advance");
  await expect(page).toHaveURL("/supplier-ledger");
  await page.goto(`/deposits/advance/${supplier.id}`);
  await expect(page).toHaveURL(ledgerPage(supplier.id));

  const slug = supplier.name.replace(/[^\w-]+/g, "-").toLowerCase();
  const csv = await downloadReport(page, "CSV");
  expect(csv.name).toMatch(new RegExp(`^supplier-ledger-${slug}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
  for (const text of ["Statement (CNY)", "TXN-DL", order.po]) expect(csv.text).toContain(text);
  const excel = await downloadReport(page, "Excel");
  expect(excel.name).toMatch(/\.xlsx$/);
  expect(excel.text.startsWith("PK")).toBe(true);
  const pdf = await downloadReport(page, "PDF");
  expect(pdf.text.startsWith("%PDF-")).toBe(true);
  expect(pdf.text).toContain(`(Supplier ledger: ${supplier.name}) Tj`);
});

test("Receive goods shows the supplier's earlier unpaid orders as previous outstanding, with its balance, apart from the cost", async ({ page, api }) => {
  test.setTimeout(120_000);
  const supplier = await api.newSupplier("Ledger Warehouse");
  // An earlier ¥500 order, unpaid; the trip's own order ¥1,000; ¥200 paid settles the earlier one in part (oldest first).
  const earlier = await api.createOrder({ supplier: supplier.name, orderDate: today(-30), deliveryDate: today(-5), lines: [{ item: "Track pants", quantity: 50, rateCny: 10 }] });
  const { tripId } = await unloadedTrip(api, { supplier: supplier.name, orderDate: today(-20), deliveryDate: today(-1) });
  await api.paySupplier(supplier.id, { amount: 200, rateInr: 12 });

  await page.goto(`/warehouse/receive/${tripId}`);
  const owed = page.getByRole("term").filter({ hasText: /^Previous supplier outstanding/ });
  await expect(owed).toContainText(`${supplier.name} · 1 unpaid order`);
  await expect(owed).toContainText("Supplier balance: Payable to supplier ¥1,300.00");
  await expect(owed.locator("xpath=following-sibling::dd[1]")).toHaveText("¥300.00");
  await expect(page.getByText("Unpaid orders placed before this trip. Not included in the cost above.")).toBeVisible();
  expect(await api.order(earlier.po)).toMatchObject({ settledCny: 200, outstandingCny: 300 });
});
