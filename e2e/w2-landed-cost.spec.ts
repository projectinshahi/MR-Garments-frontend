import { expect, test } from "@playwright/test";

// W2-landed-cost: Landed Cost (31_12_Landed_Cost.jpeg). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("landed cost shows the KPIs, orders table and PO-2028's breakdown from the reference", async ({ page }) => {
  await page.goto("/landed-cost");
  await expect(page.getByRole("heading", { level: 1, name: "Landed Cost" })).toBeVisible();
  await expect(page.getByText("Management only", { exact: true })).toBeVisible();

  for (const text of ["₹20,86,000", "2 orders, all costs entered", "5,500 pcs", "PO-2028 and PO-2019", "1 order", "PO-2024, waiting for duty"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  const orders = page.getByRole("table").first();
  await expect(orders.getByRole("row")).toHaveCount(4);
  const po2028 = orders.getByRole("row", { name: /PO-2028/ });
  await expect(po2028).toHaveAttribute("data-selected", "true");
  await expect(po2028).toContainText("In price (CNF)");
  await expect(po2028).toContainText("₹13,77,000");
  await expect(po2028).toContainText("₹550.80");
  await expect(po2028).toContainText("Final");
  await expect(orders.getByRole("row", { name: /PO-2019/ })).toContainText("₹236.33");
  const po2024 = orders.getByRole("row", { name: /PO-2024/ });
  await expect(po2024).toContainText("Waiting");
  await expect(po2024).toContainText("₹8,30,000 so far");
  await expect(po2024).toContainText("₹922.22 so far");
  await expect(po2024).toContainText("Estimate");

  await expect(page.getByRole("heading", { level: 2, name: "PO-2028 · Denim jeans: where the ₹13,77,000 goes" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Goods 71%/ })).toBeVisible();
  for (const text of ["71.2%", "26.9%", "1.9%", "Sea freight and short-receipt deduction"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  const goods = page.getByRole("table").nth(1);
  await expect(goods.getByRole("row", { name: /Deposit/ })).toContainText("₹8,40,000");
  await expect(goods.getByRole("row", { name: /Balance/ })).toContainText("26 Aug");
  await expect(goods.getByRole("row", { name: /Total/ })).toContainText("12.25 avg");
  await expect(goods.getByRole("row", { name: /Total/ })).toContainText("₹9,80,000");
});

test("never scrolls the page horizontally at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/landed-cost");
  await expect(page.getByRole("heading", { level: 1, name: "Landed Cost" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("undesigned views, rows and filters show the prototype notice and keep the selection (D5)", async ({ page }) => {
  await page.goto("/landed-cost");
  const views = page.getByRole("group", { name: "Group landed cost" });

  await views.getByRole("button", { name: "By team" }).click();
  await expect(page.getByText("Landed cost by team is not included in the current prototype.")).toBeVisible();
  await expect(views.getByRole("button", { name: "By order" })).toHaveAttribute("aria-pressed", "true");

  const orders = page.getByRole("table").first();
  await orders.getByRole("button", { name: "PO-2019" }).press("Enter");
  await expect(page.getByText("Cost breakdown for PO-2019 is not included in the current prototype.")).toBeVisible();
  await expect(orders.getByRole("row", { name: /PO-2028/ })).toHaveAttribute("data-selected", "true");

  await page.getByRole("button", { name: "Supplier: All suppliers" }).click();
  await page.getByRole("menuitemradio").nth(1).click();
  await expect(page.getByText("Filter by supplier is not included in the current prototype.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Supplier: All suppliers" })).toBeVisible();
});
