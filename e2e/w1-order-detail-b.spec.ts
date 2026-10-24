import { expect, test, type Page } from "@playwright/test";

// W1-order-detail-b: order-detail tabs f–i for PO-2028 (references 11–14). Role/label locators: visited routes stay
// in the DOM hidden by <Activity>, and role queries skip hidden content.

test.use({ viewport: { width: 1440, height: 900 } });

const tabLink = (page: Page, name: RegExp) => page.getByRole("navigation", { name: "Order sections" }).getByRole("link", { name });
const card = (page: Page, title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });

test("f Clearing & transport: facts, muted costs and totals", async ({ page }) => {
  await page.goto("/orders/PO-2028/clearing-transport");
  await expect(tabLink(page, /Clearing & transport/)).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Container CAIU 2298076")).toBeVisible();

  const clearing = card(page, "Clearing in India");
  await expect(clearing).toContainText("Contact personMr. Anil Kumar · +91 98470 12345");
  await expect(clearing).toContainText("Cleared1 Oct");
  await expect(clearing).toContainText("Port and terminal charges₹14,500");
  await expect(clearing).toContainText("Total clearing cost₹3,70,500");

  const transport = card(page, "Transport to warehouse");
  await expect(transport).toContainText("Loaded (Kochi port yard)1 Oct · Ravi K");
  await expect(transport).toContainText("Unloaded at warehouse3 Oct · 50 of 50 bundles");
  await expect(transport).toContainText("Total transport cost₹26,500");
});

test("g Warehouse: KPIs, teams table with total, and checks", async ({ page }) => {
  await page.goto("/orders/PO-2028/warehouse");
  await expect(page.getByText("Received 3 Oct 2026")).toBeVisible();
  for (const text of ["2,500 pcs", "50 of 50 bundles", "Main warehouse", "Joseph M", "Warehouse team"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(table.getByRole("row", { name: /Retail team/ })).toContainText("40%");
  await expect(table.getByRole("row", { name: /Online team/ })).toContainText("₹2,75,400");
  await expect(table.getByRole("row", { name: /Total/ })).toContainText("₹13,77,000");
  await expect(table.getByRole("row", { name: /Total/ })).toContainText("100%");

  await expect(page.getByText("✓ 50 bundles loaded = 50 bundles received")).toBeVisible();
  await expect(page.getByText("✓ 2,500 of 2,500 pcs given to teams. Nothing left unassigned.")).toBeVisible();
});

test("h Cost: breakdown, where the money goes and per piece", async ({ page }) => {
  await page.goto("/orders/PO-2028/cost");
  await expect(page.getByText("Landed cost ₹13,77,000")).toBeVisible();

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(11);
  await expect(table.getByRole("row", { name: /¥70,000 deposit at 12.00/ })).toContainText("₹336.00");
  await expect(table.getByRole("row", { name: /Sea freight/ })).toContainText("₹0.00");
  await expect(table.getByRole("row", { name: /Landed cost/ })).toContainText("2,500 pcs₹13,77,000₹550.80");

  await expect(page.getByRole("img", { name: "Goods 71%, Duty, taxes and clearing 27%, Transport in India 2%" })).toBeVisible();
  await expect(card(page, "Where the money goes")).toContainText("Duty, taxes and clearing27%₹3,70,500");

  const perPiece = card(page, "Per piece");
  await expect(perPiece).toContainText("₹550.80");
  await expect(perPiece).toContainText("Goods ₹392.00 + duty and clearing ₹148.20 + transport ₹10.60");
  await expect(perPiece.getByText("Management only")).toBeVisible();
});

test("i History: twelve events, newest first", async ({ page }) => {
  await page.goto("/orders/PO-2028/history");
  await expect(page.getByText("Everything that happened, newest first")).toBeVisible();

  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(13);
  await expect(rows.nth(1)).toContainText("3 Oct 2026, 16:10");
  await expect(rows.nth(1)).toContainText("Received in warehouse");
  await expect(rows.nth(10)).toContainText("25 Aug 2026 → 28 Aug 2026 · asked by supplier");
  await expect(rows.nth(12)).toContainText("5 Aug 2026, 10:12");
  await expect(rows.nth(12)).toContainText("Order created");
});

test("tabs f–i link to each other", async ({ page }) => {
  await page.goto("/orders/PO-2028/clearing-transport");
  await tabLink(page, /Warehouse/).click();
  await expect(page).toHaveURL("/orders/PO-2028/warehouse");
  await expect(page.getByRole("heading", { name: "Given to teams" })).toBeVisible();
  await tabLink(page, /Cost/).click();
  await expect(page.getByRole("heading", { name: "Cost breakdown" })).toBeVisible();
  await tabLink(page, /History/).click();
  await expect(page.getByRole("columnheader", { name: "What happened" })).toBeVisible();
});

test("tabs f–i never scroll the page horizontally at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const tab of ["clearing-transport", "warehouse", "cost", "history"]) {
    await page.goto(`/orders/PO-2028/${tab}`);
    await expect(page.getByRole("heading", { level: 1, name: "PO-2028" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), tab).toBeLessThanOrEqual(360);
  }
});
