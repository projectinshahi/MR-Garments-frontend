import { expect, test } from "@playwright/test";

// W2-landed-cost: Landed Cost (31_12_Landed_Cost.jpeg). Role/label locators only (hidden <Activity> routes). Since
// wave 3 the figures are live: wave3-a6.spec.ts checks them, the views and the filters on an order it creates.

test.use({ viewport: { width: 1440, height: 900 } });

test("landed cost shows its heading and the Management-only label", async ({ page }) => {
  await page.goto("/landed-cost");
  await expect(page.getByRole("heading", { level: 1, name: "Landed Cost" })).toBeVisible();
  await expect(page.getByText("Management only", { exact: true })).toBeVisible();
});

test("never scrolls the page horizontally at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/landed-cost");
  await expect(page.getByRole("heading", { level: 1, name: "Landed Cost" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
