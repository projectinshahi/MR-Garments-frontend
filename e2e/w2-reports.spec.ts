import { readFile } from "node:fs/promises";

import { expect, type Locator, type Page, type Route, test, type TestInfo } from "@playwright/test";

// W2-reports: Reports hub (32_13_Reports) and the six reports (33–38). Role/label locators only: visited routes
// stay in the DOM hidden by <Activity>. Since wave 3 the figures, filters and exports are live: wave3-a6.spec.ts
// checks them on an order it creates, so this file keeps the frame, the links and that every export downloads.

test.use({ viewport: { width: 1440, height: 900 } });

const toast = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
/** Clicks `button` and returns the download's file name and its bytes as text (one character per byte). */
async function download(page: Page, button: Locator) {
  const [file] = await Promise.all([page.waitForEvent("download"), button.click()]);
  return { name: file.suggestedFilename(), text: (await readFile(await file.path())).toString("latin1") };
}
// The PageHeader is the page's banner landmark; its breadcrumb link is the only "Reports" link outside the sidebar.
const breadcrumb = (page: Page) => page.getByRole("banner").getByRole("link", { name: "Reports", exact: true });

const REPORTS = [
  { card: "Deliveries due by date", href: "/reports/deliveries-per-day", title: "Deliveries per day" },
  { card: "Ordered against received", href: "/reports/ordered-vs-received", title: "Ordered vs received" },
  { card: "Containers and arrival dates", href: "/reports/containers-timeline", title: "Containers timeline" },
  { card: "Payments and balance due", href: "/reports/payments-per-supplier", title: "Payments per supplier" },
  { card: "Landed cost", href: "/reports/landed-cost-by-month", title: "Landed cost by month" },
];
// The first card is the Order Report: it opens the Order reports list (/reports/orders; p2-order-report.spec.ts covers
// its downloads). It took the Order status card's slot; that report's page stays at its URL.
const CARDS = [{ card: "Order Report", href: "/reports/orders", title: "Order reports" }, ...REPORTS];
const ORDER_STATUS = { href: "/reports/order-status", title: "Order status" };
/** Screenshots go to SHOTS_DIR when set, else the test's output folder. */
const shot = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));

async function expectReport(page: Page, title: string) {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(breadcrumb(page)).toHaveAttribute("href", "/reports");
}

test("hub shows six report cards, an empty download list and the access note", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByText("Management only", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Period: All dates" })).toBeVisible();

  for (const { card, href } of CARDS) {
    await expect(page.getByRole("heading", { level: 2, name: card, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `Open report: ${card}` })).toHaveAttribute("href", href);
  }
  // Downloads aren't stored, so the list is always empty.
  await expect(page.getByText("No downloads to show.")).toBeVisible();
  await expect(page.getByText(/^Data-entry staff, the clearing and transport staff included, cannot open this page\./)).toBeVisible();
});

test("hub Excel and PDF buttons download their report as .xlsx and .pdf", async ({ page }) => {
  await page.goto("/reports");
  const excel = await download(page, page.getByRole("button", { name: "Excel export: Deliveries due by date" }));
  expect(excel.name).toMatch(/^deliveries-per-day-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(excel.text.startsWith("PK")).toBe(true);
  expect(excel.text).toContain('<sheet name="Deliveries per day"');
  const pdf = await download(page, page.getByRole("button", { name: "PDF export: Landed cost" }));
  expect(pdf.name).toMatch(/^landed-cost-by-month-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(pdf.text.startsWith("%PDF-")).toBe(true);
  expect(pdf.text).toContain("(Landed cost by month) Tj");
});

test("a hub export that fails shows a toast; one whose session ended goes to sign-in", async ({ page }) => {
  await page.goto("/reports");
  const reply = (status: number) => (route: Route) =>
    route.fulfill({ status, json: { error: { code: status === 401 ? "unauthorized" : "internal", message: "Something went wrong." } } });
  await page.route("**/api/v1/reports/deliveries-per-day*", reply(500));
  await page.getByRole("button", { name: "Excel export: Deliveries due by date" }).click();
  await expect(toast(page, "Something went wrong.").first()).toBeVisible();
  await page.unroute("**/api/v1/reports/deliveries-per-day*");
  await page.route("**/api/v1/reports/deliveries-per-day*", reply(401));
  const redirect = page.waitForRequest((request) => request.url().includes("/login?reason=session-ended"));
  await page.getByRole("button", { name: "PDF export: Deliveries due by date" }).click();
  await redirect;
});

test("every report's header downloads CSV, Excel and PDF files named after the report", async ({ page }) => {
  test.setTimeout(120_000);
  for (const { href, title } of [...REPORTS, ORDER_STATUS]) {
    await page.goto(href);
    await expectReport(page, title);
    const slug = href.slice("/reports/".length);
    for (const [label, ext] of [["Export CSV", "csv"], ["Export Excel", "xlsx"], ["Export PDF", "pdf"]] as const) {
      const file = await download(page, page.getByRole("button", { name: label }));
      expect(file.name).toMatch(new RegExp(`^${slug}-\\d{4}-\\d{2}-\\d{2}\\.${ext}$`));
      if (ext !== "csv") expect(file.text).toContain(title);
    }
  }
});

test("every Open report link reaches its report, with the breadcrumb back to the hub", async ({ page }) => {
  for (const { card, title } of CARDS) {
    await page.goto("/reports");
    await page.getByRole("link", { name: `Open report: ${card}` }).click();
    await expectReport(page, title);
  }
  await breadcrumb(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
});

test("the Order Report card opens /reports/orders from anywhere on it, at 1440 and 390 px", async ({ page }, testInfo) => {
  // The report cards are the list items with an Open report link (the sidebar's items have none).
  const cards = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^Open report: / }) });
  const card = cards.filter({ has: page.getByRole("heading", { level: 2, name: "Order Report", exact: true }) });
  const description = "View comprehensive purchase order reports, supplier details, item-wise breakdowns, payments, shipping, customs and landed costs.";
  await page.goto("/reports");
  await expect(card.getByText(description, { exact: true })).toBeVisible();
  // The first card of the grid, where Order status was.
  await expect(cards).toHaveCount(6);
  await expect(cards.first().getByRole("heading", { level: 2 })).toHaveText("Order Report");
  await expect(page.getByRole("heading", { level: 2, name: "Order status" })).toHaveCount(0);
  await page.screenshot({ path: shot(testInfo, "reports-hub-1440.png"), fullPage: true });
  // The card's centre is its description, not a link or a button.
  await card.click();
  await expect(page).toHaveURL(/\/reports\/orders$/);
  await expectReport(page, "Order reports");
  await page.goBack();
  // Its corner, next to the category label, too.
  await card.click({ position: { x: 16, y: 10 } });
  await expect(page).toHaveURL(/\/reports\/orders$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/reports");
  await expect(card.getByText(description, { exact: true })).toBeVisible();
  await page.screenshot({ path: shot(testInfo, "reports-hub-390.png"), fullPage: true });
  await card.click();
  await expect(page).toHaveURL(/\/reports\/orders$/);
  await expectReport(page, "Order reports");
});

test("13.1 order status: KPI labels", async ({ page }) => {
  await page.goto("/reports/order-status");
  await expectReport(page, "Order status");
  for (const text of ["Active orders", "across 6 stages", "need follow-up", "reached the warehouse"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
});
