import { expect, test } from "@playwright/test";

// W2-clearing: Clearing (India) list (26_9.1) and the Stage 4 form (25_9). Role/label locators only (hidden <Activity>
// routes). Since wave 3 they run on live data: wave3-a5.spec.ts takes a container through clearing, transport and the
// warehouse and checks the figures, so this file keeps the frame and the not-found page.

test.use({ viewport: { width: 1440, height: 900 } });

test("the clearing list opens with its KPI labels", async ({ page }) => {
  await page.goto("/clearing");
  await expect(page.getByRole("heading", { level: 1, name: "Clearing (India)" })).toBeVisible();
  await expect(page.getByText("port to cleared", { exact: true })).toBeVisible();
});

test("an unknown container shows the not-found page", async ({ page }) => {
  // Partial prerendering streams the shell first, so the HTTP status stays 200; assert the not-found UI instead.
  await page.goto("/clearing/MEDU-4470912");
  // The (app) not-found page added with the live five tabs.
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Container MEDU 4470912" })).toHaveCount(0);
});
