import { ANITA, expect, freshSignIn, test, toast } from "./live-api";

// Deleting deposits and payments (PAY-3) from the order's payments tab and from Deposits & Payments, against the live
// API. Role/label locators only (hidden <Activity> routes stay in the DOM). Each test makes its own order.

test.use({ viewport: { width: 1440, height: 900 } });

test("Management deletes a deposit on the order's tab and a payment on Deposits & Payments; the figures follow", async ({ page, api }) => {
  // ¥1,000 order: a ¥300 deposit at 12 with the order, then a ¥200 balance payment at 12.5.
  const { id, po } = await api.createOrder({ deposits: [{ amountCny: 300, rateInr: 12 }] });
  await api.pay(id, { amountCny: 200, rateInr: 12.5 });
  expect(await api.order(po)).toMatchObject({ paidCny: 500, paidInr: 6100, balanceCny: 500 });

  // The order's tab: Actions last; Cancel sends nothing; a double-click deletes once.
  await page.goto(`/orders/${po}/payments`);
  expect((await page.getByRole("columnheader").allTextContents()).at(-1)).toBe("Actions");
  const deposit = page.getByRole("button", { name: /^Delete deposit of / });
  const ask = page.getByRole("alertdialog", { name: "Delete Deposit?" });
  await deposit.click();
  await expect(ask).toContainText(`Paid so far for ${po} goes from ¥500 to ¥200, and the balance to pay from ¥500 to ¥800.`);
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(ask).toBeHidden();
  const deletes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") deletes.push(new URL(request.url()).pathname);
  });
  await deposit.click();
  await ask.getByRole("button", { name: "Delete deposit" }).dblclick();
  await expect(toast(page, "Deposit deleted").first()).toBeVisible();
  await expect(deposit).toHaveCount(0);
  expect(deletes).toHaveLength(1);
  expect(await api.order(po)).toMatchObject({ paidCny: 200, paidInr: 2500, balanceCny: 800 });

  // Deposits & Payments: the order's card lists its last payment; deleting it leaves none.
  await page.goto("/payments");
  await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
  await page.getByRole("button", { name: po, exact: true }).click();
  await page.getByRole("button", { name: /^Delete payment of / }).click();
  const askPayment = page.getByRole("alertdialog", { name: "Delete Payment?" });
  await expect(askPayment).toContainText("Balance payment");
  await askPayment.getByRole("button", { name: "Delete payment" }).click();
  await expect(toast(page, "Payment deleted").first()).toBeVisible();
  await expect(page.getByText(`No payments recorded for ${po} yet.`)).toBeVisible();
  expect(await api.order(po)).toMatchObject({ paidCny: 0, paidInr: 0, balanceCny: 1000 });
  expect((await api.order(po)).payments).toEqual([]);
});

test.describe("Accounts (payments Enter)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("record payments but see no Delete on either page", async ({ page, api }) => {
    const { po } = await api.createOrder({ deposits: [{ amountCny: 300, rateInr: 12 }] });
    await page.goto(`/orders/${po}/payments`);
    await expect(page.getByRole("columnheader", { name: "In INR" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await page.goto("/payments");
    await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    await page.getByRole("button", { name: po, exact: true }).click();
    await expect(page.getByRole("button", { name: `+ Record payment for ${po}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Delete (deposit|payment)/ })).toHaveCount(0);
  });
});
