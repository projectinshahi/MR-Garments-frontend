import type { Page } from "@playwright/test";

import { amountCell, expect, field, kpi, kv, test, toast, today } from "./live-api";

// QA "Support USD, CNY and INR": one order in US dollars, end to end against the live API. It is placed on New order
// (15) for a USD supplier of this run's own (docs/supplier-currency.md: the order is in the supplier's currency, shown
// not chosen), debits the supplier's USD account, is settled by a payment at the supplier's rate and one at a typed INR
// rate (unified supplier ledger), and then shows dollars on the order's tabs, Payments and Payments per supplier,
// converted to INR only at those rates and never added to yuan. The order keeps the rate it was placed at when the supplier's rate moves on. It leaves a USD order in the shared
// test database; the "Payments by order" checks elsewhere use amountCell for that.

test.use({ viewport: { width: 1440, height: 900 } });

const combo = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

test("a USD supplier's order is placed in dollars at its rate, paid at typed INR rates and shown in $ everywhere", async ({ page, api }) => {
  test.setTimeout(120_000);
  // A USD supplier of this run's own: 1 USD = ₹88 now.
  const name = `Dollar Mills ${String(Date.now()).slice(-6)}`;
  const created = await api.post("/suppliers", { name, currency: "USD", exchangeRate: 88 });
  expect(created.status(), await created.text()).toBe(201);
  const supplierId = ((await created.json()) as { supplier: { id: string } }).supplier.id;

  await test.step("New order: the currency is the supplier's, shown not chosen; labels and totals follow; the supplier's USD balance before and after", async () => {
    await page.goto("/orders/new");
    await combo(page, "Supplier").selectOption({ label: name });
    await expect(box(page, "Currency")).toHaveValue("USD ($)");
    await expect(page.getByText("Supplier rate now: 1 USD = ₹88.00")).toBeVisible();
    await field(page, "Delivery date").fill(today(20));
    await combo(page, "Item, line 1").selectOption({ label: "Denim jeans" });
    await box(page, "Rate ($), line 1").fill("2.5");
    await box(page, "Quantity, line 1").fill("400");
    await expect(page.getByRole("status", { name: "Order total" })).toHaveText("$ 1,000.00");
    // No deposits on the order any more: supplier money is recorded with Record payment.
    await expect(page.getByRole("button", { name: "+ Add deposit" })).toHaveCount(0);
    await expect(kv(page, "Supplier balance now")).toHaveText("Settled");
    await expect(kv(page, "Supplier balance after this order")).toHaveText("Payable to supplier $1,000.00");
    // Container terms are chosen on the order (backend docs/order-container-terms.md).
    await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/orders\/PO-\d+$/);
  });
  const po = new URL(page.url()).pathname.split("/").pop()!;
  await expect(toast(page, `Order ${po} placed. Debited $1,000.00; supplier balance Payable to supplier $1,000.00.`)).toBeVisible();
  expect(await api.order(po)).toMatchObject({ currency: "USD", orderValueCny: 1000, settledCny: 0, outstandingCny: 1000, paymentStatus: "unpaid" });
  // $300 to the supplier's USD account at its rate (88): ₹26,400.
  await api.paySupplier(supplierId, { amount: 300, rateInr: 88, mode: "Wire" });
  expect(await api.order(po)).toMatchObject({ settledCny: 300, settledInr: 26400, outstandingCny: 700 });

  await test.step("Items tab: the order's currency and its rates in dollars", async () => {
    await page.goto(`/orders/${po}/items`);
    await expect(kv(page, "Currency")).toHaveText("$ US dollar");
    await expect(page.getByRole("cell", { name: "$2.50 / pcs" })).toBeVisible();
  });

  await test.step("Payments: the $700 balance at 88.50 is ₹61,950, in dollars; the order is paid", async () => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Record payment" });
    await form.getByRole("combobox", { name: "Supplier", exact: true }).fill(name);
    await expect(form.getByRole("combobox", { name: "Currency", exact: true })).toHaveValue("USD");
    await expect(form.getByRole("textbox", { name: "Rate (₹ per $)", exact: true })).toHaveValue("88");
    await form.getByRole("textbox", { name: "Amount ($)", exact: true }).fill("700");
    await form.getByRole("textbox", { name: "Rate (₹ per $)", exact: true }).fill("88.5");
    await expect(form.getByRole("status").first()).toHaveText("₹61,950");
    await expect(form.getByRole("status", { name: "Balance now and after" })).toHaveText("Payable to supplier $700.00 → Settled");
    await form.getByRole("textbox", { name: "Mode", exact: true }).fill("Wire");
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(page, `Payment recorded for ${name}. Balance: Payable to supplier $700.00 → Settled`)).toBeVisible();

    await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    const row = page.getByRole("table").nth(1).getByRole("row").filter({ hasText: po });
    const cells = row.getByRole("cell");
    await expect(cells.nth(0)).toHaveText(`${po}${name}`);
    await expect(cells.nth(1)).toHaveText(amountCell("1,000.00", "$"));
    await expect(cells.nth(2)).toHaveText(amountCell("1,000.00", "$"));
    await expect(cells.nth(3)).toHaveText(amountCell("0.00", "$"));
    await expect(cells.nth(4)).toContainText("Paid");
    await expect(cells.nth(5)).toHaveText("₹88,350");
  });

  await test.step("The order's payments tab: dollars, each credit that settled it changed to INR at its own rate", async () => {
    await page.goto(`/orders/${po}/payments`);
    await expect(kpi(page, "Order value")).toContainText("$1,000.00");
    // first(): the KPI card; the Supplier account card's balance also reads "Settled".
    await expect(kpi(page, "Settled").first()).toContainText("$1,000.00");
    await expect(kpi(page, "Outstanding")).toContainText("Paid");
    const settledBy = page.locator("section").filter({ has: page.getByRole("heading", { name: "Settled by" }) });
    await expect(settledBy.getByRole("row").filter({ hasText: "$300.00" })).toContainText("₹26,400");
    await expect(settledBy.getByRole("row").filter({ hasText: "$700.00" })).toContainText("₹61,950");
    await expect(page.getByText("Paid (INR), goods + sea freight").filter({ visible: true }).locator("..")).toContainText("₹88,350");
  });

  await test.step("Payments per supplier: a USD row of its own, never added to the yuan figures", async () => {
    await page.goto("/reports/payments-per-supplier");
    await expect(page.getByRole("table").getByRole("row").filter({ hasText: name })).toContainText("$1,000");
    await expect(kpi(page, "Order value")).toContainText("$1,000");
  });

  await test.step("The order keeps the rate it was placed at: a new supplier rate shows beside it, the PO value in INR stays at the old one", async () => {
    expect(await api.order(po)).toMatchObject({ exchangeRate: 88 });
    const changed = await api.request.patch(`/api/v1/suppliers/${supplierId}`, { data: { exchangeRate: 90 } });
    expect(changed.status(), await changed.text()).toBe(200);
    await page.goto(`/reports/orders/${po}`);
    await expect(kv(page, "Exchange rate on this PO")).toHaveText("1 USD = ₹88.00");
    await expect(kv(page, "PO value in INR")).toHaveText("₹88,000.00 at the PO rate");
    await expect(kv(page, "Exchange rate now")).toHaveText("1 USD = ₹90.00");
    expect(await api.order(po)).toMatchObject({ exchangeRate: 88 });
  });
});
