import { expect, test, type Page } from "@playwright/test";

// W2-reports: Reports hub (32_13_Reports) and the six reports (33–38). Role/label locators only: visited routes
// stay in the DOM hidden by <Activity>.

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

test("hub shows six report cards, recent downloads and the access note", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByText("Management only", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Period: 1 Sep – 30 Sep 2026" })).toBeVisible();

  for (const { card, href } of REPORTS) {
    await expect(page.getByRole("heading", { level: 2, name: card, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `Open report: ${card}` })).toHaveAttribute("href", href);
  }
  await expect(page.getByText("50 orders · 14 waiting at stage 1")).toBeVisible();
  await expect(page.getByText("₹42,60,000 due in next 30 days")).toBeVisible();

  const recent = page.getByRole("table");
  await expect(recent.getByRole("row")).toHaveCount(4);
  await expect(recent.getByRole("row", { name: /Landed cost/ })).toContainText("1 Sep – 30 SepExcelManagement29 Sep, 5:40 pm");
  await expect(recent.getByRole("row", { name: /Payments and balance due/ })).toContainText("PDF");
  await expect(page.getByText(/^Data-entry staff, the clearing and transport staff included, cannot open this page\./)).toBeVisible();
});

test("hub exports and the supplier filter show the prototype notice (D5)", async ({ page }) => {
  await page.goto("/reports");
  await page.getByRole("button", { name: "Excel export: Order status" }).click();
  await expect(toast(page, "Excel export")).toBeVisible();
  await page.getByRole("button", { name: "PDF export: Landed cost" }).click();
  await expect(toast(page, "PDF export")).toBeVisible();

  await page.getByRole("button", { name: "Supplier: All suppliers" }).click();
  await page.getByRole("menuitemradio", { name: "Foshan Fabrics" }).click();
  await expect(toast(page, "Filter by supplier")).toBeVisible();
  await expect(page.getByRole("button", { name: "Supplier: All suppliers" })).toBeVisible();
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

test("13.1 order status: KPIs, orders by stage and late orders", async ({ page }) => {
  await page.goto("/reports/order-status");
  await expectReport(page, "Order status");
  for (const text of ["Active orders", "across 6 stages", "need follow-up", "reached the warehouse", "38 days"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  const stages = page.getByRole("meter");
  await expect(stages).toHaveCount(6);
  await expect(page.getByRole("meter", { name: "1. Order and deposit" })).toHaveAttribute("aria-valuenow", "14");
  await expect(page.getByRole("meter", { name: "6. India warehouse" })).toHaveAttribute("aria-valuenow", "7");

  const late = page.getByRole("table");
  await expect(late.getByRole("row")).toHaveCount(4);
  await expect(late.getByRole("row", { name: /PO-2041/ })).toContainText("Guangzhou Textile Co.26 Sep4 days");
  await expect(late.getByRole("row", { name: /PO-2044/ })).toContainText("1 day");

  await page.getByRole("button", { name: "Export Excel" }).click();
  await expect(toast(page, "Export Excel")).toBeVisible();
  await page.getByRole("button", { name: "Export PDF" }).click();
  await expect(toast(page, "Export PDF")).toBeVisible();
});

test("13.2 deliveries per day: KPIs, the 14-day chart and the footnote", async ({ page }) => {
  await page.goto("/reports/deliveries-per-day");
  await expectReport(page, "Deliveries per day");
  for (const text of ["Thu 1 · Sat 3", "2 deliveries each", "1 Oct to 14 Oct", "from 5 suppliers"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  const chart = page.getByRole("figure", { name: "Deliveries due per day, next 14 days" });
  for (const day of ["Thu 1", "Sun 4", "Mon 12", "Wed 14"]) {
    await expect(chart.getByText(day, { exact: true })).toBeVisible();
  }
  const footnote = page.getByText("Late deliveries (3) are not in this chart. See the Delivery Calendar.");
  await expect(footnote).toBeVisible();
  await expect(footnote.getByRole("link")).toHaveCount(0);
});

test("13.3 ordered vs received: shortages and payment effect", async ({ page }) => {
  await page.goto("/reports/ordered-vs-received");
  await expectReport(page, "Ordered vs received");
  for (const text of ["PO-2035 · PO-2027", "¥2,940", "no shortage"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(9);
  await expect(table.getByRole("row", { name: /PO-2035/ })).toContainText("1,200 pcs1,160 pcs40 pcs¥2,400Reduced");
  await expect(table.getByRole("row", { name: /PO-2027/ })).toContainText("1,200 m1,188 m12 m¥540Reduced");
  await expect(table.getByRole("row", { name: /PO-2029/ })).toContainText("4,000 pcs4,000 pcs0–Full");
});

test("13.4 containers timeline: bars placed on the date axis and the today line", async ({ page }) => {
  await page.goto("/reports/containers-timeline");
  await expectReport(page, "Containers timeline");
  for (const text of ["Active containers", "2 Oct · 4 Oct", "19 days", "MSKU 4471203"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  const bars = page.getByRole("img", { name: /: loaded / });
  await expect(bars).toHaveCount(6);
  const arrived = page.getByRole("img", { name: "CAIU 2298076: loaded 9 Sep, Arrived 28 Sep" });
  await expect(arrived).toHaveAttribute("style", "left:8%;width:38%");
  await expect(page.getByRole("img", { name: "FCIU 5527310: loaded 26 Sep, Est. 24 Oct · loading" })).toHaveAttribute(
    "style",
    "left:42%;width:56%",
  );
  const legend = page.getByRole("list", { name: "Legend" });
  await expect(legend.getByRole("listitem")).toHaveText(["On the sea", "Loading, estimated", "Arrived", "Today, 30 Sep"]);
});

test("13.5 payments per supplier: rows, totals row and the plain-text footnote", async ({ page }) => {
  await page.goto("/reports/payments-per-supplier");
  await expectReport(page, "Payments per supplier");
  // KPI tiles (the totals row repeats the order value; it is checked below).
  for (const text of ["¥4,91,000", "₹25,15,000 at payment-day rates", "next 30 days est. ₹42,60,000"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /Guangzhou Textile Co\./ })).toContainText("PO-2047, PO-2041¥1,60,000¥70,000₹13,10,000¥90,000");
  await expect(table.getByRole("row", { name: /^Total/ })).toContainText("5 open orders¥4,91,000¥1,71,000₹25,15,000¥3,20,000");
  const footnote = page.getByText("Open orders only. Finished orders (PO-2028, PO-2035) are in the Paid payments page.");
  await expect(footnote).toBeVisible();
  await expect(footnote.getByRole("link")).toHaveCount(0);
});

test("13.6 landed cost by month: KPIs, chart and the by-month table", async ({ page }) => {
  await page.goto("/reports/landed-cost-by-month");
  await expectReport(page, "Landed cost by month");
  for (const text of ["₹42,21,560", "15,800 pcs", "September", "₹267.19"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  const chart = page.getByRole("figure", { name: "Landed cost by month" });
  for (const text of ["Aug 2026", "₹28,44,560", "₹13,77,000", "₹0"]) {
    await expect(chart.getByText(text, { exact: true })).toBeVisible();
  }
  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /Aug 2026/ })).toContainText("0––");
  await expect(table.getByRole("row", { name: /Sep 2026/ })).toContainText("13,300₹28,44,560₹213.87");
  await expect(table.getByRole("row", { name: /Oct 2026 \(so far\)/ })).toContainText("2,500₹13,77,000₹550.80");
  await expect(table.getByRole("row", { name: /^Total/ })).toContainText("15,800₹42,21,560₹267.19");
  await expect(page.getByText("Month = the month the goods were received in the India warehouse.")).toBeVisible();
});
