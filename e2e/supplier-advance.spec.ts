import type { Locator, Page, TestInfo } from "@playwright/test";

import type { SupplierRow } from "../src/lib/api/types";
import { type Api, expect, field, kpi, test, toast } from "./live-api";

// Supplier advance (backend docs/supplier-advance.md) against the live API: the Deposits › Supplier advance tab
// (supplier choice, Add advance with its checks, the ledger and its filters), automatic allocation on a new order
// (partial), the return when an order is deleted, the New order preview, the order pages' breakdown and warning, Apply
// advance (ADV-4) for an advance recorded after the order, and the advance a direct payment gives back, on desktop and
// phones. Screenshots go to SHOTS_DIR (full page) when set. A new supplier per run keeps the balances apart.

const tag = () => String(Date.now()).slice(-6);
const shot = (page: Page, testInfo: TestInfo, name: string, fullPage = true) =>
  page.screenshot({ path: process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name), fullPage });
/** Waits for the dialog's open animation, so its screenshot is not caught mid-fade. */
const settled = (dialog: Locator) => dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)));
const noSideScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "page scrolls sideways").toBeLessThanOrEqual(0);

/** A CNY supplier at ¥1 = ₹12.50 with its own advance account (never deleted: advance records keep it). */
async function newSupplier(api: Api) {
  const response = await api.post("/suppliers", { name: `Advance Supply ${tag()}`, currency: "CNY", exchangeRate: 12.5 });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { supplier: SupplierRow }).supplier;
}
const addAdvance = async (api: Api, supplierId: string, amount: number) =>
  expect((await api.post(`/suppliers/${supplierId}/advances`, { amount, paidOn: new Date().toISOString().slice(0, 10), rateInr: 12.5, mode: "Bank transfer" })).status()).toBe(201);
// The ledger is the page's last table (the "Orders still to pay" table, when shown, comes before it).
const ledgerRows = (page: Page) => page.getByRole("table").last().getByRole("row").filter({ hasNot: page.getByRole("columnheader") });

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("advance tab, automatic partial allocation, return on delete, order breakdown and warning", async ({ page, api }, testInfo) => {
    test.setTimeout(180_000);
    const supplier = await newSupplier(api);

    await test.step("open the supplier from the supplier-wise tab", async () => {
      await page.goto("/deposits/advance");
      await expect(page.getByRole("link", { name: /Supplier advance/ })).toHaveAttribute("aria-current", "page");
      await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
      await expect(page.getByRole("row", { name: new RegExp(supplier.name) })).toContainText("No advance yet");
      await page.getByRole("link", { name: supplier.name, exact: true }).click();
      await expect(page).toHaveURL(`/deposits/advance/${supplier.id}`);
      await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
      await expect(page.getByText("No advance recorded for this supplier yet.")).toBeVisible();
    });

    await test.step("Add advance: checks, then saves without an order", async () => {
      await page.getByRole("button", { name: "+ Add advance" }).first().click();
      const dialog = page.getByRole("dialog", { name: `Add advance for ${supplier.name}` });
      await expect(field(dialog, /^Rate/)).toHaveValue("12.5");
      await dialog.getByRole("button", { name: "Add advance" }).click();
      await expect(dialog.getByText("Enter an amount above 0, with at most 2 decimals.")).toBeVisible();
      await expect(dialog.getByText("Enter the payment mode.")).toBeVisible();
      await field(dialog, /^Amount/).fill("3000");
      await field(dialog, /^Payment mode/).fill("Bank transfer");
      await field(dialog, /^Reference/).fill("UTR-ADV-1");
      await expect(dialog.getByText("₹37,500")).toBeVisible();
      await shot(page, testInfo, "add-advance-dialog-1440.png", false);
      await dialog.getByRole("button", { name: "Add advance" }).click();
      await expect(toast(page, "Advance added")).toBeVisible();
      await expect(kpi(page, "Available balance")).toContainText("¥3,000");
    });

    let po = "";
    let coveredPo = "";
    await test.step("orders draw on it: a covered order deleted gives it back; a bigger one is covered in part", async () => {
      const covered = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
      coveredPo = covered.po;
      expect((await api.order(covered.po)).advanceStatus).toBe("full");
      expect((await api.request.delete(`/api/v1/orders/${encodeURIComponent(covered.po)}`, { data: {} })).status()).toBe(204);
      po = (await api.createOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 500, rateCny: 10 }] })).po;
      const order = await api.order(po);
      expect(order).toMatchObject({ orderValueCny: 5000, advanceCny: 3000, balanceCny: 2000, advanceStatus: "partial" });
    });

    await test.step("the ledger: received, applied, returned, applied; filters narrow it", async () => {
      await page.reload();
      await expect(kpi(page, "Available balance")).toContainText("¥0");
      // Applied net: ¥4,000 applied, ¥1,000 back from the deleted order.
      await expect(kpi(page, "Applied to orders (net)")).toContainText("¥3,000");
      await expect(kpi(page, "Applied to orders (net)")).toContainText("after ¥1,000 returned from orders");
      await expect(page.getByRole("row", { name: /^CNY/ })).toContainText("¥3,000¥0¥0¥4,000¥1,000¥3,000¥0");
      await expect(ledgerRows(page)).toHaveCount(4);
      await expect(ledgerRows(page).first()).toContainText("Applied to order");
      await expect(ledgerRows(page).nth(1)).toContainText("Returned from order");
      await expect(ledgerRows(page).nth(1)).toContainText("order deleted");
      await shot(page, testInfo, "advance-history-1440.png");
      await page.getByRole("button", { name: /^Transaction type:/ }).click();
      await page.getByRole("menuitemradio", { name: "Applied to order" }).click();
      await expect(ledgerRows(page)).toHaveCount(2);
      // A deleted order's PO number may go to the next order: then both orders' rows match it.
      await page.getByRole("searchbox", { name: "Search reference or PO" }).fill(po);
      await expect(ledgerRows(page)).toHaveCount(coveredPo === po ? 2 : 1);
      await page.getByRole("button", { name: "Clear filters" }).click();
      await expect(ledgerRows(page)).toHaveCount(4);
      await shot(page, testInfo, "deposits-advance-tab-1440.png", false);
    });

    await test.step("order pages: the breakdown and the partial warning", async () => {
      await page.goto(`/orders/${encodeURIComponent(po)}`);
      await expect(page.getByRole("status").filter({ hasText: "Supplier advance was not enough." })).toContainText("¥2,000.00 is still to be paid");
      await expect(page.getByRole("heading", { name: "Supplier advance" })).toBeVisible();
      await shot(page, testInfo, "order-overview-advance-1440.png");
      await page.goto(`/orders/${encodeURIComponent(po)}/payments`);
      await expect(kpi(page, "Advance applied")).toContainText("¥3,000");
      await expect(page.getByText(/Applied to order · ¥3,000.00 at 1 CNY = ₹12.50/)).toBeVisible();
      await shot(page, testInfo, "order-payments-advance-1440.png");
    });

    await test.step("New order: the preview says the advance is not enough", async () => {
      await addAdvance(api, supplier.id, 1000);
      await page.goto("/orders/new");
      await page.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: supplier.name });
      await page.getByRole("combobox", { name: "Item, line 1", exact: true }).selectOption({ label: "Denim jeans" });
      await page.getByRole("textbox", { name: "Rate (¥), line 1", exact: true }).fill("10");
      await page.getByRole("textbox", { name: "Quantity, line 1", exact: true }).fill("400");
      await expect(page.getByRole("status").filter({ hasText: "Supplier advance is not enough." })).toContainText("will still be to pay");
      await shot(page, testInfo, "new-order-partial-warning-1440.png");
      await page.getByRole("textbox", { name: "Quantity, line 1", exact: true }).fill("50");
      await expect(page.getByRole("status").filter({ hasText: "supplier advance available" })).toBeVisible();
    });

    await test.step("an advance recorded after the order: Apply advance from the tab's open orders", async () => {
      // The ¥1,000 added above came after the order (balance ¥2,000), so nothing applied it yet. The older
      // ?supplier= address still leads to the supplier's page.
      await page.goto(`/deposits/advance?supplier=${supplier.id}`);
      await expect(page).toHaveURL(`/deposits/advance/${supplier.id}`);
      await expect(page.getByRole("heading", { name: "Orders still to pay" })).toBeVisible();
      const openOrders = page.locator("section").filter({ has: page.getByRole("heading", { name: "Orders still to pay" }) });
      await expect(openOrders.getByRole("row", { name: new RegExp(po) })).toContainText("¥2,000");
      await shot(page, testInfo, "advance-open-orders-1440.png");
      await page.getByRole("button", { name: `Apply supplier advance to ${po}` }).click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toContainText("¥1,000.00 of the supplier's ¥1,000.00 available advance will be applied to this order. ¥1,000.00 will still be to pay.");
      await settled(confirm);
      await shot(page, testInfo, "apply-advance-dialog-1440.png", false);
      await confirm.getByRole("button", { name: "Apply ¥1,000.00" }).click();
      await expect(toast(page, `¥1,000.00 of supplier advance applied to ${po}`)).toBeVisible();
      await expect(kpi(page, "Available balance")).toContainText("¥0");
      expect(await api.order(po)).toMatchObject({ advanceCny: 4000, balanceCny: 1000, advanceStatus: "partial" });
    });

    await test.step("Apply advance on the order's Payments tab; a direct payment then gives back what it covers", async () => {
      await addAdvance(api, supplier.id, 500);
      await page.goto(`/orders/${encodeURIComponent(po)}/payments`);
      await expect(page.getByText("¥500.00 of supplier advance is available.")).toBeVisible();
      await shot(page, testInfo, "order-payments-apply-advance-1440.png");
      await page.getByRole("button", { name: `Apply supplier advance to ${po}` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Apply ¥500.00" }).click();
      await expect(toast(page, `¥500.00 of supplier advance applied to ${po}`)).toBeVisible();
      await expect(kpi(page, "Advance applied")).toContainText("¥4,500");
      await expect(page.getByRole("button", { name: `Apply supplier advance to ${po}` })).toHaveCount(0);
      // ¥800 paid directly covers ¥300 more than the ¥500 left: ¥300 of the advance goes back to the supplier's account.
      await api.pay((await api.order(po)).id, { amountCny: 800, rateInr: 12.5 });
      expect(await api.order(po)).toMatchObject({ supplierPaidCny: 800, advanceCny: 4200, balanceCny: 0, advanceStatus: "full" });
      await page.reload();
      await expect(kpi(page, "Advance applied")).toContainText("¥4,200");
      await shot(page, testInfo, "order-payments-after-direct-payment-1440.png");
    });
  });

  test("supplier-wise: each supplier on its own row, currencies apart; supplier deposits and agent payments never count", async ({ page, api }, testInfo) => {
    test.setTimeout(120_000);
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    // Two currencies for one supplier: CNY advance and order, then its currency changes to USD and a USD advance.
    const mixed = await newSupplier(api);
    await addAdvance(api, mixed.id, 3000);
    const order = await api.createOrder({ supplier: mixed.name, lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
    expect((await api.patch(`/suppliers/${mixed.id}`, { currency: "USD", exchangeRate: 84 })).status()).toBe(200);
    expect((await api.post(`/suppliers/${mixed.id}/advances`, { amount: 500, paidOn: today, rateInr: 84, mode: "Bank transfer", reference: "USD-ADV" })).status()).toBe(201);
    const single = await newSupplier(api);
    await addAdvance(api, single.id, 2000);
    const none = await newSupplier(api);
    // Separate records that must not move any advance figure: a supplier deposit and an agent payment on the order.
    expect((await api.post(`/suppliers/${mixed.id}/deposits`, { direction: "give", amount: 700, openedOn: today, reference: "", notes: "" })).status()).toBe(201);
    const agent = (await api.options()).agents[0]!;
    await api.pay(order.id, { amountCny: 50, rateInr: 12.5, payeeRole: "agent", agentId: agent.id });

    await page.goto("/deposits/advance");
    await page.getByRole("button", { name: /^Show:/ }).click();
    await page.getByRole("menuitemradio", { name: "With an advance" }).click();
    const row = (name: string) => page.getByRole("row", { name: new RegExp(name) });
    // Recorded ¥3,000 and $500; applied ¥1,000 and $0; available ¥2,000 and $500: never added together.
    await expect(row(mixed.name)).toContainText("CNY · USD · 1 order used it");
    await expect(row(mixed.name)).toContainText("¥3,000$500¥1,000$0¥2,000$500");
    await expect(row(single.name)).toContainText("¥2,000¥0¥2,000");
    await expect(row(none.name)).toHaveCount(0);
    await shot(page, testInfo, "advance-overview-1440.png");

    await row(mixed.name).getByRole("link", { name: `Open ${mixed.name}'s advance` }).click();
    await expect(page).toHaveURL(`/deposits/advance/${mixed.id}`);
    await expect(kpi(page, "Advance recorded")).toContainText("¥3,000 · $500");
    await expect(kpi(page, "Available balance")).toContainText("¥2,000 · $500");
    await expect(page.getByRole("row", { name: /^CNY/ })).toContainText("¥3,000¥0¥0¥1,000¥0¥1,000¥2,000");
    await expect(page.getByRole("row", { name: /^USD/ })).toContainText("$500$0$0$0$0$0$500");
    await expect(ledgerRows(page)).toHaveCount(3);
    await expect(ledgerRows(page).filter({ hasText: "USD-ADV" })).toContainText("1 USD = ₹84.00");
    await shot(page, testInfo, "advance-supplier-1440.png");

    await page.getByRole("link", { name: "Supplier advance" }).click();
    await expect(page).toHaveURL("/deposits/advance");
    // A supplier without an advance: its page offers Add advance in the empty history.
    await page.goto(`/deposits/advance/${none.id}`);
    await expect(page.getByText("No advance recorded for this supplier yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add advance" })).toHaveCount(2);
    await shot(page, testInfo, "advance-supplier-empty-1440.png");
  });

  test("a deposit entered on New order is the supplier's advance, applied to its order and counted once", async ({ page, api }, testInfo) => {
    test.setTimeout(120_000);
    const supplier = await newSupplier(api);
    // ¥3,000 order with a ¥1,200 deposit at ₹12.40 entered with it (ORD-3).
    const { po } = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 300, rateCny: 10 }], deposits: [{ amountCny: 1200, rateInr: 12.4 }] });
    expect(await api.order(po)).toMatchObject({ supplierPaidCny: 1200, advanceCny: 0, balanceCny: 1800 });

    await page.goto("/deposits/advance");
    await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
    const row = page.getByRole("row", { name: new RegExp(supplier.name) });
    // Recorded ¥1,200, applied ¥1,200 (to its own order), available ¥0: nothing to enter again through Add advance.
    await expect(row).toContainText("CNY · 1 order used it");
    await expect(row).toContainText("¥1,200¥1,200¥0");
    await shot(page, testInfo, "order-deposit-overview-1440.png");

    await row.getByRole("link", { name: supplier.name, exact: true }).click();
    await expect(kpi(page, "Advance recorded")).toContainText("¥1,200");
    await expect(kpi(page, "Advance recorded")).toContainText("¥0 added · ¥1,200 order deposits");
    await expect(kpi(page, "Available balance")).toContainText("¥0");
    const deposit = ledgerRows(page).filter({ hasText: "Order deposit" });
    await expect(deposit).toHaveCount(1);
    await expect(deposit).toContainText(po);
    await expect(deposit).toContainText("Paid with the order");
    await expect(deposit).toContainText("1 CNY = ₹12.40");
    await expect(deposit).toContainText("₹14,880.00");

    // An advance added later goes to the order's remaining ¥1,800 only (Apply advance), never to the deposit's part.
    await addAdvance(api, supplier.id, 2000);
    expect((await api.post(`/orders/${encodeURIComponent(po)}/advance`, {})).status()).toBe(200);
    expect(await api.order(po)).toMatchObject({ supplierPaidCny: 1200, advanceCny: 1800, balanceCny: 0 });
    await page.reload();
    await expect(kpi(page, "Advance recorded")).toContainText("¥3,200");
    await expect(kpi(page, "Applied to orders (net)")).toContainText("¥3,000");
    await expect(kpi(page, "Available balance")).toContainText("¥200");
    await expect(page.getByRole("row", { name: /^CNY/ })).toContainText("¥2,000¥0¥1,200¥1,800¥0¥3,000¥200");
    await expect(ledgerRows(page)).toHaveCount(3);
    await shot(page, testInfo, "order-deposit-supplier-1440.png");
  });

  test("a payment beyond the order value settles the order and the excess becomes available advance", async ({ page, api }, testInfo) => {
    test.setTimeout(120_000);
    const supplier = await newSupplier(api);
    expect((await api.patch(`/suppliers/${supplier.id}`, { currency: "USD", exchangeRate: 100 })).status()).toBe(200);
    // $8,350 order paid $8,620.14 at ₹102.25: $8,350 settles it, $270.14 is the supplier's available advance.
    const { po, id } = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 835, rateCny: 10 }] });
    await api.pay(id, { amountCny: 8620.14, rateInr: 102.25, mode: "Wire", reference: "UTR-9" });
    expect(await api.order(po)).toMatchObject({ supplierPaidCny: 8350, excessCny: 270.14, balanceCny: 0 });

    await page.goto("/deposits/advance");
    await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
    const row = page.getByRole("row", { name: new RegExp(supplier.name) });
    await expect(row).toContainText("$270.14$0$270.14");
    await shot(page, testInfo, "excess-overview-1440.png");
    await row.getByRole("link", { name: supplier.name, exact: true }).click();
    await expect(kpi(page, "Available balance")).toContainText("$270.14");
    await expect(kpi(page, "Advance recorded")).toContainText("$0 added · $270.14 excess");
    const excess = ledgerRows(page).filter({ hasText: "Excess payment" });
    await expect(excess).toContainText(po);
    await expect(excess).toContainText("Paid beyond the order value · UTR-9 · Wire");
    await expect(excess).toContainText("1 USD = ₹102.25");
    await expect(excess).toContainText("₹27,621.82");
    await shot(page, testInfo, "excess-supplier-1440.png");

    await page.goto(`/orders/${encodeURIComponent(po)}/payments`);
    await expect(kpi(page, "Paid to supplier")).toContainText("$8,350");
    // Whole units, as the other tiles on the tab.
    await expect(kpi(page, "Excess to supplier advance")).toContainText("$270");
    await expect(kpi(page, "Balance to supplier")).toContainText("$0");
    await shot(page, testInfo, "excess-order-payments-1440.png");
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test.describe(`phone ${viewport.width}`, () => {
    test.use({ viewport });

    test(`advance tab, Add advance dialog and order pages fit ${viewport.width} px`, async ({ page, api }, testInfo) => {
      test.setTimeout(120_000);
      const supplier = await newSupplier(api);
      await addAdvance(api, supplier.id, 3000);
      // With a ¥500 deposit entered on the order: it shows in the supplier's advance history too.
      const { po } = await api.createOrder({ supplier: supplier.name, lines: [{ item: "Denim jeans", quantity: 500, rateCny: 10 }], deposits: [{ amountCny: 500, rateInr: 12.5 }] });
      const w = viewport.width;

      // Recorded after the order: the order is listed as still to pay, with Apply advance.
      await addAdvance(api, supplier.id, 1000);

      // The supplier-wise tab, then the supplier's page from its row.
      await page.goto("/deposits/advance");
      await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
      await noSideScroll(page);
      await shot(page, testInfo, `advance-overview-${w}.png`);
      await page.getByRole("link", { name: supplier.name, exact: true }).click();
      await expect(page).toHaveURL(`/deposits/advance/${supplier.id}`);
      await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
      await expect(page.getByRole("button", { name: `Apply supplier advance to ${po}` })).toBeAttached();
      await expect(ledgerRows(page).filter({ hasText: "Order deposit" })).toHaveCount(1);
      await noSideScroll(page);
      await shot(page, testInfo, `advance-supplier-${w}.png`);

      await page.getByRole("button", { name: "+ Add advance" }).click();
      const dialog = page.getByRole("dialog", { name: `Add advance for ${supplier.name}` });
      const save = dialog.getByRole("button", { name: "Add advance" });
      // The footer stays on screen; the body scrolls inside the dialog (shared DialogContent).
      await expect(save).toBeInViewport();
      const box = await dialog.boundingBox();
      expect(box!.height).toBeLessThanOrEqual(viewport.height);
      await shot(page, testInfo, `add-advance-dialog-${w}.png`, false);
      await field(dialog, /^Notes/).scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport();
      await dialog.getByRole("button", { name: "Cancel" }).click();

      await page.goto(`/orders/${encodeURIComponent(po)}`);
      await expect(page.getByRole("status").filter({ hasText: "Supplier advance was not enough." })).toBeVisible();
      await noSideScroll(page);
      await shot(page, testInfo, `order-overview-advance-${w}.png`);
      await page.goto(`/orders/${encodeURIComponent(po)}/payments`);
      await expect(kpi(page, "Advance applied")).toContainText("¥3,000");
      await noSideScroll(page);
      await shot(page, testInfo, `order-payments-advance-${w}.png`);
      const apply = page.getByRole("button", { name: `Apply supplier advance to ${po}` });
      await apply.scrollIntoViewIfNeeded();
      await apply.click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm.getByRole("button", { name: "Apply ¥1,000.00" })).toBeInViewport();
      expect((await confirm.boundingBox())!.height).toBeLessThanOrEqual(viewport.height);
      await settled(confirm);
      await shot(page, testInfo, `apply-advance-dialog-${w}.png`, false);
      await confirm.getByRole("button", { name: "Cancel" }).click();
    });
  });
}
