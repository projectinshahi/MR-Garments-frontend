import type { Page, TestInfo } from "@playwright/test";

import type { OrderReportsResponse } from "../src/lib/api/reports-types";
import { expect, test, toast } from "./live-api";
import { downloadReport } from "./report-download";

// Edit order's PO number (ORD-5 `po`; backend docs/contracts.md) against the live API: the field prefilled, a blank
// and a taken number refused under the field, a new number (with a slash) saved in place: same order id, the payment
// still on it, the page moved to the new address, and the number in the orders list, its search, Order reports (and
// its CSV) and the order report. Desktop and phone. Screenshots go to SHOTS_DIR when set.

const tag = () => String(Date.now()).slice(-6);
const out = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));
// An open dialog is captured at the viewport: a full-page capture paints the page above it.
const shot = (page: Page, testInfo: TestInfo, name: string) => page.screenshot({ path: out(testInfo, name) });
// Waits for the dialog's open animation (a cancelled one rejects its `finished`: nothing left to wait for).
const settled = (page: Page) =>
  page.getByRole("dialog").evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
const poBox = (scope: Page | ReturnType<Page["getByRole"]>) => scope.getByRole("textbox", { name: "PO number", exact: true });

test("Edit order renumbers the order in place, refusing a blank or taken number, and every page follows", async ({ page, api }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const order = await api.createOrder({ lines: [{ item: "Denim jeans", quantity: 120, rateCny: 10 }] });
  const other = await api.createOrder();
  // A sea freight payment is recorded against the order itself (supplier payments go to the supplier account).
  const { payment } = await api.payAgent(order.id, { amountCny: 400, rateInr: 12.5, kind: "Deposit" });
  const renamed = `MR/2026/${tag()}`;

  await page.goto(`/orders/${order.po}`);
  await page.getByRole("button", { name: "Edit order" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit order" });
  await expect(poBox(dialog)).toHaveValue(order.po);
  await expect(dialog).toContainText("Change the PO number, the dates or the items.");
  await settled(page);
  await shot(page, testInfo, "edit-order-po-1440.png");

  await test.step("a blank number is refused before the API", async () => {
    await poBox(dialog).fill("  ");
    await dialog.getByRole("button", { name: "Save order" }).click();
    await expect(dialog.getByText("Enter the PO number.")).toBeVisible();
  });

  await test.step("a number another order uses is refused under the field (any letter case)", async () => {
    await poBox(dialog).fill(other.po.toLowerCase());
    await dialog.getByRole("button", { name: "Save order" }).click();
    await expect(dialog.getByText("This PO number is already used by another order.")).toBeVisible();
    await expect(poBox(dialog)).toHaveAttribute("aria-invalid", "true");
    await shot(page, testInfo, "edit-order-po-duplicate-1440.png");
    expect((await api.order(order.po)).id).toBe(order.id);
  });

  await test.step("a new number saves in place and the page moves to it", async () => {
    const patch = page.waitForRequest((request) => request.method() === "PATCH" && request.url().endsWith(`/api/v1/orders/${order.po}`));
    await poBox(dialog).fill(renamed);
    await dialog.getByRole("button", { name: "Save order" }).click();
    expect((await patch).postDataJSON()).toEqual({ po: renamed });
    await expect(toast(page, `Order saved. Its PO number is now ${renamed}.`)).toBeVisible();
    await expect(page).toHaveURL(`/orders/${encodeURIComponent(renamed)}`);
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
    await shot(page, testInfo, "order-renamed-1440.png");
  });

  await test.step("the same order: id, value and payment unchanged; the old number is gone", async () => {
    const detail = await api.order(renamed);
    expect(detail).toMatchObject({ id: order.id, po: renamed, orderValueCny: 1200, agentPaidCny: 400 });
    expect(detail.payments?.map((p) => p.id)).toEqual([payment.id]);
    expect((await api.request.get(`/api/v1/orders/${order.po}`)).status()).toBe(404);
  });

  await test.step("orders list and its search, payments tab, Order reports and its CSV, the order report", async () => {
    await page.goto("/orders");
    await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(renamed);
    await expect(page.getByRole("link", { name: renamed, exact: true })).toBeVisible();
    await page.goto(`/orders/${encodeURIComponent(renamed)}/payments`);
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Deposit" }).first()).toContainText("¥400");

    const report = await api.get<OrderReportsResponse>(`/reports/orders?po=${encodeURIComponent(renamed)}`);
    expect(report.rows.map((row) => [row.id, row.po])).toEqual([[order.id, renamed]]);
    await page.goto(`/reports/orders?po=${encodeURIComponent(renamed)}`);
    await expect(page.getByRole("row").filter({ hasText: renamed })).toHaveCount(1);
    const csv = await downloadReport(page, "CSV");
    expect(csv.text.split("\r\n").filter((line) => line.startsWith(`${renamed},`))).toHaveLength(1);
    expect(csv.text).not.toContain(`${order.po},`);

    await page.goto(`/reports/orders/${encodeURIComponent(renamed)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(renamed);
  });
});

test("phone: the PO number field fits the Edit order dialog and saves", async ({ page, api }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const order = await api.createOrder();
  const renamed = `PO-M-${tag()}`;
  await page.goto(`/orders/${order.po}`);
  await page.getByRole("button", { name: "Edit order" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit order" });
  await expect(poBox(dialog)).toHaveValue(order.po);
  await settled(page);
  const box = await poBox(dialog).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await shot(page, testInfo, "edit-order-po-390.png");

  await poBox(dialog).fill("");
  await dialog.getByRole("button", { name: "Save order" }).click();
  await expect(dialog.getByText("Enter the PO number.")).toBeVisible();
  await shot(page, testInfo, "edit-order-po-empty-390.png");

  await poBox(dialog).fill(renamed);
  await dialog.getByRole("button", { name: "Save order" }).click();
  await expect(page).toHaveURL(`/orders/${renamed}`);
  await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
  expect((await api.order(renamed)).id).toBe(order.id);
  // A narrow field still holds a long number.
  await page.getByRole("button", { name: "Edit order" }).click();
  await expect(poBox(page.getByRole("dialog", { name: "Edit order" }))).toHaveValue(renamed);
  await settled(page);
  await shot(page, testInfo, "edit-order-po-renamed-390.png");
});
