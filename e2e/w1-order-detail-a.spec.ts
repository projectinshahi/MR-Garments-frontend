import type { Page } from "@playwright/test";

import { ANITA, expect, freshSignIn, kv, longDate, shortDate, test, today } from "./live-api";
import { LOADING_STAFF_STATE, PROCUREMENT_STATE } from "./sessions";

// Order detail (06, 07) against ORD-4: the frame (breadcrumb, tabs per role), Overview and Items, and the
// "Not found" page for unknown POs and the removed tabs. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const tabs = (page: Page) => page.getByRole("navigation", { name: "Order sections" });
const ALL_TABS = ["Overview", "Items", "Deposits & payments", "Receiving", "Containers"];

async function expectTabs(page: Page, names: string[]) {
  for (const name of ALL_TABS) await expect(tabs(page).getByRole("link", { name, exact: true })).toHaveCount(names.includes(name) ? 1 : 0);
}

const expectNotFound = async (page: Page) => {
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await expect(page.getByText("This record doesn't exist, or its link is wrong.")).toBeVisible();
};

test("Overview: header, tabs, facts, journey and money", async ({ page, api }) => {
  const order = await api.createOrder({
    supplier: "Guangzhou Textile Co.",
    lines: [
      { item: "Denim jeans", quantity: 300, rateCny: 15 },
      { item: "Cotton fabric", quantity: 1200, rateCny: 8.5 },
    ],
    deliveryDate: today(30),
    deposits: [{ amountCny: 3000, rateInr: 12.1 }],
  });

  await page.goto(`/orders/${order.po}`);
  await expect(page.getByRole("heading", { level: 1, name: order.po })).toBeVisible();
  await expectTabs(page, ALL_TABS);
  await expect(tabs(page).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { level: 2, name: "Denim jeans" })).toBeVisible();
  await expect(page.getByText("On track", { exact: true })).toBeVisible();
  await expect(page.getByText("Guangzhou Textile Co. · Contact: Mr. Zhao Lin")).toBeVisible();
  await expect(kv(page, "Order date")).toHaveText(longDate(today()));
  await expect(kv(page, "Delivery date")).toHaveText(longDate(today(30)));
  await expect(kv(page, "Quantity")).toHaveText("300 pcs");

  // Journey: stage 1 reached on the order date, nothing later yet.
  const journey = page.getByRole("list").filter({ hasText: "1. Order and deposit" });
  await expect(journey.getByRole("listitem")).toHaveCount(6);
  await expect(journey.getByRole("listitem").first()).toContainText(shortDate(today()));
  await expect(journey.getByRole("listitem").nth(1)).toHaveText("2. Receiving in China");

  await expect(kv(page, "Goods, paid ¥3,000")).toHaveText("₹36,300");

  // The breadcrumb goes back to Orders.
  await page.getByRole("banner").getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL("/orders");
});

test("Overview of a late order and a received order shows their status and journey", async ({ page, api }) => {
  const order = await api.createOrder({ orderDate: today(-15), deliveryDate: today(-2), lines: [{ item: "Track pants", quantity: 80, rateCny: 20 }] });
  await page.goto(`/orders/${order.po}`);
  await expect(page.getByText("Late 2 days", { exact: true })).toBeVisible();

  await api.receive(order.po, { "Track pants": 50 });
  await page.reload();
  const journey = page.getByRole("list").filter({ hasText: "1. Order and deposit" });
  await expect(journey.getByRole("listitem").nth(1)).toContainText(shortDate(today()));
  await expect(journey.getByRole("listitem").nth(1)).toContainText("Guangzhou office");
});

test("Items: every line with its rate and total, and the order terms", async ({ page, api }) => {
  const order = await api.createOrder({
    supplier: "Guangzhou Textile Co.",
    lines: [
      { item: "Denim jeans", quantity: 300, rateCny: 15 },
      { item: "Cotton fabric", quantity: 1200, rateCny: 8.5 },
    ],
  });
  await page.goto(`/orders/${order.po}`);
  await tabs(page).getByRole("link", { name: "Items" }).click();
  await expect(page).toHaveURL(`/orders/${order.po}/items`);
  await expect(tabs(page).getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(`Denim jeans · Guangzhou Textile Co. · Order date ${longDate(today())}`)).toBeVisible();

  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1).getByRole("cell")).toHaveText(["Denim jeans", "300 pcs", "¥15.00 / pcs", "¥4,500"]);
  await expect(rows.nth(2).getByRole("cell")).toHaveText(["Cotton fabric", "1,200 m", "¥8.50 / m", "¥10,200"]);
  // Mixed units: no quantity total.
  await expect(rows.nth(3).getByRole("cell")).toHaveText(["Total", "", "", "¥14,700"]);

  for (const [label, value] of [
    ["Supplier", "Guangzhou Textile Co."],
    ["Contact", "Mr. Zhao Lin"],
    ["Phone", "+86 138 0013 2244"],
    ["City", "Guangzhou"],
    ["Order date", longDate(today())],
    ["Delivery date", longDate(today(30))],
    ["Currency", "¥ Chinese yuan"],
  ]) {
    await expect(kv(page, label!)).toHaveText(value!);
  }

  // Back to Overview through its tab.
  await tabs(page).getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(`/orders/${order.po}`);
});

test("Items of a one-unit order totals the quantity", async ({ page, api }) => {
  const order = await api.createOrder({
    lines: [
      { item: "Denim jeans", quantity: 100, rateCny: 10 },
      { item: "Polo shirts", quantity: 50, rateCny: 6 },
    ],
  });
  await page.goto(`/orders/${order.po}/items`);
  await expect(page.getByRole("table").getByRole("row").last().getByRole("cell")).toHaveText(["Total", "150 pcs", "", "¥1,300"]);
});

test("an unknown or malformed PO and the removed tabs show Not found", async ({ page, api }) => {
  await page.goto("/orders/PO-999999");
  await expectNotFound(page);
  await expect(page.getByRole("heading", { level: 1, name: "PO-999999" })).toHaveCount(0);
  await page.getByRole("link", { name: "Go to Orders" }).click();
  await expect(page).toHaveURL("/orders");

  await page.goto("/orders/not-a-po");
  await expectNotFound(page);

  const order = await api.createOrder();
  for (const removed of ["clearing-transport", "warehouse", "cost", "history"]) {
    await page.goto(`/orders/${order.po}/${removed}`);
    await expectNotFound(page);
  }
});

test.describe("Procurement (receiving View, containers None)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("has no Containers tab, and its URL is not found", async ({ page, api }) => {
    const order = await api.createOrder();
    await page.goto(`/orders/${order.po}`);
    await expectTabs(page, ["Overview", "Items", "Deposits & payments", "Receiving"]);
    await page.goto(`/orders/${order.po}/containers`);
    await expectNotFound(page);
  });
});

test.describe("Accounts (payments Enter, no receiving or containers)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("has no Receiving or Containers tab, and their URLs are not found", async ({ page, api }) => {
    const order = await api.createOrder();
    await page.goto(`/orders/${order.po}`);
    await expectTabs(page, ["Overview", "Items", "Deposits & payments"]);
    await tabs(page).getByRole("link", { name: "Deposits & payments" }).click();
    await expect(page).toHaveURL(`/orders/${order.po}/payments`);
    for (const hidden of ["receiving", "containers"]) {
      await page.goto(`/orders/${order.po}/${hidden}`);
      await expectNotFound(page);
    }
  });
});

test.describe("China staff (no orders access)", () => {
  test.use({ storageState: LOADING_STAFF_STATE });

  test("an order page goes to the staff home", async ({ page, api }) => {
    const order = await api.createOrder();
    await page.goto(`/orders/${order.po}`);
    await expect(page).toHaveURL("/home");
  });
});
