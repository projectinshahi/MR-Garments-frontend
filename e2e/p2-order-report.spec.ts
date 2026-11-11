import { readFile } from "node:fs/promises";

import type { Locator, Page, TestInfo } from "@playwright/test";

import { closedOrder, expect, kpi, kv, test } from "./live-api";

// Phase 2, scenario 8 (backend docs/phase2-contracts.md section 4): an order's Report tab (RPT-O1) with its Excel and
// PDF, and the Order reports page (RPT-O2) filtered by PO with its downloads. Orders are created through the API, so
// the shared test database's other rows don't matter. Role/label locators only: hidden <Activity> routes stay mounted.

test.use({ viewport: { width: 1440, height: 900 } });

/** Clicks `button` and returns the download's file name and its bytes as text (one character per byte). */
async function download(page: Page, button: Locator) {
  const [file] = await Promise.all([page.waitForEvent("download"), button.click()]);
  return { name: file.suggestedFilename(), text: (await readFile(await file.path())).toString("latin1") };
}
/** A PDF's text with adjacent text runs joined, so a value the table wrapped mid-word ("PO-" then "2034") reads whole. */
const glue = (pdf: string) => pdf.replace(/\) Tj ET\nBT \/F\d [\d.]+ Tf [\d.]+ [\d.]+ Td \(/g, "");
const SHEETS = ["Order Overview", "Supplier Details", "Order Items", "China Receiving", "Shipping", "Customs", "Warehouse", "Payment History", "Deposit History", "Landed Cost", "Order Timeline"];
/** Full-page or element screenshots go to SHOTS_DIR when set (the report's folder), else the test's output folder. */
const shotPath = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));

test("an order's Report tab shows its items, payments and timeline, and downloads the report as Excel and PDF", async ({ page, api }) => {
  // 100 Denim jeans at ¥10 and 50 m Cotton fabric at ¥8 (¥1,400), ¥300 deposit; 120 pcs received (excess 20), 30 m (short 20).
  const order = await api.createOrder({
    supplier: "Guangzhou Textile Co.",
    lines: [
      { item: "Denim jeans", quantity: 100, rateCny: 10 },
      { item: "Cotton fabric", quantity: 50, rateCny: 8 },
    ],
    deposits: [{ amountCny: 300, rateInr: 12 }],
  });
  await api.receive(order.po, { "Denim jeans": 120, "Cotton fabric": 30 });

  await page.goto(`/orders/${order.po}`);
  await page.getByRole("navigation", { name: "Order sections" }).getByRole("link", { name: "Report", exact: true }).click();
  await expect(page).toHaveURL(`/orders/${order.po}/report`);
  await expect(page.getByRole("navigation", { name: "Report sections" }).getByRole("link")).toHaveCount(12);
  await expect(page.getByRole("heading", { level: 2, name: "Items" })).toBeVisible();
  const items = page.locator("#items").filter({ visible: true });
  const itemRow = (text: string) => items.getByRole("row").filter({ hasText: text });
  await expect(itemRow("Denim jeans")).toContainText("120");
  await expect(itemRow("Denim jeans").getByText("20", { exact: true })).toBeVisible(); // excess
  await expect(itemRow("Cotton fabric").getByText("20", { exact: true })).toBeVisible(); // pending
  await expect(page.getByRole("heading", { level: 2, name: "Payments" })).toBeVisible();
  await expect(kpi(page, "Total paid to supplier")).toContainText("¥300");
  await expect(kpi(page, "Outstanding balance").first()).toContainText("¥1,100");
  await expect(page.locator("#payments").filter({ visible: true }).getByRole("row").filter({ hasText: "Advance / deposit" })).toContainText("₹3,600");
  await expect(kv(page, "Supplier code")).toHaveText(/^SUP-\d{3,}$/);
  await expect(kv(page, "Deposit utilised for this PO")).toContainText("Not tracked");
  await expect(page.getByRole("heading", { level: 2, name: "Timeline" })).toBeVisible();
  for (const step of ["Order placed", "Deposit paid", "Received in China"]) {
    await expect(page.locator("#timeline").filter({ visible: true }).getByText(new RegExp(`^${step} · `))).toBeVisible();
  }
  await expect(kv(page, "Stage")).toHaveText("2. Receiving in China");
  await expect(page.getByRole("heading", { level: 2, name: "Documents" })).toBeVisible();

  const excel = await download(page, page.getByRole("button", { name: "Export Excel" }));
  expect(excel.name).toMatch(new RegExp(`^order-report-${order.po}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`));
  expect(excel.text.startsWith("PK")).toBe(true);
  for (const sheet of SHEETS) expect(excel.text).toContain(`<sheet name="${sheet}"`);
  const pdf = await download(page, page.getByRole("button", { name: "Export PDF" }));
  expect(pdf.name).toMatch(new RegExp(`^order-report-${order.po}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
  expect(pdf.text.startsWith("%PDF-")).toBe(true);
  expect(pdf.text).toContain(`(Order report ${order.po}) Tj`);
  expect(pdf.text).toContain("(Cotton fabric) Tj");
  for (const heading of ["Supplier financial summary", "China receipts", "Payment ledger", "Landed cost breakdown", "Timeline"]) expect(pdf.text).toContain(`(${heading}) Tj`);
  expect(pdf.text).toContain("Page 1 of");
  const csv = await download(page, page.getByRole("button", { name: "Export CSV" }));
  expect(csv.name).toMatch(new RegExp(`^order-report-${order.po}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
  expect(csv.text).toContain("Supplier code");
  expect(csv.text).toContain("Payment ledger");
});

test("Reports › Order Report › a closed PO: every section from the records, the breadcrumb and the way back, with screenshots", async ({ page, api, browser }, testInfo) => {
  test.setTimeout(180_000);
  // A closed order (received, shipped, cleared, trucked, stocked) with a deposit and a balance payment.
  const { po } = await closedOrder(api);
  const { id } = await api.order(po);
  await api.pay(id, { kind: "Deposit", amountCny: 300, rateInr: 12, reference: "TXN-D1" });
  await api.pay(id, { kind: "Balance", amountCny: 500, rateInr: 12.5 });

  await page.goto("/reports/orders");
  await page.getByLabel("PO number").fill(po);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("row").filter({ hasText: po })).toContainText("6. India warehouse");
  await page.screenshot({ path: shotPath(testInfo, "order-report-listing-1440.png"), fullPage: true });
  await page.getByRole("link", { name: `Report: ${po}` }).click();
  await expect(page).toHaveURL(`/reports/orders/${encodeURIComponent(po)}`);
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "Reports › Order Report" })).toHaveAttribute("href", "/reports/orders");
  await expect(page.getByRole("link", { name: "Back to Order Reports" })).toHaveAttribute("href", "/reports/orders");

  // Overview: closed, every lifecycle stage done; money from the two payments.
  await expect(kv(page, "Status").first()).toContainText("Closed on");
  await expect(page.getByRole("list", { name: "Order lifecycle" }).getByText("Done:")).toHaveCount(6);
  await expect(kpi(page, "Original PO value")).toContainText("¥1,000");
  await expect(kpi(page, "Total paid to supplier")).toContainText("¥800");
  await expect(kpi(page, "Outstanding balance").first()).toContainText("¥200");
  await page.screenshot({ path: shotPath(testInfo, "order-report-overview-1440.png"), fullPage: false });

  // The sections, each from its own records.
  const section = (id: string) => page.locator(`#${id}`).filter({ visible: true });
  await expect(section("china").getByRole("row").filter({ hasText: "Denim jeans" })).toContainText("100 pcs");
  await expect(section("shipping").getByRole("heading", { level: 3, name: /^TEST\d+$/ })).toHaveCount(1);
  await expect(section("shipping")).toContainText("Sino Freight");
  await expect(section("customs")).toContainText("BE-CLOSED");
  await expect(section("customs")).toContainText("₹1,000");
  await expect(section("warehouse")).toContainText("KL 07 CL 1");
  await expect(section("warehouse").getByRole("row").filter({ hasText: "Stocked" })).toContainText("Retail team: 100 pcs");
  await expect(section("payments").getByRole("row").filter({ hasText: "TXN-D1" })).toContainText("₹3,600");
  await expect(section("deposits").getByRole("row").filter({ hasText: "TXN-D1" })).toContainText("¥300.00");
  // Landed cost: ₹9,850 of goods + ₹1,000 clearing + ₹600 transport over 100 pieces; an estimate while ¥200 is unpaid.
  await expect(section("landed-cost")).toContainText("Estimate");
  await expect(section("landed-cost").getByRole("row").filter({ hasText: "Original purchase value" })).toContainText("₹9,850");
  await expect(section("landed-cost").getByRole("row").filter({ hasText: "India transportation" })).toContainText("₹600");
  await expect(kv(page, "Total landed cost")).toHaveText("₹11,450");
  await expect(kv(page, "Landed cost per unit")).toHaveText("₹114.50");
  await expect(section("timeline")).toContainText("Order closed");
  await expect(section("timeline")).toContainText("by Suresh Menon");
  for (const id of ["supplier", "items", "shipping", "customs", "payments", "deposits", "landed-cost", "timeline"]) {
    await section(id).screenshot({ path: shotPath(testInfo, `order-report-${id}.png`) });
  }

  // The Excel holds one sheet per section.
  const excel = await download(page, page.getByRole("button", { name: "Export Excel" }));
  for (const sheet of SHEETS) expect(excel.text).toContain(`<sheet name="${sheet}"`);
  expect(excel.text).toContain("BE-CLOSED");

  // The section navigation scrolls to a section; the way back lands on the list.
  await page.getByRole("navigation", { name: "Report sections" }).getByRole("link", { name: "Landed Cost" }).click();
  await expect(page).toHaveURL(/#landed-cost$/);
  await page.getByRole("link", { name: "Back to Order Reports" }).click();
  await expect(page).toHaveURL("/reports/orders");

  // Phone width: no page-level horizontal scroll on the detailed report.
  const phone = await browser.newContext({ storageState: "playwright/.auth/management.json", viewport: { width: 390, height: 844 } });
  const small = await phone.newPage();
  await small.goto(`/reports/orders/${encodeURIComponent(po)}`);
  await expect(small.getByRole("heading", { level: 1, name: po })).toBeVisible();
  expect(await small.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await small.screenshot({ path: shotPath(testInfo, "order-report-390.png"), fullPage: true });
  await phone.close();
});

test("Order reports lists the new order, filters by PO from the URL and downloads the filtered list; the hub card downloads too", async ({ page, api }) => {
  const order = await api.createOrder({ supplier: "Foshan Fabrics", lines: [{ item: "Track pants", quantity: 40, rateCny: 5 }] });

  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 2, name: "Order Report", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open report: Order Report" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Order reports" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: order.po })).toBeVisible();

  await page.getByLabel("PO number").fill(order.po);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(new RegExp(`po=${order.po}`));
  await expect(page.getByText(`PO: ${order.po}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `Report: ${order.po}` })).toHaveAttribute("href", `/reports/orders/${order.po}`);
  await expect(page.getByRole("link", { name: /^Report: / })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: order.po })).toContainText("Foshan Fabrics");
  await expect(page.getByRole("row").filter({ hasText: order.po })).toContainText("40 pcs");
  await expect(kpi(page, "Orders")).toContainText("1");
  await expect(kpi(page, "Order value")).toContainText("¥200");
  await expect(page.getByText("Unpaid", { exact: true })).toBeVisible();

  // The supplier-name text, the stage and the currency filters narrow the list and are echoed in the pill.
  await page.getByLabel("Supplier name").fill("fosh");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/supplierName=fosh/);
  await expect(page.getByText(/Supplier: fosh/)).toBeVisible();
  await page.getByRole("button", { name: /^Shipment stage:/ }).click();
  await page.getByRole("menuitemradio", { name: "1. Order and deposit" }).click();
  await expect(page).toHaveURL(/stage=1/);
  await expect(page.getByRole("link", { name: `Report: ${order.po}` })).toBeVisible();
  await page.getByRole("button", { name: /^Currency:/ }).click();
  await page.getByRole("menuitemradio", { name: /US dollar/ }).click();
  await expect(page).toHaveURL(/currency=USD/);
  await expect(page.getByRole("link", { name: /^Report: / })).toHaveCount(0);
  await page.getByRole("button", { name: /^Currency:/ }).click();
  await page.getByRole("menuitemradio", { name: "Any currency" }).click();
  await expect(page.getByRole("link", { name: `Report: ${order.po}` })).toBeVisible();

  const excel = await download(page, page.getByRole("button", { name: "Export Excel" }));
  expect(excel.name).toMatch(/^order-reports-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(excel.text).toContain('<sheet name="Orders"');
  expect(excel.text).toContain('<sheet name="Summary"');
  expect(excel.text).toContain(order.po);
  const pdf = await download(page, page.getByRole("button", { name: "Export PDF" }));
  expect(pdf.text).toContain("(Order reports) Tj");
  // Twenty-one columns: a PO may be wrapped over two text runs, so read the runs joined.
  expect(glue(pdf.text)).toContain(order.po);
  expect(pdf.text).toContain(`(PO: ${order.po}`);
  const csv = await download(page, page.getByRole("button", { name: "Export CSV" }));
  expect(csv.name).toMatch(/^order-reports-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(csv.text).toContain(order.po);
  expect(csv.text).toContain("Supplier code");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page).not.toHaveURL(/po=/);
  await expect(page.getByRole("link", { name: /^Report: / }).first()).toBeVisible();

  await page.goto("/reports");
  const hub = await download(page, page.getByRole("button", { name: "Excel export: Order Report" }));
  expect(hub.name).toMatch(/^order-reports-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(hub.text).toContain(order.po);
});
