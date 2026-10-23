import { expect, test } from "@playwright/test";

// Orchestrator-owned checks for the shared shell (Phase 2). Role/label locators: with cacheComponents,
// previously visited routes stay in the DOM hidden by <Activity>, and role queries skip hidden content.

test.use({ viewport: { width: 1440, height: 900 } });

test("management shell: header, active nav, ADMIN always visible (D6)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Users" })).toBeVisible();
});

test("order detail frame: breadcrumb, tabs, prototype toast (D5)", async ({ page }) => {
  await page.goto("/orders/PO-2028/cost");
  await expect(page.getByRole("heading", { level: 1, name: "PO-2028" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Order sections" }).getByRole("link", { name: /Cost/ })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Print order" }).click();
  await expect(page.getByText("Print order is not included in the current prototype.")).toBeVisible();
});

test("unknown PO has no detail page", async ({ page }) => {
  // Partial prerendering streams the shell first, so the HTTP status stays 200; assert the not-found UI instead.
  await page.goto("/orders/PO-9999");
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "PO-9999" })).toHaveCount(0);
});

test("user menu opens profile, notifications and sign out (B3)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Management/ }).click();
  await expect(page.getByRole("menuitem", { name: "My profile" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Notifications" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
});

test("staff sidebar shows only Home and the staff member's stage", async ({ page }) => {
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Home", "Receiving (China)"]);
});

test("auth layout renders the product panel", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Import Tracking System")).toBeVisible();
  await expect(page.getByText("India warehouse and landed cost")).toBeVisible();
});
