import { readFile } from "node:fs/promises";

import type { Locator, Page } from "@playwright/test";

import { expect, kpi, kv, test } from "./live-api";

// Phase 2, scenario 8 (backend docs/phase2-contracts.md section 4): an order's Report tab (RPT-O1) with its Excel and
// PDF, and the Order reports page (RPT-O2) filtered by PO with its downloads. Orders are created through the API, so
// the shared test database's other rows don't matter. Role/label locators only: hidden <Activity> routes stay mounted.

test.use({ viewport: { width: 1440, height: 900 } });

/** Clicks `button` and returns the download's file name and its bytes as text (one character per byte). */
async function download(page: Page, button: Locator) {
  const [file] = await Promise.all([page.waitForEvent("download"), button.click()]);
  return { name: file.suggestedFilename(), text: (await readFile(await file.path())).toString("latin1") };
}
const SHEETS = ["Order Summary", "Items", "Payments", "Logistics", "Warehouse", "Landed Cost", "Timeline"];

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
  await expect(page.getByRole("heading", { level: 2, name: "Items" })).toBeVisible();
  const row = (text: string) => page.getByRole("row").filter({ hasText: text, visible: true });
  await expect(row("Denim jeans")).toContainText("120 pcs");
  await expect(row("Denim jeans").getByText("20 pcs", { exact: true })).toBeVisible(); // excess
  await expect(row("Cotton fabric").getByText("20 m", { exact: true })).toBeVisible(); // short
  await expect(page.getByRole("heading", { level: 2, name: "Payments" })).toBeVisible();
  await expect(kv(page, "Paid to supplier")).toHaveText("¥300");
  await expect(kv(page, "Balance to supplier")).toHaveText("¥1,100");
  await expect(row("Deposit")).toContainText("₹3,600");
  await expect(page.getByRole("heading", { level: 2, name: "Timeline" })).toBeVisible();
  for (const step of ["Order placed", "Deposit paid", "Received in China"]) {
    await expect(page.getByText(new RegExp(`^${step} · `)).filter({ visible: true })).toBeVisible();
  }
  await expect(kv(page, "Stage")).toHaveText("2. Receiving in China");

  const excel = await download(page, page.getByRole("button", { name: "Export Excel" }));
  expect(excel.name).toMatch(new RegExp(`^order-report-${order.po}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`));
  expect(excel.text.startsWith("PK")).toBe(true);
  for (const sheet of SHEETS) expect(excel.text).toContain(`<sheet name="${sheet}"`);
  const pdf = await download(page, page.getByRole("button", { name: "Export PDF" }));
  expect(pdf.name).toMatch(new RegExp(`^order-report-${order.po}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
  expect(pdf.text.startsWith("%PDF-")).toBe(true);
  expect(pdf.text).toContain(`(Order report ${order.po}) Tj`);
  expect(pdf.text).toContain("(Cotton fabric) Tj");
});

test("Order reports lists the new order, filters by PO from the URL and downloads the filtered list; the hub card downloads too", async ({ page, api }) => {
  const order = await api.createOrder({ supplier: "Foshan Fabrics", lines: [{ item: "Track pants", quantity: 40, rateCny: 5 }] });

  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 2, name: "Order reports", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open report: Order reports" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Order reports" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: order.po })).toBeVisible();

  await page.getByLabel("PO number").fill(order.po);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(new RegExp(`po=${order.po}`));
  await expect(page.getByText(`PO: ${order.po}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `Report: ${order.po}` })).toHaveAttribute("href", `/orders/${order.po}/report`);
  await expect(page.getByRole("link", { name: /^Report: / })).toHaveCount(1);
  await expect(kpi(page, "Orders")).toContainText("1");
  await expect(kpi(page, "Order value")).toContainText("¥200");
  await expect(page.getByText("Unpaid", { exact: true })).toBeVisible();

  const excel = await download(page, page.getByRole("button", { name: "Export Excel" }));
  expect(excel.name).toMatch(/^order-reports-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(excel.text).toContain('<sheet name="Orders"');
  expect(excel.text).toContain('<sheet name="Summary"');
  expect(excel.text).toContain(order.po);
  const pdf = await download(page, page.getByRole("button", { name: "Export PDF" }));
  expect(pdf.text).toContain("(Order reports) Tj");
  expect(pdf.text).toContain(`(${order.po}) Tj`);
  expect(pdf.text).toContain(`(PO: ${order.po}) Tj`);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page).not.toHaveURL(/po=/);
  await expect(page.getByRole("link", { name: /^Report: / }).first()).toBeVisible();

  await page.goto("/reports");
  const hub = await download(page, page.getByRole("button", { name: "Excel export: Order reports" }));
  expect(hub.name).toMatch(/^order-reports-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(hub.text).toContain(order.po);
});
