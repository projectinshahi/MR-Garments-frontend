import type { DeliveryItem, OrderListItem } from "../src/lib/api/types";
import { ANITA, expect, freshSignIn, kpi, longDate, test, today } from "./live-api";

// W1-dashboard: dashboard (04_2_Dashboard.jpeg) from the live API: ORD-1, CAL-1, PAY-1, CON-1. Role/label locators
// only (hidden <Activity> routes). Other specs share the test database, so expected figures are read from the API.

test.use({ viewport: { width: 1440, height: 900 } });

const kpiValue = (page: Parameters<typeof kpi>[0], label: string) => kpi(page, label).locator("p").nth(1);

test("the dashboard shows live figures, and a new order moves them", async ({ page, api }) => {
  const figures = async () => {
    const [orders, deliveries] = await Promise.all([api.get<OrderListItem[]>("/orders"), api.get<DeliveryItem[]>("/deliveries")]);
    return {
      active: orders.filter((o) => o.stage < 6).length,
      stage1: orders.filter((o) => o.stage === 1).length,
      late: deliveries.filter((d) => d.due < today()).length,
    };
  };
  const stage1 = page.getByRole("meter", { name: "1. Order and deposit" });

  let expected = await figures();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(`Today, ${longDate(today())}`)).toBeVisible();
  await expect(page.getByText("Sample Data — Not Live")).toHaveCount(0);
  await expect(kpiValue(page, "Active orders")).toHaveText(String(expected.active));
  await expect(stage1).toHaveAttribute("aria-valuenow", String(expected.stage1));
  await expect(kpiValue(page, "Late deliveries")).toHaveText(String(expected.late));
  await expect(kpiValue(page, "Payments due (CNY)")).toHaveText(/^¥/);

  // A year-late order: one more active order at stage 1, one more late delivery, and it heads the deliveries list
  // (oldest due date first; other specs' late orders are days late).
  const order = await api.createOrder({ orderDate: today(-400), deliveryDate: today(-365) });
  expected = await figures();
  await page.reload();
  await expect(kpiValue(page, "Active orders")).toHaveText(String(expected.active));
  await expect(stage1).toHaveAttribute("aria-valuenow", String(expected.stage1));
  await expect(kpiValue(page, "Late deliveries")).toHaveText(String(expected.late));
  const deliveries = page.getByRole("table").first();
  await expect(deliveries.getByRole("row", { name: new RegExp(order.po) })).toContainText("Late 365 days");
});

test.describe("Accounts (no calendar or containers access)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("sees orders and payments; the deliveries and containers cards say they're not in their access", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(kpiValue(page, "Active orders")).toHaveText(/^\d+$/);
    await expect(kpiValue(page, "Payments due (CNY)")).toHaveText(/^¥/);
    for (const label of ["Due in next 7 days", "Late deliveries", "Containers on the way"]) {
      await expect(kpiValue(page, label)).toHaveText("–");
    }
    await expect(page.getByText("Not included in your access.").filter({ visible: true })).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Open calendar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "All containers" })).toHaveCount(0);
  });
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
