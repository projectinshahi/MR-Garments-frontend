import type { PaymentsResponse } from "../src/lib/api/types";
import { ANITA, expect, freshSignIn, test, toast } from "./live-api";

// Voiding payments (PAY-3 after the unified supplier ledger): a payment is never deleted, only voided with a reason by
// Management. The row stays, flagged, and leaves every total; a supplier payment's void takes it off the supplier's
// account and the orders settle again from what is left. Role/label locators only. Each test makes its own supplier.

test.use({ viewport: { width: 1440, height: 900 } });

test("Management voids a supplier payment on Payments: reason required, once on a double-click, the order settles again", async ({ page, api }) => {
  // ¥1,000 order, received in full (an order is worth what is received); ¥300 at 12 and ¥200 at 12.5 paid to the
  // supplier's account: settled ¥500, outstanding ¥500.
  const supplier = await api.newSupplier("Void Ledger");
  const { po } = await api.createReceivedOrder({ supplier: supplier.name });
  await api.paySupplier(supplier.id, { amount: 300, rateInr: 12, reference: "TXN-V300" });
  const { payment } = await api.paySupplier(supplier.id, { amount: 200, rateInr: 12.5, reference: "TXN-V200" });
  expect(await api.order(po)).toMatchObject({ settledCny: 500, outstandingCny: 500, paymentStatus: "partly", paidInr: 6100 });

  await page.goto("/payments");
  await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(supplier.name);
  const table = page.getByRole("table").first();
  expect((await table.getByRole("columnheader").allTextContents()).at(-1)).toBe("Actions");
  const row = table.getByRole("row").filter({ hasText: "TXN-V200" });
  const ask = page.getByRole("dialog", { name: "Void payment?" });

  // Cancel sends nothing; a blank reason is refused in the dialog.
  await row.getByRole("button", { name: /^Void payment of .*¥200/ }).click();
  await expect(ask).toContainText(`A void entry takes ¥200.00 off ${supplier.name}'s CNY account`);
  await expect(ask).toContainText("None (supplier account)");
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(ask).toBeHidden();
  const voids: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") voids.push(new URL(request.url()).pathname);
  });
  await row.getByRole("button", { name: /^Void payment of / }).click();
  await ask.getByRole("button", { name: "Void payment" }).click();
  await expect(ask.getByText("Enter the reason for voiding this payment.")).toBeVisible();
  expect(voids).toHaveLength(0);

  await ask.getByRole("textbox", { name: "Reason" }).fill("Entered twice");
  await ask.getByRole("button", { name: "Void payment" }).dblclick();
  const done = page.getByRole("dialog", { name: "Payment voided" });
  await expect(done).toContainText(`${supplier.name}'s CNY account: Payable to supplier ¥500.00 before, Payable to supplier ¥700.00 after.`);
  await expect(toast(page, "Payment voided").first()).toBeVisible();
  expect(voids).toEqual([`/api/v1/payments/${payment.id}`]);
  await done.getByRole("button", { name: "Close" }).first().click(); // the footer button (the corner X is also "Close")

  // Listed, flagged, no Void any more; the order settles again from the ¥300 left.
  await expect(row.getByText("Voided", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: /^Void payment of / })).toHaveCount(0);
  expect(await api.order(po)).toMatchObject({ settledCny: 300, outstandingCny: 700, paymentStatus: "partly", paidInr: 3600 });
  const voided = (await api.get<PaymentsResponse>("/payments")).payments.find((p) => p.id === payment.id)!;
  expect(voided).toMatchObject({ voided: true, voidReason: "Entered twice", voidedBy: "Suresh Menon" });

  // A second void of the same payment is refused and writes nothing.
  const again = await api.request.delete(`/api/v1/payments/${payment.id}`, { data: { reason: "Again" } });
  expect(again.status()).toBe(409);
});

test("Management voids a sea freight payment on the order's tab: the order keeps its settlement, sea freight drops", async ({ page, api }) => {
  const supplier = await api.newSupplier("Void Freight");
  const { id, po } = await api.createReceivedOrder({ supplier: supplier.name });
  await api.paySupplier(supplier.id, { amount: 400, rateInr: 12 });
  await api.payAgent(id, { amountCny: 150, rateInr: 12, kind: "Deposit" });
  expect(await api.order(po)).toMatchObject({ settledCny: 400, agentPaidCny: 150 });

  await page.goto(`/orders/${po}/payments`);
  const recorded = page.locator("section").filter({ has: page.getByRole("heading", { name: `Recorded against ${po}` }) });
  expect((await recorded.getByRole("columnheader").allTextContents()).at(-1)).toBe("Actions");
  await recorded.getByRole("button", { name: /^Void payment of / }).click();
  const ask = page.getByRole("dialog", { name: "Void payment?" });
  await expect(ask).toContainText("It is a sea freight payment, so the supplier's account doesn't change.");
  await ask.getByRole("textbox", { name: "Reason" }).fill("Wrong agent");
  await ask.getByRole("button", { name: "Void payment" }).click();
  await expect(page.getByRole("dialog", { name: "Payment voided" })).toContainText("The order's sea freight and the INR total no longer count it.");
  await page.getByRole("dialog", { name: "Payment voided" }).getByRole("button", { name: "Close" }).first().click(); // the footer button (the corner X is also "Close")
  await expect(recorded.getByText("Voided", { exact: true })).toBeVisible();
  expect(await api.order(po)).toMatchObject({ settledCny: 400, agentPaidCny: 0 });
});

test.describe("Accounts (payments Enter)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("records payments but sees no Void on either page", async ({ page, api }) => {
    const supplier = await api.newSupplier("Void Accounts");
    const { id, po } = await api.createOrder({ supplier: supplier.name });
    await api.paySupplier(supplier.id, { amount: 300, rateInr: 12 });
    await api.payAgent(id, { amountCny: 100, rateInr: 12 });
    await page.goto(`/orders/${po}/payments`);
    await expect(page.getByRole("columnheader", { name: "In INR" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await page.goto("/payments");
    await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    await page.getByRole("button", { name: po, exact: true }).click();
    await expect(page.getByRole("button", { name: `+ Record payment for ${supplier.name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Void payment of / })).toHaveCount(0);
    await expect(page.getByRole("table").first().getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    // The API refuses too.
    const payment = (await api.get<PaymentsResponse>("/payments")).payments.find((p) => p.supplierId === supplier.id && p.payeeRole === "supplier")!;
    expect((await page.request.delete(`/api/v1/payments/${payment.id}`, { data: { reason: "x" }, headers: { Origin: new URL(page.url()).origin } })).status()).toBe(403);
  });
});
