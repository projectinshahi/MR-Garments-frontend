import { expect, test } from "@playwright/test";

// W1-dashboard: management dashboard (04_2_Dashboard.jpeg). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("dashboard shows the KPIs, stages, deliveries, payments and containers from the reference", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Today, 30 Sep 2026")).toBeVisible();

  for (const text of ["Active orders", "across 6 stages", "need follow-up", "2 arriving this week", "₹42.6 L"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole("meter", { name: "1. Order and deposit" })).toHaveAttribute("aria-valuenow", "14");
  await expect(page.getByRole("meter", { name: "6. India warehouse" })).toHaveAttribute("aria-valuenow", "7");

  // Tables in reading order: deliveries, payments due, containers on the way.
  const [deliveries, payments, containers] = [0, 1, 2].map((i) => page.getByRole("table").nth(i));
  await expect(deliveries.getByRole("row")).toHaveCount(6);
  await expect(deliveries.getByRole("row", { name: /PO-2041/ })).toContainText("Late 4 days");
  await expect(deliveries.getByRole("row", { name: /PO-2049/ })).toContainText("On track");

  await expect(payments.getByRole("row", { name: /Guangzhou Textile Co\./ })).toContainText("₹15,00,000");
  await expect(payments.getByRole("row", { name: /Yiwu Trims Ltd\./ })).toContainText("22 Oct");

  await expect(containers.getByRole("row", { name: /OOLU 6094412/ })).toContainText("Dragon Cargo");
  await expect(containers.getByRole("row", { name: /OOLU 6094412/ })).toContainText("18 Oct");
});

test("card links lead to the list screens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "View all orders" })).toHaveAttribute("href", "/orders");
  await expect(page.getByRole("link", { name: "Open calendar" })).toHaveAttribute("href", "/calendar");
  await expect(page.getByRole("link", { name: "All payments" })).toHaveAttribute("href", "/payments");
  await expect(page.getByRole("link", { name: "All containers" })).toHaveAttribute("href", "/containers");
});

test("header search is not in the prototype (D5)", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search PO, supplier, container" });
  await search.fill("PO-2041");
  await search.press("Enter");
  await expect(page.getByText("Search is not included in the current prototype.")).toBeVisible();
  await expect(page).toHaveURL("/");
});
