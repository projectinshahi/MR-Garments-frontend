import { expect, test } from "@playwright/test";

// W2-transport: Transport list (28_10.1) and the Stage 5 form (27_10). Role/label locators only (hidden <Activity>
// routes stay in the DOM). Since wave 3 they run on live data: wave3-a5.spec.ts checks the trip end to end, so this
// file keeps the frame and the not-found page.

test.use({ viewport: { width: 1440, height: 900 } });

test("the transport list opens with its KPI labels", async ({ page }) => {
  await page.goto("/transport");
  await expect(page.getByRole("heading", { level: 1, name: "Transport" })).toBeVisible();
  await expect(page.getByText("freight, loading, unloading", { exact: true })).toBeVisible();
});

test("an unknown container has no transport form", async ({ page }) => {
  // Partial prerendering streams the shell first, so the HTTP status stays 200; assert the not-found UI instead.
  await page.goto("/transport/MEDU-4470912");
  // The (app) not-found page added with the live five tabs.
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Container/ })).toHaveCount(0);
});
