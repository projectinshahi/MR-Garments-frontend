import type { Page } from "@playwright/test";

import { expect, test } from "./live-api";
import { downloadReport } from "./report-download";

// Deposits after the unified supplier ledger (D8, D11, D14). Scenario 6: an order's Deposit Required is a milestone
// on Supplier ledger > Deposit milestones, met as the supplier's account settles the order (oldest first), never a
// balance. Scenario 7: supplier deposits are a read-only archive: the API refuses new ones (410) and the supplier's
// ledger shows the archive tab without any way to add to it. Each test uses a supplier of its own.

test.use({ viewport: { width: 1440, height: 900 } });

/** Filters the milestones to this PO until `shown` holds, typing again if hydration reset the box. */
const searchPo = (page: Page, po: string, shown: () => Promise<void>) =>
  expect(async () => {
    await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    await shown();
  }).toPass({ timeout: 20_000 });

test("Scenario 6: a Deposit Required milestone counts only what FIFO settles once goods are received: not met, partly met, met", async ({ page, api }) => {
  // ¥1,000 order whose supplier asked for a ¥1,000 deposit; nothing paid yet.
  const supplier = await api.newSupplier("Milestone Supply");
  const { po } = await api.createOrder({ supplier: supplier.name, depositRequiredCny: 1000 });
  const row = page.getByRole("table").getByRole("row").filter({ hasText: po });
  const oneRow = () => expect(row).toHaveCount(1, { timeout: 2_000 });
  const cells = row.getByRole("cell");

  await page.goto("/supplier-ledger/milestones");
  await expect(page.getByRole("heading", { level: 1, name: "Supplier ledger" })).toBeVisible();
  await searchPo(page, po, oneRow);
  await expect(cells.nth(2)).toHaveText(supplier.name);
  await expect(cells.nth(3)).toHaveText("¥1,000.00");
  await expect(cells.nth(4)).toHaveText("¥0.00");
  await expect(cells.nth(5)).toHaveText("¥1,000.00");
  await expect(row.getByText("Deposit not met", { exact: true })).toBeVisible();
  await expect(row.getByRole("link", { name: supplier.name })).toHaveAttribute("href", `/supplier-ledger/${supplier.id}`);

  // ¥300 to the supplier's account before any goods: supplier credit only, the deposit is still not met (owner rule
  // of 2026-11-23: only what FIFO settles to the order counts, and nothing is settled before goods are received).
  await api.paySupplier(supplier.id, { amount: 300, rateInr: 12 });
  await page.reload();
  await searchPo(page, po, oneRow);
  await expect(cells.nth(4)).toHaveText("¥0.00");
  await expect(cells.nth(5)).toHaveText("¥1,000.00");
  await expect(row.getByText("Deposit not met", { exact: true })).toBeVisible();
  expect(await api.order(po)).toMatchObject({ orderValueCny: 0, paymentStatus: "awaiting_goods", depositSettledCny: 0, depositStatus: "unmet" });

  // The goods arrive: the order is worth ¥1,000 and the ¥300 credit settles it: partly met, ¥700 pending.
  await api.receive(po, { "Denim jeans": 100 });
  await page.reload();
  await searchPo(page, po, oneRow);
  await expect(cells.nth(4)).toHaveText("¥300.00");
  await expect(cells.nth(5)).toHaveText("¥700.00");
  await expect(row.getByText("Deposit partly met", { exact: true })).toBeVisible();
  // The Milestone filter keeps it under Partly met only.
  const milestone = async (label: string) => {
    await page.getByRole("button", { name: /^Milestone: / }).click();
    await page.getByRole("menuitemradio", { name: label }).click();
  };
  await milestone("Deposit met");
  await expect(row).toHaveCount(0);
  await milestone("Deposit partly met");
  await expect(row).toHaveCount(1);
  await milestone("All milestones");

  // The remaining ¥700: met, nothing pending.
  await api.paySupplier(supplier.id, { amount: 700, rateInr: 12 });
  await page.reload();
  await searchPo(page, po, oneRow);
  await expect(cells.nth(4)).toHaveText("¥1,000.00");
  await expect(cells.nth(5)).toHaveText("¥0.00");
  await expect(row.getByText("Deposit met", { exact: true })).toBeVisible();
  expect(await api.order(po)).toMatchObject({ depositRequiredCny: 1000, depositSettledCny: 1000, depositPendingCny: 0, depositStatus: "met" });

  // The page's download is a file.
  expect((await downloadReport(page, "Excel")).name).toMatch(/\.xlsx$/);
});

test("Scenario 7: supplier deposits are a read-only archive: the API refuses new ones and the ledger offers no way to add them", async ({ page, api }) => {
  const supplier = await api.newSupplier("Archive Supply");
  const refused = await api.post(`/suppliers/${supplier.id}/deposits`, { direction: "give", amount: 1000, openedOn: "2026-11-01", exchangeRate: 12.5 });
  expect(refused.status()).toBe(410);
  expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("gone");
  expect((await api.post(`/suppliers/${supplier.id}/advances`, { amount: 100, paidOn: "2026-11-01", rateInr: 12.5, mode: "Cash" })).status()).toBe(410);

  await page.goto(`/supplier-ledger/${supplier.id}`);
  await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
  await page.getByRole("tab", { name: "Supplier deposits (archive)" }).click();
  await expect(page.getByText(`No supplier deposits with ${supplier.name}.`)).toBeVisible();
  await page.getByRole("tab", { name: "Legacy advance history" }).click();
  await expect(page.getByText("No legacy advance history.")).toBeVisible();
  await expect(page.getByRole("button", { name: /New deposit|Add advance/ })).toHaveCount(0);
});
