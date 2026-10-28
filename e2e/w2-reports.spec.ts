import { expect, test, type Page } from "@playwright/test";

// W2-reports: Reports hub (32_13_Reports) and the six reports (33–38). Role/label locators only: visited routes
// stay in the DOM hidden by <Activity>. Since wave 3 the figures, filters and CSV export are live: wave3-a6.spec.ts
// checks them on an order it creates, so this file keeps the frame, the links and the D5 notices.

test.use({ viewport: { width: 1440, height: 900 } });

const toast = (page: Page, action: string) => page.getByText(`${action} is not included in the current prototype.`);
// The PageHeader is the page's banner landmark; its breadcrumb link is the only "Reports" link outside the sidebar.
const breadcrumb = (page: Page) => page.getByRole("banner").getByRole("link", { name: "Reports", exact: true });

const REPORTS = [
  { card: "Order status", href: "/reports/order-status", title: "Order status" },
  { card: "Deliveries due by date", href: "/reports/deliveries-per-day", title: "Deliveries per day" },
  { card: "Ordered against received", href: "/reports/ordered-vs-received", title: "Ordered vs received" },
  { card: "Containers and arrival dates", href: "/reports/containers-timeline", title: "Containers timeline" },
  { card: "Payments and balance due", href: "/reports/payments-per-supplier", title: "Payments per supplier" },
  { card: "Landed cost", href: "/reports/landed-cost-by-month", title: "Landed cost by month" },
];

async function expectReport(page: Page, title: string) {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(breadcrumb(page)).toHaveAttribute("href", "/reports");
}

test("hub shows six report cards, an empty download list and the access note", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByText("Management only", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Period: All dates" })).toBeVisible();

  for (const { card, href } of REPORTS) {
    await expect(page.getByRole("heading", { level: 2, name: card, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `Open report: ${card}` })).toHaveAttribute("href", href);
  }
  // Downloads aren't stored, so the list is always empty.
  await expect(page.getByText("No downloads to show.")).toBeVisible();
  await expect(page.getByText(/^Data-entry staff, the clearing and transport staff included, cannot open this page\./)).toBeVisible();
});

test("hub Excel and PDF exports show the prototype notice (D5)", async ({ page }) => {
  await page.goto("/reports");
  await page.getByRole("button", { name: "Excel export: Order status" }).click();
  await expect(toast(page, "Excel export")).toBeVisible();
  await page.getByRole("button", { name: "PDF export: Landed cost" }).click();
  await expect(toast(page, "PDF export")).toBeVisible();
});

test("every Open report link reaches its report, with the breadcrumb back to the hub", async ({ page }) => {
  for (const { card, title } of REPORTS) {
    await page.goto("/reports");
    await page.getByRole("link", { name: `Open report: ${card}` }).click();
    await expectReport(page, title);
  }
  await breadcrumb(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
});

test("13.1 order status: KPI labels; Excel and PDF exports show the prototype notice (D5)", async ({ page }) => {
  await page.goto("/reports/order-status");
  await expectReport(page, "Order status");
  for (const text of ["Active orders", "across 6 stages", "need follow-up", "reached the warehouse"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Export Excel" }).click();
  await expect(toast(page, "Export Excel")).toBeVisible();
  await page.getByRole("button", { name: "Export PDF" }).click();
  await expect(toast(page, "Export PDF")).toBeVisible();
});
