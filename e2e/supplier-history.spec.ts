import type { Page, TestInfo } from "@playwright/test";

import { closedOrder, expect, test } from "./live-api";
import { downloadReport } from "./report-download";
import { PROCUREMENT_STATE } from "./sessions";

// Supplier Full History (owner approval of 2026-11-25; backend docs/supplier-history.md): the supplier profile's
// history tabs and the Supplier History report, on a supplier the test makes: one closed USD order (received, shipped,
// cleared, stocked), a payment, and a second payment voided. Read-only: the test never changes anything through
// these pages. Screenshots go to SHOTS_DIR when set.

/** A PDF's drawn text: its "(...) Tj" runs joined (headers are drawn a word per run). */
const pdfText = (raw: string) => [...raw.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((match) => match[1]).join(" ");
const shot = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));
const tabs = (page: Page) => page.getByRole("navigation", { name: "Supplier sections" }).filter({ visible: true });
const pager = (page: Page) => page.getByRole("navigation", { name: "Table pagination" }).filter({ visible: true }).first();
const openTab = async (page: Page, id: string, label: string, path: string) => {
  await tabs(page).getByRole("link", { name: label, exact: true }).click();
  await expect(page).toHaveURL(`/suppliers/${id}${path}`);
};

test("the supplier profile shows the full history in tabs and the report spans one or every supplier, with downloads", async ({ page, api }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const tag = `SH${String(Date.now()).slice(-4)}`;
  const supplier = await api.newSupplier(`${tag} History`, { currency: "USD", exchangeRate: 88 });
  const { po, number } = await closedOrder(api, { supplier: supplier.name }); // 100 Denim jeans at $10 = $1,000
  await api.paySupplier(supplier.id, { amount: 600, rateInr: 88, reference: `UTR-${tag}-1` });
  const mistake = await api.paySupplier(supplier.id, { amount: 50, rateInr: 88, reference: `UTR-${tag}-2` });
  await api.voidPayment(mistake.payment.id, "Entered twice");
  const { supplier: profile } = await api.get<{ supplier: { code: string } }>(`/suppliers/${supplier.id}/history/header`);
  expect(profile.code).toMatch(/^SUP-\d+$/);

  // Overview: the live balance apart from the historical totals; the tabs.
  await page.goto(`/suppliers/${supplier.id}`);
  await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
  // The profile keeps the supplier code (owner decision of 2026-11-25); only the history files leave it out.
  await expect(page.getByText(profile.code, { exact: true }).filter({ visible: true })).toBeVisible();
  const glance = page.getByRole("heading", { name: "Supplier history at a glance" });
  await expect(glance).toBeVisible();
  await expect(page.getByRole("region", { name: "Current balance (live)" }).filter({ visible: true }).first()).toContainText("Payable to supplier $400.00");
  await expect(page.getByRole("table", { name: "Historical totals per currency" })).toContainText("$600.00 (2)");
  await expect(tabs(page).getByRole("link")).toHaveText(["Overview", "Orders", "Payments", "Receiving", "Landed cost", "Activity", "Legacy archive"]);
  await page.screenshot({ path: shot(testInfo, "supplier-history-overview-1440.png"), fullPage: true });

  // Orders: the order with its received value; its PO opens the order.
  await openTab(page, supplier.id, "Orders", "/orders");
  await expect(pager(page)).toContainText("of 1 orders");
  await expect(page.getByRole("row").filter({ hasText: po })).toContainText("$1,000");
  await page.screenshot({ path: shot(testInfo, "supplier-history-orders-1440.png"), fullPage: true });

  // Payments: the void is listed with its reason and counts in no total; settlement is labelled as derived.
  await openTab(page, supplier.id, "Payments", "/payments");
  await expect(pager(page)).toContainText("of 2 payments");
  await expect(page.getByRole("columnheader", { name: "Settles now (derived)" })).toBeVisible();
  const voided = page.getByRole("row").filter({ hasText: `UTR-${tag}-2` });
  await expect(voided).toContainText("Voided");
  await expect(voided).toContainText("Entered twice");
  await expect(page.getByRole("row").filter({ hasText: `UTR-${tag}-1` })).toContainText(`${po} $600.00`);
  await page.getByRole("combobox", { name: "Payment status" }).selectOption("voided");
  await expect(pager(page)).toContainText("of 1 payments");
  await page.screenshot({ path: shot(testInfo, "supplier-history-payments-1440.png"), fullPage: true });

  // Receiving: the receipt with its container and India split, recorded by a named user (never a raw id).
  await openTab(page, supplier.id, "Receiving", "/receiving");
  const receipt = page.getByRole("row").filter({ hasText: po });
  await expect(receipt).toContainText(number);
  await expect(receipt).toContainText("Retail team 100");
  await expect(receipt).toContainText("Suresh Menon");
  await expect(receipt).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);

  // Landed cost: stocked but $400 unpaid, so an estimate waiting for the supplier payment, with the container's records.
  await openTab(page, supplier.id, "Landed cost", "/landed-cost");
  const landed = page.getByRole("row").filter({ hasText: po });
  await expect(landed).toContainText("Estimate");
  await expect(landed).toContainText("waiting for supplier payment");
  await expect(landed).toContainText(number);

  // Activity: every recorded event; a filter by type; the download holds what the filters match.
  await openTab(page, supplier.id, "Activity", "/activity");
  for (const label of ["Supplier added", "Order placed", "Goods received (China)", "Payment", "Payment voided", "Container loaded"]) {
    await expect(page.getByRole("table").getByText(label, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("combobox", { name: "Event type" }).filter({ visible: true }).selectOption("payment_voided");
  await expect(pager(page)).toContainText("of 1 events");
  await expect(page.getByRole("row").filter({ hasText: "Payment voided" })).toContainText("Reason: Entered twice");
  const csv = await downloadReport(page, "CSV");
  expect(csv.name).toMatch(/^supplier-history-sh\d{4}-history-[0-9a-f]{6}-\d{4}-\d{2}-\d{2}\.csv$/); // named after the supplier, not its code
  expect(csv.text).not.toContain(profile.code);
  expect(csv.text).toContain("Payment voided");
  expect(csv.text).toContain("Entered twice");
  expect(csv.text).not.toContain(`UTR-${tag}-1`); // the filter holds: only the void
  await page.screenshot({ path: shot(testInfo, "supplier-history-activity-1440.png"), fullPage: true });

  // Legacy archive: read-only, apart from the account.
  await openTab(page, supplier.id, "Legacy archive", "/archive");
  await expect(page.getByRole("heading", { name: "Legacy supplier advances (archive)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Legacy supplier deposits (archive)" })).toBeVisible();

  // The report: from the hub, one supplier, a PO search, and the three files.
  await page.goto("/reports");
  await expect(page.getByRole("link", { name: "Open report: Supplier History" })).toHaveAttribute("href", "/reports/supplier-history");
  await page.goto(`/reports/supplier-history?supplier=${supplier.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Supplier history" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Supplier" })).toHaveValue(supplier.id);
  const form = page.getByRole("search", { name: "History filters" });
  await form.getByRole("searchbox").fill(po);
  await form.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${po}`));
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows.nth(1)).toContainText(po);
  await page.screenshot({ path: shot(testInfo, "supplier-history-report-1440.png"), fullPage: true });
  // Every format names the supplier and never shows its code (no "Supplier code" column, no code value).
  for (const format of ["PDF", "Excel", "CSV"] as const) {
    const file = await downloadReport(page, format);
    expect(file.name).toMatch(/^supplier-history-\d{4}-\d{2}-\d{2}\.(pdf|xlsx|csv)$/);
    const text = format === "PDF" ? pdfText(file.text) : file.text;
    expect(text, format).toContain(po);
    expect(text, format).not.toMatch(/Supplier\s+code/);
    expect(text, format).not.toContain(profile.code);
  }
});

test.describe("without Management access", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("Procurement cannot open the history tabs or the report, and the API refuses them", async ({ page }) => {
    const options = await page.request.get("/api/v1/orders/options");
    const { suppliers } = (await options.json()) as { suppliers: { id: string }[] };
    const id = suppliers[0]!.id;
    for (const path of [`/suppliers/${id}/activity`, "/reports/supplier-history"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
    for (const path of [`/suppliers/${id}/history`, `/suppliers/${id}/history/header`, `/suppliers/${id}/history/events`, "/reports/supplier-history"]) {
      expect((await page.request.get(`/api/v1${path}`)).status(), path).toBe(403);
    }
  });
});
