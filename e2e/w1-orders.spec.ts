import type { Page } from "@playwright/test";

import { ANITA, expect, freshSignIn, inr, shortDate, test, today } from "./live-api";
import { PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Orders list (05) against the live API (ORD-1, ORD-2). Every test creates its own orders and finds them by PO, because
// spec files share one test database. Role/label locators only (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const table = (page: Page) => page.getByRole("table");
const rowOf = (page: Page, po: string) => table(page).getByRole("row").filter({ hasText: po });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search PO, item or supplier" });
const chips = (page: Page) => page.getByRole("group", { name: "Order status" });
const EMPTY = "No orders match these filters.";

async function choose(page: Page, current: RegExp, option: string) {
  await page.getByRole("button", { name: current }).click();
  await page.getByRole("menuitemradio", { name: option, exact: true }).click();
}

test("a new order is listed with its figures; the row and the PO link open it", async ({ page, api }) => {
  const due = today(40);
  const order = await api.createOrder({
    supplier: "Hangzhou Knits",
    lines: [{ item: "Polo shirts", quantity: 240, rateCny: 25 }],
    deliveryDate: due,
    deposits: [{ amountCny: 1000, rateInr: 12 }],
  });

  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await search(page).fill(order.po);
  const row = rowOf(page, order.po);
  for (const text of ["Polo shirts", "Hangzhou Knits", "240 pcs", shortDate(due), "1. Order and deposit", "On track", inr(12_000)]) {
    await expect(row).toContainText(text);
  }
  await expect(table(page).getByRole("row")).toHaveCount(2);
  await expect(page.getByText("Showing 1 to 1 of 1 orders")).toBeVisible();

  // The row opens the order.
  await row.getByRole("cell", { name: "Hangzhou Knits" }).click();
  await expect(page).toHaveURL(`/orders/${order.po}`);
  await expect(page.getByRole("heading", { level: 1, name: order.po })).toBeVisible();

  // So does its PO link (keyboard reachable).
  await page.goto("/orders");
  await search(page).fill(order.po);
  await rowOf(page, order.po).getByRole("link", { name: order.po, exact: true }).click();
  await expect(page).toHaveURL(`/orders/${order.po}`);

  // Persisted: a reload of the list still has it.
  await page.goto("/orders");
  await page.reload();
  await search(page).fill(order.po);
  await expect(rowOf(page, order.po)).toContainText("Polo shirts");
});

test("search, stage and supplier filters narrow the rows, with an empty state", async ({ page, api }) => {
  const order = await api.createOrder({ supplier: "Shenzhen Apparel", lines: [{ item: "Track pants", quantity: 75, rateCny: 30 }] });
  await page.goto("/orders");

  // Search by PO, item or supplier (case-insensitive).
  await search(page).fill(order.po.toLowerCase());
  await expect(rowOf(page, order.po)).toBeVisible();
  await search(page).fill("no such order zzz");
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Table pagination" })).toHaveCount(0);

  // Nothing reaches stage 6 in this batch, so the stage filter can show the empty state truthfully.
  await search(page).fill("");
  await choose(page, /^Stage: All stages$/, "6. India warehouse");
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  await choose(page, /^Stage: 6\. India warehouse$/, "1. Order and deposit");
  await search(page).fill(order.po);
  await expect(rowOf(page, order.po)).toBeVisible();
  await choose(page, /^Stage: 1\. Order and deposit$/, "2. Receiving in China");
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  await choose(page, /^Stage: 2\. Receiving in China$/, "All stages");
  await expect(rowOf(page, order.po)).toBeVisible();

  // Supplier filter.
  await choose(page, /^Supplier: All suppliers$/, "Shenzhen Apparel");
  await expect(rowOf(page, order.po)).toBeVisible();
  await choose(page, /^Supplier: Shenzhen Apparel$/, "Yiwu Trims Ltd.");
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  await choose(page, /^Supplier: Yiwu Trims Ltd\.$/, "All suppliers");
  await expect(rowOf(page, order.po)).toBeVisible();
});

test("status chips: Late, Due soon, Short received and Completed, with their counts", async ({ page, api }) => {
  const late = await api.createOrder({ orderDate: today(-20), deliveryDate: today(-3) });
  const dueSoon = await api.createOrder({ deliveryDate: today(3) });
  const dueToday = await api.createOrder({ deliveryDate: today() });
  const short = await api.createOrder({ lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }], deliveryDate: today(60) });
  await api.receive(short.po, { "Denim jeans": 60 });
  await api.load([{ po: short.po, item: "Denim jeans", quantity: 60 }]);

  await page.goto("/orders");
  const status = async (po: string) => {
    await search(page).fill(po);
    return rowOf(page, po);
  };
  await expect(await status(late.po)).toContainText("Late 3 days");
  await expect(await status(dueSoon.po)).toContainText("Due in 3 days");
  await expect(await status(dueToday.po)).toContainText("Due today");
  await expect(await status(short.po)).toContainText("Short by 40 pcs");
  await expect(rowOf(page, short.po)).toContainText("3. Container loading");
  await search(page).fill("");

  // Each chip shows its count, and selecting it lists exactly that many orders.
  // "Due today" counts as due soon.
  for (const [label, members, other] of [
    ["Late", [late], dueSoon],
    ["Due soon", [dueSoon, dueToday], late],
    ["Short received", [short], late],
  ] as const) {
    const chip = chips(page).getByRole("button", { name: new RegExp(`^${label} \\d+$`) });
    const count = Number((await chip.textContent())!.split(" ").at(-1));
    expect(count).toBeGreaterThan(0);
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(new RegExp(`^Showing 1 to ${Math.min(count, 10)} of ${count} orders$`))).toBeVisible();
    for (const member of members) {
      await search(page).fill(member.po);
      await expect(rowOf(page, member.po)).toBeVisible();
    }
    await search(page).fill(other.po);
    await expect(table(page).getByText(EMPTY)).toBeVisible();
    await search(page).fill("");
  }

  // Nothing reaches stage 6 (India warehouse) in this batch.
  await chips(page).getByRole("button", { name: "Completed" }).click();
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  const all = chips(page).getByRole("button", { name: /^All \d+$/ });
  await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(chips(page).getByRole("button", { name: "Completed" })).toHaveAttribute("aria-pressed", "false");
});

test("the pager shows 10 orders a page, with page, previous and next buttons", async ({ page, api }) => {
  const created = [];
  for (let i = 0; i < 11; i += 1) created.push(await api.createOrder());
  const total = (await api.get<unknown[]>("/orders")).length;

  await page.goto("/orders");
  const pager = page.getByRole("navigation", { name: "Table pagination" });
  await expect(pager.getByText(`Showing 1 to 10 of ${total} orders`)).toBeVisible();
  await expect(table(page).getByRole("row")).toHaveCount(11);
  // Newest first: the last ten created fill page 1, the first one opens page 2.
  await expect(rowOf(page, created[10]!.po)).toBeVisible();
  await expect(rowOf(page, created[0]!.po)).toHaveCount(0);
  await expect(pager.getByRole("button", { name: "Previous page" })).toBeDisabled();

  await pager.getByRole("button", { name: "Page 2", exact: true }).click();
  await expect(pager.getByRole("button", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(pager.getByText(new RegExp(`^Showing 11 to \\d+ of ${total} orders$`))).toBeVisible();
  await expect(rowOf(page, created[0]!.po)).toBeVisible();

  await pager.getByRole("button", { name: "Previous page" }).click();
  await expect(pager.getByRole("button", { name: "Page 1", exact: true })).toHaveAttribute("aria-current", "page");
  await pager.getByRole("button", { name: "Next page" }).click();
  await expect(pager.getByRole("button", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page");

  // A filter change goes back to page 1.
  await search(page).fill(created[0]!.po);
  await expect(page.getByText("Showing 1 to 1 of 1 orders")).toBeVisible();
});

test("Management sees + New order, which opens the form", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("link", { name: "+ New order" }).click();
  await expect(page).toHaveURL("/orders/new");
  await expect(page.getByRole("heading", { level: 1, name: "New order" })).toBeVisible();
});

test.describe("Procurement (orders Enter)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("sees + New order", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByRole("link", { name: "+ New order" })).toHaveAttribute("href", "/orders/new");
  });
});

test.describe("Accounts (orders View)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("sees orders Management placed, but no + New order, and the form URL says no access", async ({ page, api }) => {
    const order = await api.createOrder({ supplier: "Yiwu Trims Ltd.", lines: [{ item: "Kids t-shirts", quantity: 50, rateCny: 4 }] });
    await page.goto("/orders");
    await search(page).fill(order.po);
    await expect(rowOf(page, order.po)).toContainText("Kids t-shirts");
    await expect(page.getByRole("link", { name: "+ New order" })).toHaveCount(0);

    await page.goto("/orders/new");
    await expect(page.getByText("You don't have access to do that.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Place order" })).toHaveCount(0);
  });
});

test.describe("China staff (no orders access)", () => {
  test.use({ storageState: STAFF_STATE });

  test("the orders page goes to the staff home", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL("/home");
  });
});
