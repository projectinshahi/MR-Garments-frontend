import type { Page } from "@playwright/test";

import { expect, field, kpi, kv, longDate, shortDate, test, today } from "./live-api";

// Order detail tabs c-e (08 Payments, 09 Receiving, 10 Containers) against ORD-4, signed in as Management.
// Role/label locators only (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const tabs = (page: Page) => page.getByRole("navigation", { name: "Order sections" });
const rows = (page: Page) => page.getByRole("table").getByRole("row");

test("Payments: KPIs, settled by (each credit at its own rate), sea freight to agents, the supplier account and the INR", async ({ page, api }) => {
  // A supplier of its own, so FIFO settles this order only: ¥2,000 at 12 to the account, ¥1,500 at 12.5 to an agent.
  const supplier = await api.newSupplier("Polo Ledger");
  // Received in full: an order is worth its received quantity x rate (owner rule of 2026-11-23).
  const order = await api.createReceivedOrder({ supplier: supplier.name, lines: [{ item: "Polo shirts", quantity: 400, rateCny: 20 }] });
  await api.paySupplier(supplier.id, { amount: 2000, rateInr: 12, paidOn: today(-5), reference: "TXN-S1" });
  await api.payAgent(order.id, { kind: "Balance", amountCny: 1500, rateInr: 12.5, mode: "Cash" });

  await page.goto(`/orders/${order.po}`);
  await tabs(page).getByRole("link", { name: "Payments" }).click();
  await expect(page).toHaveURL(`/orders/${order.po}/payments`);
  await expect(page.getByText(`Polo shirts · ${supplier.name} · Order value (received) ¥8,000.00 · PO value ¥8,000.00`)).toBeVisible();

  await expect(kpi(page, "Order value (received)")).toContainText("¥8,000.00");
  await expect(kpi(page, "Settled")).toContainText("¥2,000.00");
  await expect(kpi(page, "Settled")).toContainText("from the supplier account");
  await expect(kpi(page, "Outstanding")).toContainText("¥6,000.00");
  await expect(kpi(page, "Outstanding")).toContainText("Partly paid");
  // The agent's ¥1,500 is sea freight, shown apart and never settling the order.
  await expect(kpi(page, "Sea freight")).toContainText("¥1,500.00");
  await expect(kpi(page, "Sea freight")).toContainText("₹18,750 to agents");

  // Settled by: the supplier payment at its own rate, with the total row.
  const settledBy = page.locator("section").filter({ has: page.getByRole("heading", { name: "Settled by" }) });
  await expect(settledBy.getByRole("row").nth(1).getByRole("cell")).toHaveText([longDate(today(-5)), "Payment", "Bank transfer", "TXN-S1", "¥2,000.00", "12.00", "₹24,000"]);
  await expect(settledBy.getByRole("row").last()).toContainText("¥2,000.00");
  await expect(settledBy.getByRole("row").last()).toContainText("₹24,000");

  // Recorded against the PO: only the agent payment (supplier payments are on the account). Management has Void.
  const recorded = page.locator("section").filter({ has: page.getByRole("heading", { name: `Recorded against ${order.po}` }) });
  await expect(recorded.getByRole("row")).toHaveCount(2);
  await expect(recorded.getByRole("row").nth(1).getByRole("cell")).toHaveText([longDate(today()), "Sea freight · Balance", "Sino Freight", "¥1,500.00", "12.50", "₹18,750", "Paid", "Void"]);

  // The supplier's account beside it: ¥6,000 payable, one open order, and the INR total (goods + sea freight).
  const account = page.locator("section").filter({ has: page.getByRole("heading", { name: "Supplier account" }) });
  await expect(account).toContainText(`${supplier.name} · CNY`);
  await expect(account).toContainText("¥6,000.00");
  await expect(account).toContainText("Payable to supplier");
  await expect(account).toContainText("1 open order");
  await expect(account.getByRole("link", { name: "Open ledger" })).toHaveAttribute("href", `/supplier-ledger/${supplier.id}`);
  await expect(page.getByText("Paid (INR), goods + sea freight").filter({ visible: true }).locator("..")).toContainText("₹42,750");
});

test("Payments: nothing settled yet, then a fully paid order", async ({ page, api }) => {
  const supplier = await api.newSupplier("Unpaid Polo");
  const unpaid = await api.createReceivedOrder({ supplier: supplier.name, lines: [{ item: "Polo shirts", quantity: 10, rateCny: 100 }] });
  await page.goto(`/orders/${unpaid.po}/payments`);
  await expect(page.getByText("Nothing has settled this order yet.")).toBeVisible();
  await expect(page.getByText("No payment names this PO.")).toBeVisible();
  await expect(kpi(page, "Settled")).toContainText("¥0.00");
  await expect(kpi(page, "Outstanding")).toContainText("¥1,000.00");
  await expect(kpi(page, "Outstanding")).toContainText("Unpaid");

  await api.paySupplier(supplier.id, { amount: 1000, rateInr: 12 });
  await page.reload();
  // first(): the KPI card; the Supplier account card's balance now also reads "Settled".
  await expect(kpi(page, "Settled").first()).toContainText("¥1,000.00");
  await expect(kpi(page, "Outstanding")).toContainText("¥0.00");
  await expect(kpi(page, "Outstanding")).toContainText("Paid");
});

test("Receiving: empty, then each receipt with its totals, remark and history", async ({ page, api }) => {
  const order = await api.createOrder({
    lines: [
      { item: "Denim jeans", quantity: 100, rateCny: 10 },
      { item: "Kids t-shirts", quantity: 50, rateCny: 4 },
    ],
  });
  await page.goto(`/orders/${order.po}`);
  await tabs(page).getByRole("link", { name: "Receiving" }).click();
  await expect(page).toHaveURL(`/orders/${order.po}/receiving`);
  await expect(page.getByText("Denim jeans · Foshan Fabrics · Not received in China yet")).toBeVisible();
  await expect(page.getByText("No receipts recorded yet.")).toBeVisible();

  // A short first receipt: the remark shows.
  await api.receive(order.po, { "Denim jeans": 60, "Kids t-shirts": 50 }, { receivedOn: today(-2), bundles: 3, deliveryNote: "DN-1", shortRemark: "40 jeans to follow" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Receipt in China" })).toBeVisible();
  await expect(kpi(page, "Ordered")).toContainText("100 pcs");
  await expect(kpi(page, "Received in China")).toContainText("60 pcs");
  await expect(kpi(page, "Received in China")).toContainText("3 bundles");
  await expect(kpi(page, "Remaining")).toContainText("40 pcs");
  await expect(field(page, "Received on")).toHaveValue(longDate(today(-2)));
  await expect(field(page, "Delivery note")).toHaveValue("DN-1");
  await expect(page.getByText("40 jeans to follow")).toBeVisible();
  await expect(rows(page).nth(1).getByRole("cell")).toHaveText(["Denim jeans", "100 pcs", "60 pcs", "40"]);
  await expect(rows(page).nth(2).getByRole("cell")).toHaveText(["Kids t-shirts", "50 pcs", "50 pcs", "0"]);

  // The second receipt completes the order; the latest one is shown, both are in the history.
  await api.receive(order.po, { "Denim jeans": 40 }, { bundles: 2, deliveryNote: "DN-2", shortRemark: "" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Latest receipt in China" })).toBeVisible();
  await expect(kpi(page, "Received in China")).toContainText("100 pcs");
  await expect(kpi(page, "Received in China")).toContainText("5 bundles");
  await expect(kpi(page, "Remaining")).toContainText("0 pcs");
  await expect(field(page, "Received on")).toHaveValue(longDate(today()));
  await expect(field(page, "Office")).toHaveValue("Guangzhou office");
  await expect(field(page, "Received by")).toHaveValue("Suresh Menon");
  await expect(field(page, "Bundles received")).toHaveValue("2");
  await expect(field(page, "Delivery note")).toHaveValue("DN-2");
  await expect(page.getByText("40 jeans to follow")).toHaveCount(0);
  await expect(rows(page).nth(1).getByRole("cell")).toHaveText(["Denim jeans", "100 pcs", "100 pcs", "0"]);

  const history = page.getByRole("list").filter({ hasText: "Received 40 pcs Denim jeans" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await expect(history.getByRole("listitem").first()).toContainText(`${shortDate(today())} · Guangzhou office · Suresh Menon`);
  await expect(history.getByRole("listitem").nth(1)).toContainText("Received 60 pcs Denim jeans, 50 pcs Kids t-shirts");
  await expect(history.getByRole("listitem").nth(1)).toContainText(shortDate(today(-2)));
});

test("Containers: empty, then each container with its route, goods and a link to it", async ({ page, api }) => {
  const order = await api.createOrder({ lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
  await api.receive(order.po, { "Denim jeans": 100 }, { shortRemark: "" });
  await page.goto(`/orders/${order.po}`);
  await tabs(page).getByRole("link", { name: "Containers" }).click();
  await expect(page).toHaveURL(`/orders/${order.po}/containers`);
  await expect(page.getByText("Denim jeans · Foshan Fabrics · 0 containers")).toBeVisible();
  await expect(page.getByText("Not loaded into a container yet.")).toBeVisible();

  const first = await api.load([{ po: order.po, item: "Denim jeans", quantity: 60, bundles: 3 }], { loadedOn: today(-1), eta: today(25) });
  await page.reload();
  await expect(page.getByText("Denim jeans · Foshan Fabrics · 1 container")).toBeVisible();
  await expect(page.getByRole("heading", { name: `Container ${first.number}` })).toBeVisible();
  await expect(page.getByText("Shipping agent: Sino Freight")).toBeVisible();
  await expect(page.getByText(`Loaded ${shortDate(today(-1))}`)).toBeVisible();
  await expect(page.getByText(`ETA ${shortDate(today(25))}`)).toBeVisible();
  await expect(field(page, "Container number")).toHaveValue(first.number);
  await expect(page.getByRole("heading", { name: "Goods of this order in the container" })).toBeVisible();
  await expect(kv(page, "Denim jeans")).toHaveText("60 pcs");
  await expect(kv(page, "Bundles")).toHaveText("3");

  // Sailed: the route shows it.
  await api.updateContainer(first.id, { status: "sea", sailedOn: today() });
  // The rest of the order, in a second container: an order keeps one container terms value (backend docs/order-container-terms.md).
  const second = await api.load([{ po: order.po, item: "Denim jeans", quantity: 40, bundles: 2 }], { agent: "Dragon Cargo" });
  await page.reload();
  await expect(page.getByText("Denim jeans · Foshan Fabrics · 2 containers")).toBeVisible();
  await expect(page.getByText(`Sailed ${shortDate(today())}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: `Goods of this order in ${second.number}` })).toBeVisible();
  await expect(page.getByText("Shipping agent: Dragon Cargo")).toBeVisible();

  // The container number opens the container page.
  await page.getByRole("link", { name: first.number }).click();
  await expect(page).toHaveURL(`/containers/${first.id}`);
  await expect(page.getByRole("heading", { level: 1, name: first.number })).toBeVisible();
});
