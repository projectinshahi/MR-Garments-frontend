import type { Page } from "@playwright/test";

import { cny, expect, field, shortDate, test, today } from "./live-api";
import { downloadButton } from "./report-download";

// Orders tabs (phase 2 §5) against the live API: an order is Pending until its first China receipt (REC-3 moves it to
// stage 2), the All tab keeps it, the Closed tab lists none of these, and every tab offers the Excel/PDF exports. Role
// and label locators only (hidden <Activity> routes stay in the DOM); orders are made per test and found by PO.

test.use({ viewport: { width: 1440, height: 900 } });

const table = (page: Page) => page.getByRole("table");
const rowOf = (page: Page, po: string) => table(page).getByRole("row").filter({ hasText: po });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search PO, item or supplier" });
const tabs = (page: Page) => page.getByRole("navigation", { name: "Orders lists" });
const EMPTY = /No orders match these filters\.|No pending orders\.|No closed orders yet\./;

async function choose(page: Page, current: RegExp, option: string) {
  await page.getByRole("button", { name: current }).click();
  await page.getByRole("menuitemradio", { name: option, exact: true }).click();
}

async function expectExports(page: Page) {
  await expect(downloadButton(page)).toBeVisible();
}

test("a new order is pending until its first China receipt; All keeps it, Closed never lists it, every tab exports", async ({ page, api }) => {
  const unpaid = await api.createOrder({ deliveryDate: today(30) });
  const partly = await api.createOrder({
    supplier: "Shenzhen Apparel",
    lines: [{ item: "Track pants", quantity: 75, rateCny: 30 }],
    deposits: [{ amountCny: 500, rateInr: 12 }],
  });

  await page.goto("/orders/pending");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await expect(tabs(page).getByRole("link", { name: "Pending" })).toHaveAttribute("aria-current", "page");
  await expectExports(page);

  // Pending columns: ordered and pending quantities, value in the order's currency, payment status, stage.
  await search(page).fill(unpaid.po);
  await expect(rowOf(page, unpaid.po).getByRole("cell")).toHaveText([
    unpaid.po,
    "Foshan Fabrics",
    shortDate(today()),
    shortDate(today(30)),
    "100 pcs",
    "100 pcs",
    `${cny(1000)}.00`,
    "Unpaid",
    "1. Order and deposit",
  ]);
  await search(page).fill(partly.po);
  await expect(rowOf(page, partly.po).getByRole("cell")).toHaveText([
    partly.po,
    "Shenzhen Apparel",
    shortDate(today()),
    shortDate(today(30)),
    "75 pcs",
    "75 pcs",
    `${cny(2250)}.00`,
    "Partly paid",
    "1. Order and deposit",
  ]);

  // Order-date range (inclusive) and supplier filters.
  await field(page, "Order date from").fill(today(1));
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  await field(page, "Order date from").fill(today(-1));
  await field(page, "Order date to").fill(today());
  await expect(rowOf(page, partly.po)).toBeVisible();
  await choose(page, /^Supplier: All suppliers$/, "Yiwu Trims Ltd.");
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  await choose(page, /^Supplier: Yiwu Trims Ltd\.$/, "Shenzhen Apparel");
  await expect(rowOf(page, partly.po)).toBeVisible();

  // The first China receipt moves the order to stage 2, so it leaves Pending; the other stays.
  await api.receive(unpaid.po, { "Denim jeans": 40 });
  await page.reload();
  await search(page).fill(unpaid.po);
  await expect(table(page).getByText(EMPTY)).toBeVisible();
  await search(page).fill(partly.po);
  await expect(rowOf(page, partly.po)).toBeVisible();

  // All orders still lists it, at stage 2; its row opens the order.
  await tabs(page).getByRole("link", { name: "All orders" }).click();
  await expect(page).toHaveURL("/orders");
  await expect(tabs(page).getByRole("link", { name: "All orders" })).toHaveAttribute("aria-current", "page");
  await expectExports(page);
  await search(page).fill(unpaid.po);
  await expect(rowOf(page, unpaid.po)).toContainText("2. Receiving in China");

  // Closed lists neither: nothing here reached an India warehouse.
  await tabs(page).getByRole("link", { name: "Closed" }).click();
  await expect(page).toHaveURL("/orders/closed");
  await expect(tabs(page).getByRole("link", { name: "Closed" })).toHaveAttribute("aria-current", "page");
  await expectExports(page);
  for (const { po } of [unpaid, partly]) {
    await search(page).fill(po);
    await expect(table(page).getByText(EMPTY)).toBeVisible();
  }
});
