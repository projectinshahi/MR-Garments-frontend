import type { Page } from "@playwright/test";

import { expect, field, kpi, kv, longDate, shortDate, test, today } from "./live-api";

// Order detail tabs c-e (08 Deposits & payments, 09 Receiving, 10 Containers) against ORD-4, signed in as Management.
// Role/label locators only (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const tabs = (page: Page) => page.getByRole("navigation", { name: "Order sections" });
const rows = (page: Page) => page.getByRole("table").getByRole("row");

test("Deposits & payments: KPIs, every payment at its own rate, totals and the INR working", async ({ page, api }) => {
  const order = await api.createOrder({
    lines: [{ item: "Polo shirts", quantity: 400, rateCny: 20 }],
    deposits: [{ amountCny: 2000, rateInr: 12, paidOn: today(-5) }],
  });
  const agent = (await api.options()).agents.find((a) => a.name === "Sino Freight")!;
  await api.pay(order.id, { kind: "Balance", payeeRole: "agent", agentId: agent.id, amountCny: 1500, rateInr: 12.5, mode: "Cash" });

  await page.goto(`/orders/${order.po}`);
  await tabs(page).getByRole("link", { name: "Deposits & payments" }).click();
  await expect(page).toHaveURL(`/orders/${order.po}/payments`);
  await expect(page.getByText("Polo shirts · Foshan Fabrics · Order value ¥8,000")).toBeVisible();

  await expect(kpi(page, "Order value")).toContainText("¥8,000");
  await expect(kpi(page, "Paid so far")).toContainText("¥3,500");
  await expect(kpi(page, "Paid so far")).toContainText("2 payments");
  await expect(kpi(page, "Balance to pay")).toContainText("¥4,500");

  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page).nth(1).getByRole("cell")).toHaveText([longDate(today(-5)), "Deposit", "Foshan Fabrics", "¥2,000", "12.00", "₹24,000"]);
  await expect(rows(page).nth(2).getByRole("cell")).toHaveText([longDate(today()), "Balance", "Sino Freight", "¥1,500", "12.50", "₹18,750"]);
  await expect(rows(page).nth(3).getByRole("cell")).toHaveText(["Total paid", "", "", "¥3,500", "", "₹42,750"]);

  await expect(kv(page, "¥2,000 × 12.00")).toHaveText("₹24,000");
  await expect(kv(page, "¥1,500 × 12.50")).toHaveText("₹18,750");
  await expect(kv(page, "Goods cost in INR")).toHaveText("₹42,750");
});

test("Deposits & payments: no payments yet, and a fully paid order", async ({ page, api }) => {
  const unpaid = await api.createOrder({ lines: [{ item: "Polo shirts", quantity: 10, rateCny: 100 }] });
  await page.goto(`/orders/${unpaid.po}/payments`);
  await expect(page.getByText("No payments recorded yet.")).toBeVisible();
  await expect(kpi(page, "Paid so far")).toContainText("0 payments");
  await expect(kpi(page, "Balance to pay")).toContainText("¥1,000");

  await api.pay(unpaid.id, { amountCny: 1000, rateInr: 12 });
  await page.reload();
  await expect(kpi(page, "Paid so far")).toContainText("1 payment");
  await expect(kpi(page, "Balance to pay")).toContainText("¥0");
  await expect(kpi(page, "Balance to pay")).toContainText("Fully paid");
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
  await expect(kpi(page, "Short")).toContainText("40 pcs");
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
  await expect(kpi(page, "Short")).toContainText("0 pcs");
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
  const second = await api.load([{ po: order.po, item: "Denim jeans", quantity: 40, bundles: 2 }], { agent: "Dragon Cargo", terms: "CNF" });
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
