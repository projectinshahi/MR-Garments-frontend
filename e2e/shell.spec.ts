import { expect, test } from "@playwright/test";

import { SIGNED_OUT, STAFF_STATE } from "./sessions";

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
  // B2: the signed-in user's name, then the access label (no office for Head office users).
  await page.getByRole("button", { name: /Suresh Menon/ }).click();
  await expect(page.getByRole("menuitem", { name: "My profile" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Notifications" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
});

test.describe("staff session", () => {
  test.use({ storageState: STAFF_STATE });

  test("staff sidebar shows only Home and the staff member's stage (N-b)", async ({ page }) => {
    await page.goto("/home");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(["Home", "Receiving (China)"]);
  });

  test("a page the role can't open goes to the landing page (P-b)", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/home");
  });
});

test("shared Journey route markers and BarChart day labels render (preview)", async ({ page }) => {
  await page.goto("/preview");
  // Journey dot markers used to render 0 × 0 inside their plain wrapper.
  const route = page.getByRole("list").filter({ hasText: "Guangzhou (Nansha)" });
  const dot = route.locator("span.size-3\\.5").first();
  await expect(dot).toBeVisible();
  const box = await dot.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(13);
  expect(box?.height).toBeGreaterThanOrEqual(13);
  // Every category label is drawn; none is dropped to avoid a collision.
  const chart = page.getByRole("figure", { name: "Deliveries due per day, next 7 days" });
  for (const day of ["Thu 1", "Fri 2", "Sat 3", "Sun 4", "Mon 5", "Tue 6", "Wed 7"]) {
    await expect(chart.getByText(day, { exact: true })).toBeVisible();
  }
});

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("auth layout renders the product panel", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Import Tracking System")).toBeVisible();
    await expect(page.getByText("India warehouse and landed cost")).toBeVisible();
  });

  test("an app page sends a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL("/login");
  });
});
