import type { Page } from "@playwright/test";

import type { Currency } from "../src/types/domain";
import { addDays, type Api, type CreatedOrder, expect, field, kpi, kv, longDate, shortDate, test, today } from "./live-api";
import { PROCUREMENT_STATE } from "./sessions";

// RPT-5D: Reports › Payments per supplier › one supplier (docs/supplier-payment-detail-contract.md), against the live
// API. Each test makes its own supplier through the API (a new name, so the shared test database's other orders never
// show up here), with a CNY and a USD order, twelve supplier payments (two pages), an agent payment and another
// supplier's order that must stay out. Role/label locators: visited routes stay in the DOM hidden by <Activity>.

test.use({ viewport: { width: 1440, height: 900 } });

const REPORT = "/reports/payments-per-supplier";
const tag = () => String(Date.now()).slice(-7);

/** The visible card (SectionCard) titled `title`. */
const card = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }), visible: true });
const kpiTexts = (page: Page, label: string) => kpi(page, label).getByRole("paragraph");

/** "1 Nov – 30 Nov 2026": the period pill for the month of `day`. */
function periodPill(day: string) {
  const [year, month] = day.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return `${shortDate(`${day.slice(0, 7)}-01`)} – ${longDate(last)}`;
}

async function newSupplier(api: Api, body: Record<string, string>) {
  const response = await api.post("/suppliers", body);
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { supplier: { id: string; name: string } }).supplier;
}

type Line = { item: string; quantity: number; rateCny: number };
type Deposit = { amountCny: number; paidOn: string; rateInr: number };

/** ORD-3 in `currency`, ordered today, with supplier deposits. */
async function placeOrder(api: Api, supplier: { id: string; name: string }, currency: Currency, lines: Line[], deposits: Deposit[]) {
  const { items } = await api.options();
  const body = {
    supplierId: supplier.id,
    currency,
    orderDate: today(),
    deliveryDate: addDays(today(), 30),
    lines: lines.map(({ item, ...line }) => ({ itemId: items.find((i) => i.name === item)!.id, ...line })),
    deposits: deposits.map((deposit) => ({ payee: supplier.name, payeeRole: "supplier", mode: "Bank transfer", ...deposit })),
  };
  const response = await api.post("/orders", body);
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { order: CreatedOrder }).order;
}

test("a supplier's detail: opened from the report, its totals per currency, its own lists, filters, pages and the way back", async ({ page, api }) => {
  test.setTimeout(180_000);
  const month = today().slice(0, 7);
  const supplier = await newSupplier(api, {
    name: `Detail Supplier ${tag()}`,
    contactPerson: "Ms. Lin Detail",
    phone: "+86 100 2000 3000",
    city: "Wenzhou",
    address: "8 Harbour Road, Wenzhou",
  });
  // CNY: ¥1,200 (¥1,000 + ¥200), ten ¥50 deposits on the last ten days at 12 and a ¥100 balance today at 12.
  const cny = await placeOrder(
    api,
    supplier,
    "CNY",
    [
      { item: "Denim jeans", quantity: 100, rateCny: 10 },
      { item: "Cotton fabric", quantity: 50, rateCny: 4 },
    ],
    Array.from({ length: 10 }, (_, index) => ({ amountCny: 50, paidOn: today(-(index + 1)), rateInr: 12 })),
  );
  // USD: $200, a $80 deposit today at 88 (₹7,040).
  const usd = await placeOrder(api, supplier, "USD", [{ item: "Polo shirts", quantity: 40, rateCny: 5 }], [{ amountCny: 80, paidOn: today(), rateInr: 88 }]);
  await api.pay(cny.id, { amountCny: 100, rateInr: 12 });
  // Sea freight to a shipping agent on the same order, and another supplier's order: neither belongs on this page.
  const sino = (await api.options()).agents.find((agent) => agent.name === "Sino Freight")!;
  await api.pay(cny.id, { payeeRole: "agent", agentId: sino.id, amountCny: 999, rateInr: 12 });
  const other = await api.createOrder({ deposits: [{ amountCny: 77, rateInr: 12 }] });

  const detail = `${REPORT}/${supplier.id}`;
  const back = page.getByRole("banner").getByRole("link", { name: "Payments per supplier", exact: true });
  const reportRows = page.getByRole("table").getByRole("row").filter({ hasText: supplier.name });

  await test.step("the report's supplier name and its row open this supplier's detail with the period", async () => {
    await page.goto(`${REPORT}?period=${month}`);
    // One row per currency.
    await expect(reportRows).toHaveCount(2);
    await reportRows.first().getByRole("link", { name: supplier.name }).click();
    await expect(page).toHaveURL(`${detail}?period=${month}`);
    await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
    await expect(page.getByRole("banner").getByText(periodPill(today()), { exact: true })).toBeVisible();

    await expect(back).toHaveAttribute("href", `${REPORT}?period=${month}`);
    await back.click();
    await expect(page).toHaveURL(`${REPORT}?period=${month}`);
    await expect(page.getByRole("heading", { level: 1, name: "Payments per supplier" })).toBeVisible();
    // A click anywhere on the row (here its Orders cell) opens the detail too.
    await reportRows.filter({ hasText: usd.po }).getByRole("cell").nth(1).click();
    await expect(page).toHaveURL(`${detail}?period=${month}`);
    await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
  });

  await test.step("filtered by supplier too, the detail keeps both filters for the way back", async () => {
    await page.goto(`${REPORT}?period=${month}&supplier=${supplier.id}`);
    await reportRows.first().getByRole("link", { name: supplier.name }).click();
    await expect(page).toHaveURL(`${detail}?period=${month}&supplier=${supplier.id}`);
    await expect(back).toHaveAttribute("href", `${REPORT}?period=${month}&supplier=${supplier.id}`);
  });

  await test.step("overview: the supplier's details and its totals, one figure per currency", async () => {
    await expect(kv(page, "Name")).toHaveText(supplier.name);
    await expect(kv(page, "Supplier ID")).toHaveText(supplier.id);
    await expect(kv(page, "Contact person")).toHaveText("Ms. Lin Detail");
    await expect(kv(page, "Phone")).toHaveText("+86 100 2000 3000");
    await expect(kv(page, "City")).toHaveText("Wenzhou");
    await expect(kv(page, "Address")).toHaveText("8 Harbour Road, Wenzhou");
    await expect(kv(page, "Payment currency")).toHaveText("¥ Chinese yuan");
    await expect(kv(page, "Status")).toHaveText("Active");

    await expect(kpiTexts(page, "Orders")).toHaveText(["Orders", "2", "2 open"]);
    await expect(kpiTexts(page, "Payment transactions")).toHaveText(["Payment transactions", "12", "paid and due"]);
    await expect(kpiTexts(page, "Line items")).toHaveText(["Line items", "3", "3 products"]);
    // Yuan and dollars side by side, never one summed number; INR (payment-day rates) adds up; the agent's ¥999 is out.
    await expect(kpiTexts(page, "Order value")).toHaveText(["Order value", "¥1,200 · $200", "all stages"]);
    await expect(kpiTexts(page, "Paid so far").nth(1)).toHaveText("¥600 · $80");
    await expect(kpiTexts(page, "Paid so far").nth(2)).toContainText("of which deposits ¥500 · $80");
    await expect(kpiTexts(page, "Paid so far").nth(2)).toContainText("₹14,240 at payment-day rates");
    await expect(kpiTexts(page, "Balance to pay")).toHaveText(["Balance to pay", "¥600 · $120", "order value less paid"]);
  });

  const payments = card(page, "Payments");
  const paymentRows = payments.getByRole("row");
  const orders = card(page, "Orders");
  const orderRows = orders.getByRole("row");
  const products = card(page, "Products");
  const id = /^[0-9a-f]{8}$/;

  await test.step("payments: this supplier's only, newest first, ten to a page", async () => {
    await expect(payments.getByText("Showing 1 to 10 of 12 payments")).toBeVisible();
    await expect(paymentRows).toHaveCount(11);
    await expect(paymentRows.filter({ hasText: new RegExp(`${cny.po}|${usd.po}`) })).toHaveCount(10);
    await expect(paymentRows.nth(1).getByRole("cell")).toHaveText([id, longDate(today()), cny.po, "Balance", "Bank transfer", "CNY", "¥100", "₹1,200", "Paid"]);
    await expect(paymentRows.nth(2).getByRole("cell")).toHaveText([id, longDate(today()), usd.po, "Deposit", "Bank transfer", "USD", "$80", "₹7,040", "Paid"]);
    await expect(paymentRows.nth(3).getByRole("cell")).toHaveText([id, longDate(today(-1)), cny.po, "Deposit", "Bank transfer", "CNY", "¥50", "₹600", "Paid"]);

    await payments.getByRole("button", { name: "Page 2" }).click();
    await expect(page).toHaveURL(new RegExp(`\\?period=${month}&supplier=${supplier.id}&paymentsPage=2$`));
    await expect(payments.getByText("Showing 11 to 12 of 12 payments")).toBeVisible();
    await expect(payments.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    await expect(paymentRows).toHaveCount(3);
    await expect(paymentRows.nth(1).getByRole("cell").nth(1)).toHaveText(longDate(today(-9)));
    await expect(paymentRows.nth(2).getByRole("cell").nth(1)).toHaveText(longDate(today(-10)));
  });

  await test.step("payment dates narrow the payments (back to page 1) and Clear restores them", async () => {
    await field(payments, /^From$/).fill(today(-3));
    await expect(page).toHaveURL(new RegExp(`&paymentFrom=${today(-3)}$`));
    await field(payments, /^To$/).fill(today(-2));
    await expect(page).toHaveURL(new RegExp(`&paymentFrom=${today(-3)}&paymentTo=${today(-2)}$`));
    await expect(payments.getByText("Showing 1 to 2 of 2 payments")).toBeVisible();
    await expect(paymentRows).toHaveCount(3);
    await expect(paymentRows.nth(1).getByRole("cell").nth(1)).toHaveText(longDate(today(-2)));
    await expect(paymentRows.nth(2).getByRole("cell").nth(1)).toHaveText(longDate(today(-3)));
    // The summary follows the period only.
    await expect(kpiTexts(page, "Payment transactions").nth(1)).toHaveText("12");

    await payments.getByRole("button", { name: "Clear" }).click();
    await expect(page).toHaveURL(`${detail}?period=${month}&supplier=${supplier.id}`);
    await expect(payments.getByText("Showing 1 to 10 of 12 payments")).toBeVisible();
  });

  await test.step("orders: both, newest first, each in its own currency; the stage filter writes the URL", async () => {
    await expect(orderRows).toHaveCount(3);
    const dates = [longDate(today()), longDate(addDays(today(), 30))];
    await expect(orderRows.nth(1).getByRole("cell")).toHaveText([usd.po, ...dates, "40 pcs", "$200", "$80", "$120", /\S/]);
    await expect(orderRows.nth(2).getByRole("cell")).toHaveText([cny.po, ...dates, "100 pcs · 50 m", "¥1,200", "¥600", "¥600", /\S/]);

    await orders.getByRole("button", { name: "Stage: All stages" }).click();
    await page.getByRole("menuitemradio", { name: "2. Receiving in China" }).click();
    await expect(page).toHaveURL(new RegExp(`&stage=2$`));
    await expect(orders.getByText("No orders at this stage.")).toBeVisible();
    await expect(kpiTexts(page, "Orders").nth(1)).toHaveText("2");
    await orders.getByRole("button", { name: "Stage: 2. Receiving in China" }).click();
    await page.getByRole("menuitemradio", { name: "1. Order and deposit" }).click();
    await expect(page).toHaveURL(new RegExp(`&stage=1$`));
    await expect(orderRows).toHaveCount(3);
  });

  await test.step("products: one row per order line, in the line's currency", async () => {
    await expect(products.getByRole("row")).toHaveCount(4);
    await expect(products.getByRole("row").nth(1).getByRole("cell")).toHaveText(["Polo shirts", usd.po, "40 pcs", "$5.00", "$200", "USD"]);
    await expect(products.getByRole("row").nth(2).getByRole("cell")).toHaveText(["Denim jeans", cny.po, "100 pcs", "¥10.00", "¥1,000", "CNY"]);
    await expect(products.getByRole("row").nth(3).getByRole("cell")).toHaveText(["Cotton fabric", cny.po, "50 m", "¥4.00", "¥200", "CNY"]);
    for (const list of [payments, orders, products]) await expect(list.getByText(other.po)).toHaveCount(0);
  });

  await test.step("Back keeps the report's period and supplier, not the detail's own filters", async () => {
    await expect(back).toHaveAttribute("href", `${REPORT}?period=${month}&supplier=${supplier.id}`);
    await back.click();
    await expect(page).toHaveURL(`${REPORT}?period=${month}&supplier=${supplier.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Payments per supplier" })).toBeVisible();
  });

  await test.step("a PO opens its order", async () => {
    await page.goto(detail);
    await orders.getByRole("link", { name: cny.po }).click();
    await expect(page).toHaveURL(`/orders/${cny.po}`);
    await expect(page.getByRole("heading", { level: 1, name: cny.po })).toBeVisible();
  });
});

test("a supplier with no orders shows zeros and an empty state in each list", async ({ page, api }) => {
  // Contact details left out, paid in dollars.
  const supplier = await newSupplier(api, { name: `Detail Empty ${tag()}`, currency: "USD" });
  await page.goto(`${REPORT}/${supplier.id}`);
  await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
  for (const label of ["Contact person", "Phone", "City", "Address"]) await expect(kv(page, label)).toHaveText("–");
  await expect(kv(page, "Payment currency")).toHaveText("$ US dollar");
  await expect(kpiTexts(page, "Orders")).toHaveText(["Orders", "0", "0 open"]);
  await expect(kpiTexts(page, "Order value").nth(1)).toHaveText("$0");
  await expect(kpiTexts(page, "Balance to pay").nth(1)).toHaveText("$0");
  for (const text of ["No payments yet.", "No orders yet.", "No order lines yet."]) await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  const month = today().slice(0, 7);
  await page.goto(`${REPORT}/${supplier.id}?period=${month}&stage=2&paymentFrom=${today(-5)}`);
  await expect(page.getByRole("banner").getByText(periodPill(today()), { exact: true })).toBeVisible();
  for (const text of ["No payments in these dates.", "No orders in this period.", "No order lines in this period."]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
});

test("an unknown or malformed supplier id shows the not-found page", async ({ page }) => {
  for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-supplier"]) {
    await page.goto(`${REPORT}/${id}`);
    await expect(page.getByText("Not found", { exact: true })).toBeVisible();
    await expect(page.getByText("This record doesn't exist, or its link is wrong.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Orders" })).toBeVisible();
  }
});

test.describe("without Reports access", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("Procurement is sent to its landing page, and the API refuses the detail", async ({ page }) => {
    const options = await page.request.get("/api/v1/orders/options");
    const { suppliers } = (await options.json()) as { suppliers: { id: string }[] };
    await page.goto(`${REPORT}/${suppliers[0]!.id}?period=${today().slice(0, 7)}`);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    expect((await page.request.get(`/api/v1/reports/payments-per-supplier/${suppliers[0]!.id}`)).status()).toBe(403);
  });
});
