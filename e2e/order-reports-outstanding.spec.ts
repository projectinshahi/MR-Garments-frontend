import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import type { Page, TestInfo } from "@playwright/test";

import type { OrderReportsResponse } from "../src/lib/api/reports-types";
import type { SupplierRow } from "../src/lib/api/types";
import { expect, kpi, test } from "./live-api";
import { downloadReport, type Format } from "./report-download";

// Order reports (/reports/orders) on the unified supplier ledger: settled and outstanding are the supplier account's
// FIFO projection, so an order's outstanding is never below 0. A new supplier: orders A and B (¥1,000 each), one ¥2,500
// payment to its account (both settled, ¥500 available), then order C (¥1,000), which the ¥500 settles in part. The
// report shows outstanding 0, 0 and 500 (total ¥500) on the page and in the PDF, Excel and CSV files, and no negative
// figure anywhere. Screenshots and the downloaded files go to SHOTS_DIR when set.

const out = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));
const shot = (page: Page, testInfo: TestInfo, name: string) => page.screenshot({ path: out(testInfo, name), fullPage: true });

test("Order reports settle a supplier's orders oldest first and never show a negative outstanding, in the page and every file", async ({ page, api }, testInfo) => {
  test.setTimeout(240_000);
  const name = `Outstanding Mills ${String(Date.now()).slice(-6)}`;
  const created = await api.post("/suppliers", { name, currency: "CNY", exchangeRate: 12.5 });
  expect(created.status(), await created.text()).toBe(201);
  const supplier = ((await created.json()) as { supplier: SupplierRow }).supplier;
  const lines = [{ item: "Denim jeans", quantity: 100, rateCny: 10 }];
  // Each received in full: an order is worth its received quantity x rate (owner rule of 2026-11-23).
  const a = await api.createReceivedOrder({ supplier: name, lines });
  const b = await api.createReceivedOrder({ supplier: name, lines });
  const paid = await api.post("/payments", { supplierId: supplier.id, amount: 2500, rateInr: 12.5, paidOn: new Date().toISOString().slice(0, 10), mode: "Bank transfer", clientRequestId: randomUUID() });
  expect(paid.status(), await paid.text()).toBe(201);
  const c = await api.createReceivedOrder({ supplier: name, lines });

  await test.step("the API: FIFO settles A and B in full and ¥500 of C; nothing is negative", async () => {
    const report = await api.get<OrderReportsResponse>(`/reports/orders?supplierId=${supplier.id}`);
    const of = (po: string) => report.rows.find((row) => row.po === po)!;
    expect([a, b, c].map((o) => [of(o.po).settledCny, of(o.po).outstandingCny, of(o.po).paymentStatus])).toEqual([
      [1000, 0, "paid"],
      [1000, 0, "paid"],
      [500, 500, "partly"],
    ]);
    expect(report.summary.byCurrency).toEqual([expect.objectContaining({ currency: "CNY", settledCny: 2500, outstandingCny: 500 })]);
  });

  await test.step("page: the summary and each order's settled and outstanding", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/reports/orders?supplier=${supplier.id}`);
    await expect(page.getByRole("heading", { name: "Order reports" })).toBeVisible();
    await expect(kpi(page, "Orders")).toContainText("3");
    await expect(kpi(page, "Order value (received)")).toContainText("¥3,000");
    await expect(kpi(page, "Settled")).toContainText("¥2,500");
    await expect(kpi(page, "Outstanding")).toContainText("¥500");
    const headers = await page.getByRole("columnheader").allTextContents();
    const at = headers.findIndex((header) => /^Outstanding\W*$/.test(header));
    const outstanding = (po: string) => page.getByRole("row").filter({ hasText: po }).getByRole("cell").nth(at);
    await expect(outstanding(a.po)).toHaveText("¥0");
    await expect(outstanding(b.po)).toHaveText("¥0");
    await expect(outstanding(c.po)).toHaveText("¥500");
    await expect(page.getByRole("table")).not.toContainText("-¥");
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

  await test.step("CSV: each row and the CNY total use the ledger's outstanding", async () => {
    const rows = files.CSV!.split("\r\n").map((line) => line.split(","));
    const header = rows.find((cells) => cells[0] === "PO")!;
    const at = header.indexOf("Outstanding (CNY)");
    const cell = (first: string) => rows.find((cells) => cells[0] === first)![at];
    expect([cell(a.po), cell(b.po), cell(c.po), cell("Total")]).toEqual(["0", "0", "500", "500"]);
  });

  await test.step("Excel and PDF: the note, and no negative amount", async () => {
    // A stored (uncompressed) zip: the sheet XML reads as text.
    expect(files.Excel).toContain("Settled and outstanding are the supplier ledger");
    expect(files.Excel).not.toMatch(/<v>-\d/);
    const runs = [...files.PDF!.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((match) => match[1]!);
    expect(runs[runs.lastIndexOf("Outstanding \\(CNY\\)") + 1]).toBe("500");
    expect(runs.filter((run) => /^-\d/.test(run))).toEqual([]);
  });

  await test.step("phone: the same figures, no sideways scroll", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(kpi(page, "Outstanding")).toContainText("¥500");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await shot(page, testInfo, "order-reports-outstanding-390.png");
  });
});
