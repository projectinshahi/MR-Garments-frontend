import type { Page, TestInfo } from "@playwright/test";

import type { OrderReportsResponse } from "../src/lib/api/reports-types";

import { closedOrder, expect, test } from "./live-api";
import { downloadReport } from "./report-download";

// Supplier order details (RPT-S1) and the Order reports Dollar Cost column (owner decisions of 2026-11-24), on
// suppliers the test makes: a USD supplier (₹88) with a closed order (container, landed cost), a part-received order and
// one with nothing received, and a CNY supplier (₹12.50) whose order saves the USD rate the active USD suppliers agree
// on (₹88 when this spec runs alone; none when other specs left USD suppliers at other rates): its Dollar Cost is
// value × 12.50 ÷ that rate, or "No USD rate saved". Screenshots go to SHOTS_DIR when set.

const shot = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));
/** How far the widest visible table runs past its card (0: every column fits). Hidden <Activity> routes are skipped. */
const tableOverflow = (page: Page) =>
  page.evaluate(() => Math.max(0, ...[...document.querySelectorAll("table")].filter((table) => table.offsetParent).map((table) => table.parentElement!.scrollWidth - table.parentElement!.clientWidth)));

test("Supplier order details groups each supplier's orders in full, with Dollar Cost, and downloads them; Order reports shows Dollar Cost, no supplier code", async ({ page, api }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const tag = `SOD${String(Date.now()).slice(-4)}`;
  const usd = await api.newSupplier(`${tag} Dollar`, { currency: "USD", exchangeRate: 88 });
  const cny = await api.newSupplier(`${tag} Yuan`);
  const closed = await closedOrder(api, { supplier: usd.name }); // 100 Denim jeans at $10, shipped, cleared, stocked
  await api.paySupplier(usd.id, { amount: 600, rateInr: 88 });
  const part = await api.createOrder({
    supplier: usd.name,
    lines: [
      { item: "Denim jeans", quantity: 60, rateCny: 9.5 },
      { item: "Track pants", quantity: 40, rateCny: 5 },
    ],
  });
  await api.receive(part.po, { "Denim jeans": 45, "Track pants": 40 }, { shortRemark: "Rest to follow" });
  const waiting = await api.createOrder({ supplier: usd.name, lines: [{ item: "Track pants", quantity: 10, rateCny: 6 }] });
  const yuan = await api.createReceivedOrder({ supplier: cny.name, lines: [{ item: "Denim jeans", quantity: 80, rateCny: 12 }] });

  // The hub's new card opens it.
  await page.goto("/reports");
  await expect(page.getByRole("link", { name: "Open report: Supplier Order Details" })).toHaveAttribute("href", "/reports/supplier-orders");
  await page.screenshot({ path: shot(testInfo, "reports-hub-1440.png"), fullPage: true });

  await page.goto(`/reports/supplier-orders?supplierName=${tag}`);
  await expect(page.getByRole("heading", { level: 1, name: "Supplier order details" })).toBeVisible();
  const card = (name: string) => page.locator("details").filter({ has: page.getByRole("heading", { level: 2, name }) });
  await expect(page.locator("details")).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([usd.name, cny.name]);
  const dollars = card(usd.name);
  // $1,000 (closed) + 45 × 9.5 + 40 × 5 = $627.50 (part) + $0 (nothing received).
  await expect(dollars.locator("summary")).toContainText("3 orders");
  await expect(dollars.locator("summary")).toContainText("$1,628");
  const rowOf = (po: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name: `Report: ${po}` }) });
  await expect(rowOf(part.po)).toContainText("Denim jeansTrack pants");
  await expect(rowOf(part.po)).toContainText("45 pcs40 pcs");
  await expect(rowOf(part.po)).toContainText("$628");
  await expect(rowOf(waiting.po)).toContainText("Awaiting goods");
  await expect(rowOf(closed.po)).toContainText(closed.number);
  await expect(rowOf(closed.po)).toContainText("Clearing ₹");
  // ¥960 × 12.50 = ₹12,000 ÷ the USD rate saved on the order (the API's figure, written as the page writes it).
  const [saved] = (await api.get<OrderReportsResponse>(`/reports/orders?po=${yuan.po}`)).rows;
  expect(saved!.dollarCost).toBe(saved!.usdRate === null ? null : Math.round((12000 / saved!.usdRate) * 100) / 100);
  const yuanDollars = saved!.dollarCost === null ? "No USD rate saved" : `$${Math.round(saved!.dollarCost)}`;
  await expect(card(cny.name).locator("summary")).toContainText(saved!.dollarCost === null ? "No USD rate saved for 1 order" : yuanDollars);
  await expect(rowOf(yuan.po)).toContainText(saved!.usdRate === null ? "CNY @ ₹12.50" : `CNY @ ₹12.50USD @ ₹${saved!.usdRate.toFixed(2)}`);
  await expect(rowOf(yuan.po)).toContainText(yuanDollars);
  await page.screenshot({ path: shot(testInfo, "supplier-order-details-1440.png"), fullPage: true });
  expect(await tableOverflow(page)).toBe(0);

  for (const [format, ext] of [["CSV", "csv"], ["Excel", "xlsx"], ["PDF", "pdf"]] as const) {
    const file = await downloadReport(page, format);
    expect(file.name).toMatch(new RegExp(`^supplier-order-details-\\d{4}-\\d{2}-\\d{2}\\.${ext}$`));
    if (ext === "csv") expect(file.text).toContain(`${part.po},`);
    if (ext === "xlsx") expect(file.text).toContain('<sheet name="Orders by supplier"');
    if (ext === "pdf") expect(file.text).toContain("(Supplier order details) Tj");
  }

  // A supplier folds to its summary line.
  await card(cny.name).locator("summary").click();
  await expect(rowOf(yuan.po)).toBeHidden();

  // Order reports: Dollar Cost after the value, no supplier code (the name stays).
  await page.goto(`/reports/orders?supplierName=${tag}`);
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: /^Dollar Cost/ })).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: part.po })).toContainText("$628");
  await expect(table.getByRole("row").filter({ hasText: yuan.po })).toContainText(yuanDollars);
  await expect(table.getByText(usd.code, { exact: true })).toHaveCount(0);
  await expect(table.getByText(usd.name).first()).toBeVisible();
  await page.screenshot({ path: shot(testInfo, "order-reports-dollar-cost-1440.png"), fullPage: true });
  expect(await tableOverflow(page)).toBe(0);

  // A phone: the tables scroll inside their cards, never the page.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/reports/supplier-orders?supplierName=${tag}`);
  await expect(page.getByRole("heading", { level: 1, name: "Supplier order details" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: shot(testInfo, "supplier-order-details-390.png"), fullPage: true });
});
