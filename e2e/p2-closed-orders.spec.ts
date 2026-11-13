import type { Page } from "@playwright/test";

import { closedOrder, expect, test } from "./live-api";
import { downloadButton } from "./report-download";
import { MANAGEMENT_STATE, PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Closed Orders (sidebar, right after the Stages group): only the orders whose goods are all stocked in India (phase 2
// §5 `closed`), on their own page with the Closed list's filters, pager and exports, for anyone who may view orders.
// Role and label locators only; the orders are made inside the test through the API.

test.use({ viewport: { width: 1440, height: 900 } });

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const rowOf = (page: Page, po: string) => page.getByRole("table").getByRole("row").filter({ hasText: po });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search PO, item or supplier" });

test("Closed Orders sits after Warehouse and opens a page that lists closed orders only, with exports and no Orders tabs", async ({ page, api, browser }, testInfo) => {
  test.setTimeout(150_000);
  const pending = await api.createOrder();
  const closed = await closedOrder(api);

  await page.goto("/");
  const links = (await nav(page).getByRole("link").allInnerTexts()).map((text) => text.trim());
  expect(links.indexOf("Closed Orders")).toBe(links.indexOf("Warehouse") + 1);
  await nav(page).getByRole("link", { name: "Closed Orders", exact: true }).click();
  await expect(page).toHaveURL("/closed-orders");
  await expect(page.getByRole("heading", { level: 1, name: "Closed Orders" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Orders lists" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "+ New order" })).toHaveCount(0);
  await expect(downloadButton(page)).toBeVisible();

  // The closed order is listed with its stocked pieces and Report link; the pending one never is.
  await expect(async () => {
    await search(page).fill(closed.po);
    await expect(rowOf(page, closed.po)).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(rowOf(page, closed.po)).toContainText("100 pcs");
  await expect(rowOf(page, closed.po).getByRole("link", { name: `Report ${closed.po}` })).toHaveAttribute("href", `/orders/${closed.po}/report`);
  await search(page).fill(pending.po);
  await expect(page.getByText("No orders match these filters.")).toBeVisible();
  await search(page).fill("");
  await expect(rowOf(page, closed.po)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("closed-orders-1440.png"), fullPage: true });

  // The row opens the order.
  await rowOf(page, closed.po).getByRole("link", { name: closed.po, exact: true }).click();
  await expect(page).toHaveURL(`/orders/${closed.po}`);

  // Phone width: no page-level horizontal scroll.
  const phone = await browser.newContext({ storageState: MANAGEMENT_STATE, viewport: { width: 390, height: 844 } });
  const small = await phone.newPage();
  await small.goto("/closed-orders");
  await expect(small.getByRole("heading", { level: 1, name: "Closed Orders" })).toBeVisible();
  expect(await small.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await small.screenshot({ path: testInfo.outputPath("closed-orders-390.png"), fullPage: true });
  await phone.close();

  // Procurement (orders View) has the entry and the page; China staff have neither and are sent to their landing page.
  const procurement = await browser.newContext({ storageState: PROCUREMENT_STATE, viewport: { width: 1440, height: 900 } });
  const priya = await procurement.newPage();
  await priya.goto("/closed-orders");
  await expect(priya.getByRole("heading", { level: 1, name: "Closed Orders" })).toBeVisible();
  await expect(nav(priya).getByRole("link", { name: "Closed Orders", exact: true })).toBeVisible();
  await procurement.close();
  const staff = await browser.newContext({ storageState: STAFF_STATE, viewport: { width: 1440, height: 900 } });
  const chen = await staff.newPage();
  await chen.goto("/closed-orders");
  await expect(chen).toHaveURL("/home");
  await expect(nav(chen).getByRole("link", { name: "Closed Orders", exact: true })).toHaveCount(0);
  await staff.close();
});
