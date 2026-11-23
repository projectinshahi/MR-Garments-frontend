import type { Browser, BrowserContextOptions } from "@playwright/test";

import type { SupplierLedgerResponse } from "../src/lib/api/ledger-types";
import { closedOrder, expect, kpi, settled, test, toast, today } from "./live-api";
import { STAFF_STATE } from "./sessions";

// Owner rules of 2026-11-23 (backend docs/unified-ledger.md "Order value"): an order is worth its received quantity x
// rate. Receipts post the value (partial, second and over-receipts; a delete takes it back); a receipt or rate
// correction that changes a final landed cost needs a Management approval with a reason, and the order stays protected
// after an approved change. Each test makes its own supplier, so its ledger figures are its own.

const VIEWPORT = { width: 1440, height: 900 };
test.use({ viewport: VIEWPORT });
const as = async (browser: Browser, storageState: BrowserContextOptions["storageState"]) => settled(await browser.newPage({ storageState, viewport: VIEWPORT }));

test("receipts value the order: awaiting goods, partial, over the PO value, and a deleted receipt takes its value back", async ({ page, api }) => {
  test.setTimeout(120_000);
  const supplier = await api.newSupplier("Received Value");
  const { po } = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
  await api.paySupplier(supplier.id, { amount: 300, rateInr: 12 });
  // Nothing received: worth ¥0, never "Paid"; the ¥300 waits as supplier credit.
  expect(await api.order(po)).toMatchObject({ orderValueCny: 0, poValueCny: 1000, settledCny: 0, outstandingCny: 0, paymentStatus: "awaiting_goods" });
  await page.goto(`/orders/${po}/payments`);
  await expect(kpi(page, "Order value (received)")).toContainText("¥0.00");
  await expect(kpi(page, "Order value (received)")).toContainText("PO value ¥1,000.00");
  await expect(kpi(page, "Outstanding")).toContainText("Awaiting goods");

  // A partial receipt: 40 of 100, worth ¥400; the credit settles ¥300 of it.
  await api.receive(po, { "Denim jeans": 40 });
  expect(await api.order(po)).toMatchObject({ orderValueCny: 400, settledCny: 300, outstandingCny: 100, paymentStatus: "partly" });
  // A second receipt of 70 goes past the PO: 110 received, worth ¥1,100.
  const { receipt: second } = await api.receive(po, { "Denim jeans": 70 });
  expect(await api.order(po)).toMatchObject({ orderValueCny: 1100, poValueCny: 1000, settledCny: 300, outstandingCny: 800 });
  await page.reload();
  await expect(kpi(page, "Order value (received)")).toContainText("¥1,100.00");

  // The statement: the order placed with nothing received (no change), then one order change per receipt.
  const ledger = await api.get<SupplierLedgerResponse>(`/suppliers/${supplier.id}/ledger`);
  const ofOrder = ledger.entries.filter((entry) => entry.po === po).map((entry) => [entry.entryType, entry.amount]);
  expect(ofOrder).toEqual([
    ["order_adjustment", -700],
    ["order_adjustment", -400],
    ["order_debit", 0],
  ]);
  await page.goto(`/supplier-ledger/${supplier.id}`);
  const placed = page.getByRole("row").filter({ hasText: "Order placed" }).filter({ hasText: "Nothing received" });
  await expect(placed).toContainText("No change");

  // Management deletes the second receipt on the order's Receiving tab: its ¥700 goes back.
  await page.goto(`/orders/${po}/receiving`);
  await page.getByRole("button", { name: /^Delete receipt of .*70 pcs Denim jeans/ }).click();
  await page.getByRole("alertdialog", { name: "Delete Goods Receipt?" }).getByRole("button", { name: "Delete receipt" }).click();
  await expect(toast(page, "Receipt deleted")).toBeVisible();
  expect(await api.order(po)).toMatchObject({ orderValueCny: 400, settledCny: 300, outstandingCny: 100 });
  const after = await api.get<SupplierLedgerResponse>(`/suppliers/${supplier.id}/ledger`);
  expect(after.entries.filter((entry) => entry.po === po)[0]).toMatchObject({ entryType: "order_adjustment", amount: 700 });
  expect(second.id).toBeTruthy();
});

test("a receipt that changes a final landed cost needs Management's reason; the order stays protected after an approved change", async ({ page, api, browser }) => {
  test.setTimeout(240_000);
  const supplier = await api.newSupplier("Final Guard");
  // A: closed (received, shipped, cleared, trucked, stocked) and paid in full, so its landed cost is final.
  const a = await closedOrder(api, { supplier: supplier.name });
  await api.paySupplier(supplier.id, { amount: 1000, rateInr: 12 });
  // An earlier order of the same supplier: its goods would take A's credits (oldest first).
  const early = await api.createOrder({ supplier: supplier.name, orderDate: today(-40), deliveryDate: today(-20), lines: [{ item: "Track pants", quantity: 20, rateCny: 5 }] });

  // China staff can't approve: the API's message, nothing saved.
  const chen = await as(browser, STAFF_STATE);
  await chen.goto("/receiving/new");
  await chen.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: early.po });
  await chen.getByRole("textbox", { name: "Bundles received now" }).fill("1");
  await chen.getByRole("textbox", { name: "Received now, Track pants" }).fill("10");
  await chen.getByRole("textbox", { name: "Short remark" }).fill("Rest to follow");
  await chen.getByRole("button", { name: "Save receipt" }).click();
  await expect(toast(chen, new RegExp(`settle ${a.po}, whose landed cost is already final`))).toBeVisible();
  await expect(chen.getByRole("dialog")).toHaveCount(0);
  await chen.close();
  expect(await api.order(early.po)).toMatchObject({ orderValueCny: 0, stage: 1 });

  // Management: the same receipt asks for the reason, then saves with it.
  const receive = async (pieces: string) => {
    await page.goto("/receiving/new");
    await page.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: early.po });
    await page.getByRole("textbox", { name: "Bundles received now" }).fill("1");
    await page.getByRole("textbox", { name: "Received now, Track pants" }).fill(pieces);
    const remark = page.getByRole("textbox", { name: "Short remark" });
    if ((await remark.getAttribute("aria-required")) === "true") await remark.fill("Rest to follow");
    await page.getByRole("button", { name: "Save receipt" }).click();
    return page.getByRole("dialog", { name: "Approve a change to a final landed cost?" });
  };
  let approve = await receive("10");
  await expect(approve).toContainText(a.po);
  await approve.getByRole("textbox", { name: /Reason/ }).fill("First lot, agreed with the owner");
  await approve.getByRole("button", { name: "Approve and save" }).click();
  await expect(toast(page, "Receipt saved")).toBeVisible();
  // A is now ¥50 short of its credits: no longer final, but still protected.
  expect(await api.order(a.po)).toMatchObject({ settledCny: 950, outstandingCny: 50 });

  approve = await receive("10");
  await expect(approve).toContainText(a.po);
  await approve.getByRole("textbox", { name: /Reason/ }).fill("Second lot, agreed with the owner");
  await approve.getByRole("button", { name: "Approve and save" }).click();
  await expect(toast(page, "Receipt saved")).toBeVisible();
  expect(await api.order(a.po)).toMatchObject({ settledCny: 900, outstandingCny: 100 });

  // Each approval is on its immutable posting: the reason, who approved it.
  const ledger = await api.get<SupplierLedgerResponse>(`/suppliers/${supplier.id}/ledger`);
  const approvals = ledger.entries.filter((entry) => entry.po === early.po && entry.entryType === "order_adjustment");
  expect(approvals.map((entry) => entry.notes)).toEqual([
    "Management approval (final landed cost): Second lot, agreed with the owner",
    "Management approval (final landed cost): First lot, agreed with the owner",
  ]);
  expect(approvals.every((entry) => entry.recordedBy === "Suresh Menon")).toBe(true);
});

test("Management corrects a received line's rate with a reason; the account changes by received x the rate change", async ({ page, api }) => {
  const supplier = await api.newSupplier("Rate Fix");
  const { po } = await api.createReceivedOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
  expect(await api.order(po)).toMatchObject({ orderValueCny: 1000 });

  // On the Items tab, beside the rates (Management, goods received).
  await page.goto(`/orders/${po}/items`);
  await page.getByRole("button", { name: "Correct rates" }).click();
  const dialog = page.getByRole("dialog", { name: "Correct rates" });
  await dialog.getByRole("textbox", { name: "Rate, Denim jeans" }).fill("9.5");
  await expect(dialog).toContainText("Less payable to the supplier by ¥50.00.");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByText("Enter the reason for this rate correction.")).toBeVisible();
  await dialog.getByRole("textbox", { name: /Reason/ }).fill("Invoice rate 9.50");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(toast(page, "Rates corrected. Supplier balance: Payable to supplier ¥1,000.00 → Payable to supplier ¥950.00")).toBeVisible();
  expect(await api.order(po)).toMatchObject({ orderValueCny: 950, poValueCny: 950 });
  const ledger = await api.get<SupplierLedgerResponse>(`/suppliers/${supplier.id}/ledger`);
  expect(ledger.entries.find((entry) => entry.po === po)).toMatchObject({ entryType: "order_adjustment", amount: 50, recordedBy: "Suresh Menon" });
  expect(ledger.entries.find((entry) => entry.po === po)!.notes).toContain("Rate correction: Invoice rate 9.50");
});
