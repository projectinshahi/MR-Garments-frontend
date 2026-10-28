import { expect, test } from "@playwright/test";

// W2-warehouse: Warehouse list (30_11.1) and Receive goods (29_11). Role/label locators only (hidden <Activity>
// routes). Since wave 3 they run on live data and Receive goods is per trip (/warehouse/receive/<trip id>):
// wave3-a5.spec.ts receives a trip into stock and checks the figures, so this file keeps the frame and the not-found page.

test.use({ viewport: { width: 1440, height: 900 } });

test("the warehouse list opens with its stock heading", async ({ page }) => {
  await page.goto("/warehouse");
  await expect(page.getByRole("heading", { level: 1, name: "Warehouse" })).toBeVisible();
  await expect(page.getByText("Received in stock", { exact: true }).first()).toBeVisible();
});

test("an unknown trip has no Receive goods form", async ({ page }) => {
  // Partial prerendering streams the shell first, so the HTTP status stays 200; assert the not-found UI instead.
  await page.goto("/warehouse/receive/not-a-trip");
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Receive goods" })).toHaveCount(0);
});
