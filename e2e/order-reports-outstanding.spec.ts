import { writeFile } from "node:fs/promises";

import type { Page, TestInfo } from "@playwright/test";

import type { OrderReportsResponse } from "../src/lib/api/reports-types";
import type { SupplierRow } from "../src/lib/api/types";
import { expect, kpi, test } from "./live-api";
import { downloadReport, type Format } from "./report-download";

// Order reports (/reports/orders): the Balance (what is still owed) never shows below 0. Three ¥1,000 orders of a new
// supplier: unpaid (owes ¥1,000), paid exactly (¥0) and overpaid by ¥500 (¥0, not -¥500), so the total is ¥1,000, not
// ¥500, on the page and in the PDF, Excel and CSV files. The API and the order keep the true -¥500. Screenshots and the
// downloaded files go to SHOTS_DIR when set.

const out = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));
const shot = (page: Page, testInfo: TestInfo, name: string) => page.screenshot({ path: out(testInfo, name), fullPage: true });

test("Order reports show an overpaid order's balance as 0 and total only what is owed, in the page and every file", async ({ page, api }, testInfo) => {
  test.setTimeout(240_000);
  const name = `Outstanding Mills ${String(Date.now()).slice(-6)}`;
  const created = await api.post("/suppliers", { name, currency: "CNY", exchangeRate: 12.5 });
  expect(created.status(), await created.text()).toBe(201);
  const supplier = ((await created.json()) as { supplier: SupplierRow }).supplier;
  const lines = [{ item: "Denim jeans", quantity: 100, rateCny: 10 }];
  const owing = await api.createOrder({ supplier: name, lines });
  const settled = await api.createOrder({ supplier: name, lines });
  const overpaid = await api.createOrder({ supplier: name, lines });
  await api.pay(settled.id, { amountCny: 1000, rateInr: 12.5 });
  await api.pay(overpaid.id, { amountCny: 1500, rateInr: 12.5 });

  await test.step("the API and the order keep the true signed balance", async () => {
    const report = await api.get<OrderReportsResponse>(`/reports/orders?supplierId=${supplier.id}`);
    expect(report.rows.find((row) => row.po === overpaid.po)!.balanceCny).toBe(-500);
    expect(report.summary.byCurrency).toEqual([expect.objectContaining({ currency: "CNY", balanceCny: 500 })]);
    expect((await api.order(overpaid.po)).balanceCny).toBe(-500);
  });

  await test.step("page: rows floored at 0, the Balance total is what is owed", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/reports/orders?supplier=${supplier.id}`);
    await expect(page.getByRole("heading", { name: "Order reports" })).toBeVisible();
    await expect(kpi(page, "Orders")).toContainText("3");
    await expect(kpi(page, "Order value")).toContainText("¥3,000");
    await expect(kpi(page, "Paid to suppliers")).toContainText("¥2,500");
    await expect(kpi(page, "Balance")).toContainText("¥1,000");
    const headers = await page.getByRole("columnheader").allTextContents();
    const at = headers.findIndex((header) => /^Balance\W*$/.test(header));
    const balance = (po: string) => page.getByRole("row").filter({ hasText: po }).getByRole("cell").nth(at);
    await expect(balance(owing.po)).toHaveText("¥1,000");
    await expect(balance(settled.po)).toHaveText("¥0");
    await expect(balance(overpaid.po)).toHaveText("¥0");
    await expect(page.getByRole("table")).not.toContainText("-¥500");
    await expect(page.getByText(/overpaid order.s balance\s+shows 0 and adds nothing to the totals/)).toBeVisible();
    await shot(page, testInfo, "order-reports-outstanding-1440.png");
  });

  const files: Partial<Record<Format, string>> = {};
  await test.step("downloads: PDF, Excel and CSV", async () => {
    for (const format of ["PDF", "Excel", "CSV"] as const) {
      const file = await downloadReport(page, format);
      files[format] = file.text;
      await writeFile(out(testInfo, file.name), Buffer.from(file.text, "latin1"));
    }
  });

  await test.step("CSV: each row and the CNY total use the floored balance", async () => {
    const rows = files.CSV!.split("\r\n").map((line) => line.split(","));
    const header = rows.find((cells) => cells[0] === "PO")!;
    const at = header.indexOf("Balance (CNY)");
    const cell = (first: string) => rows.find((cells) => cells[0] === first)![at];
    expect([cell(owing.po), cell(settled.po), cell(overpaid.po), cell("Total")]).toEqual(["1000", "0", "0", "1000"]);
  });

  await test.step("Excel: no negative balance, the note, the total", async () => {
    // A stored (uncompressed) zip: the sheet XML reads as text.
    expect(files.Excel).not.toContain("<v>-500</v>");
    expect(files.Excel).toContain("Balance is what is still owed to the supplier: an overpaid order shows 0 and adds nothing to the totals.");
    expect(files.Excel).toContain("<v>1000</v>");
  });

  await test.step("PDF: the Summary's Balance (CNY) is 1,000 and no negative amount is drawn", async () => {
    const runs = [...files.PDF!.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((match) => match[1]!);
    expect(runs[runs.lastIndexOf("Balance \\(CNY\\)") + 1]).toBe("1,000");
    expect(runs.filter((run) => /^-\d/.test(run))).toEqual([]);
  });

  await test.step("phone: the same figures, no sideways scroll", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(kpi(page, "Balance")).toContainText("¥1,000");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await shot(page, testInfo, "order-reports-outstanding-390.png");
  });
});
