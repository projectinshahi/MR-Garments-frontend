import type { Locator, Page } from "@playwright/test";

import type { PaymentsResponse } from "../src/lib/api/types";
import { ANITA, type Api, expect, field, freshSignIn, inr, kpi, num, settled, test, toast, today } from "./live-api";
import { MANAGEMENT_STATE, PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Deposits & Payments (16) against PAY-1 and PAY-2 (Record payment). Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const search = (page: Page) => page.getByRole("searchbox", { name: "Search PO or supplier" });
const rowOf = (page: Page, po: string) => page.getByRole("table").getByRole("row").filter({ hasText: po });
const card = (page: Page, po: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: `${po} payments` }) });
const dialog = (page: Page, name = "Record payment") => page.getByRole("dialog", { name });
const input = (scope: Locator, name: string) => scope.getByRole("textbox", { name, exact: true });
const select = (scope: Locator, name: string) => scope.getByRole("combobox", { name, exact: true });
const paymentsOf = async (api: Api, orderId: string) =>
  (await api.get<PaymentsResponse>("/payments")).payments.filter((p) => p.orderId === orderId);

/** Selects an order's row (the header search narrows the table to it). */
async function openOrder(page: Page, po: string) {
  await search(page).fill(po);
  await rowOf(page, po).getByRole("button", { name: po }).click();
  await expect(page.getByRole("heading", { name: `${po} payments` })).toBeVisible();
}

test("KPIs, the order's row and its payments card, with search and its empty state", async ({ page, api }) => {
  const order = await api.createOrder({
    supplier: "Hangzhou Knits",
    lines: [{ item: "Ladies kurtis", quantity: 500, rateCny: 16 }],
    deposits: [{ amountCny: 2000, rateInr: 12, paidOn: today(-3), mode: "Bank transfer" }],
  });
  const paidInr = (await api.get<PaymentsResponse>("/payments")).orders.reduce((sum, o) => sum + o.paidInr, 0);

  await page.goto("/payments");
  await expect(page.getByRole("heading", { level: 1, name: "Deposits & Payments" })).toBeVisible();
  await expect(kpi(page, "Paid so far (INR)")).toContainText(inr(paidInr));
  // PAY-2 saves payments as paid, so nothing is ever due here.
  await expect(kpi(page, "Due in next 7 days")).toContainText("¥0");
  await expect(kpi(page, "Due in next 30 days")).toContainText("0 payments");

  await openOrder(page, order.po);
  await expect(rowOf(page, order.po).getByRole("cell")).toHaveText([`${order.po}Hangzhou Knits`, "8,000", "2,000", "₹24,000", "6,000", "Not yet due"]);
  const detail = card(page, order.po);
  await expect(detail).toContainText("Hangzhou Knits");
  await expect(detail.getByRole("heading", { name: "1. Deposit" })).toBeVisible();
  await expect(detail).toContainText("Paid");
  await expect(detail).toContainText("¥ 2,000 × 12.00");
  await expect(detail).toContainText("Total for this order");
  await expect(detail).toContainText("Bank transfer");

  // Search by supplier, then one that matches nothing: the card hides until the search clears.
  await search(page).fill("hangzhou knits");
  await expect(rowOf(page, order.po)).toBeVisible();
  await search(page).fill("no such order zzz");
  await expect(page.getByText("No orders match your search.")).toBeVisible();
  await expect(page.getByRole("heading", { name: `${order.po} payments` })).toHaveCount(0);
  await search(page).fill(order.po);
  await expect(page.getByRole("heading", { name: `${order.po} payments` })).toBeVisible();

  // The PO in the card opens the order.
  await detail.getByRole("link", { name: order.po }).click();
  await expect(page).toHaveURL(`/orders/${order.po}`);
});

test("an order without payments says so", async ({ page, api }) => {
  const order = await api.createOrder();
  await page.goto("/payments");
  await openOrder(page, order.po);
  await expect(card(page, order.po)).toContainText(`No payments recorded for ${order.po} yet.`);
  await expect(rowOf(page, order.po).getByRole("cell").nth(2)).toHaveText("0");
});

test("Record payment: opens, cancels, checks every field, and saves a payment that updates the totals", async ({ page, api }) => {
  const order = await api.createOrder({ supplier: "Yiwu Trims Ltd.", lines: [{ item: "Kids t-shirts", quantity: 1000, rateCny: 5 }] });
  await page.goto("/payments");

  // Open and cancel; open and close with Escape.
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  await expect(dialog(page)).toContainText("Record a payment already made against an order.");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  // Every client check.
  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  const form = dialog(page);
  await expect(field(form, "Paid on")).toHaveValue(today());
  await form.getByRole("button", { name: "Record payment" }).click();
  for (const message of ["Choose an order from the list.", "Choose Deposit or Balance.", "Enter an amount above 0.", "Enter an INR rate above 0.", "Enter the payment mode."]) {
    await expect(form.getByText(message)).toBeVisible();
  }
  await field(form, "Paid on").fill(today(1));
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByText("The payment date can't be in the future.")).toBeVisible();
  await field(form, "Paid on").fill("");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByText("Enter the date the payment was made.")).toBeVisible();

  // A valid payment, with the INR worked out as you type.
  await select(form, "Order").selectOption({ label: `${order.po} · Yiwu Trims Ltd.` });
  await expect(select(form, "Paid to")).toHaveValue("supplier");
  await expect(select(form, "Paid to").getByRole("option").first()).toHaveText("Yiwu Trims Ltd. (supplier)");
  await select(form, "Kind").selectOption("Deposit");
  await input(form, "Amount (¥)").fill("1,500");
  await input(form, "Rate (₹ per ¥)").fill("12.5");
  await expect(form.getByRole("status")).toHaveText("₹18,750");
  await field(form, "Paid on").fill(today(-1));
  await input(form, "Mode").fill("  UPI  ");
  await form.getByRole("button", { name: "Record payment" }).click();

  await expect(toast(page, `Payment recorded for ${order.po}`)).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await openOrder(page, order.po);
  await expect(rowOf(page, order.po).getByRole("cell")).toHaveText([`${order.po}Yiwu Trims Ltd.`, "5,000", "1,500", "₹18,750", "3,500", "Not yet due"]);
  await expect(card(page, order.po).getByRole("heading", { name: "1. Deposit" })).toBeVisible();
  await expect(card(page, order.po)).toContainText("UPI");

  expect(await paymentsOf(api, order.id)).toMatchObject([
    { kind: "Deposit", payee: "Yiwu Trims Ltd.", payeeRole: "supplier", amountCny: 1500, rateInr: 12.5, paidOn: today(-1), mode: "UPI", status: "paid" },
  ]);

  // Persisted: after a reload the totals are the same.
  await page.reload();
  await openOrder(page, order.po);
  await expect(rowOf(page, order.po).getByRole("cell").nth(3)).toHaveText("₹18,750");
});

test("the card's button records a payment to a shipping agent for that order", async ({ page, api }) => {
  const order = await api.createOrder({ lines: [{ item: "Men's shorts", quantity: 300, rateCny: 10 }], deposits: [{ amountCny: 1000, rateInr: 12 }] });
  await page.goto("/payments");
  await openOrder(page, order.po);
  await card(page, order.po).getByRole("button", { name: `+ Record payment for ${order.po}` }).click();

  const form = dialog(page, `Record payment for ${order.po}`);
  await expect(input(form, "Order")).toHaveValue(`${order.po} · Foshan Fabrics`);
  await select(form, "Kind").selectOption("Balance");
  await select(form, "Paid to").selectOption({ label: "Dragon Cargo (agent)" });
  await input(form, "Amount (¥)").fill("500");
  await input(form, "Rate (₹ per ¥)").fill("12.25");
  await input(form, "Mode").fill("Cash");
  await form.getByRole("button", { name: "Record payment" }).click();

  await expect(toast(page, `Payment recorded for ${order.po}`)).toBeVisible();
  const detail = card(page, order.po);
  // Numbered oldest first, as in reference 16.
  await expect(detail.getByRole("heading", { level: 3 })).toHaveText(["1. Deposit", "2. Balance"]);
  await expect(detail).toContainText("¥ 500 × 12.25");
  await expect(rowOf(page, order.po).getByRole("cell")).toHaveText([`${order.po}Foshan Fabrics`, "3,000", "1,500", `₹${num(12_000 + 6125)}`, "1,500", "Not yet due"]);
  // PAY-1 lists payments newest first.
  expect((await paymentsOf(api, order.id)).map((p) => [p.kind, p.payee, p.payeeRole])).toEqual([
    ["Balance", "Dragon Cargo", "agent"],
    ["Deposit", "Foshan Fabrics", "supplier"],
  ]);
});

test("a server refusal (422) shows under its field; a failed or lost request keeps the dialog and its values", async ({ page, api }) => {
  const order = await api.createOrder();
  await page.goto("/payments");
  await openOrder(page, order.po);
  await card(page, order.po).getByRole("button", { name: `+ Record payment for ${order.po}` }).click();
  const form = dialog(page, `Record payment for ${order.po}`);
  await select(form, "Kind").selectOption("Balance");
  await input(form, "Amount (¥)").fill("250");
  await input(form, "Rate (₹ per ¥)").fill("12");
  await input(form, "Mode").fill("Cheque");

  // The request reaches PAY-2 with an amount above its limit, so the real API answers 422 on amountCny.
  await page.route("**/api/v1/payments", (route) =>
    route.request().method() === "POST"
      ? route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), amountCny: 1e13 }) })
      : route.fallback(),
  );
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByText("Enter an amount above 0.")).toBeVisible();
  await expect(input(form, "Amount (¥)")).toBeFocused();
  await page.unroute("**/api/v1/payments");

  await page.route("**/api/v1/payments", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong." } } }) : route.fallback(),
  );
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(page, "Something went wrong.").first()).toContainText("Please try again.");
  await page.unroute("**/api/v1/payments");

  await page.route("**/api/v1/payments", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  const failed = page.waitForEvent("requestfailed", (request) => request.url().endsWith("/api/v1/payments"));
  await form.getByRole("button", { name: "Record payment" }).click();
  await failed;
  await expect(toast(page, "Something went wrong.").first()).toBeVisible();
  await page.unroute("**/api/v1/payments");

  await expect(form).toBeVisible();
  await expect(input(form, "Amount (¥)")).toHaveValue("250");
  await expect(input(form, "Mode")).toHaveValue("Cheque");
  expect(await paymentsOf(api, order.id)).toHaveLength(0);
});

test("double-clicking Record payment records one payment", async ({ page, api }) => {
  const order = await api.createOrder();
  await page.goto("/payments");
  await openOrder(page, order.po);
  await card(page, order.po).getByRole("button", { name: `+ Record payment for ${order.po}` }).click();
  const form = dialog(page, `Record payment for ${order.po}`);
  await select(form, "Kind").selectOption("Deposit");
  await input(form, "Amount (¥)").fill("100");
  await input(form, "Rate (₹ per ¥)").fill("12");
  await input(form, "Mode").fill("Cash");
  await form.getByRole("button", { name: "Record payment" }).dblclick();
  await expect(toast(page, `Payment recorded for ${order.po}`).first()).toBeVisible();
  await expect(rowOf(page, order.po).getByRole("cell").nth(2)).toHaveText("100");
  expect(await paymentsOf(api, order.id)).toHaveLength(1);
});

test.describe("Accounts (payments Enter)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("records a payment that Management then sees", async ({ page, api, browser }) => {
    const order = await api.createOrder({ lines: [{ item: "Polo shirts", quantity: 100, rateCny: 30 }] });
    await page.goto("/payments");
    await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
    const form = dialog(page);
    await select(form, "Order").selectOption({ label: `${order.po} · Foshan Fabrics` });
    await select(form, "Kind").selectOption("Balance");
    await input(form, "Amount (¥)").fill("3000");
    await input(form, "Rate (₹ per ¥)").fill("12");
    await input(form, "Mode").fill("Bank transfer");
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(page, `Payment recorded for ${order.po}`)).toBeVisible();

    const management = settled(await browser.newPage({ storageState: MANAGEMENT_STATE, viewport: { width: 1440, height: 900 } }));
    await management.goto("/payments");
    await openOrder(management, order.po);
    await expect(rowOf(management, order.po).getByRole("cell")).toHaveText([`${order.po}Foshan Fabrics`, "3,000", "3,000", "₹36,000", "0", "Not yet due"]);
    await management.close();
  });
});

test.describe("Procurement (payments View)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("sees payments but no Record payment buttons", async ({ page, api }) => {
    const order = await api.createOrder({ deposits: [{ amountCny: 100, rateInr: 12 }] });
    await page.goto("/payments");
    await openOrder(page, order.po);
    await expect(page.getByRole("button", { name: /Record payment/ })).toHaveCount(0);
    await card(page, order.po).getByRole("link", { name: order.po }).click();
    await expect(page).toHaveURL(`/orders/${order.po}`);
  });
});

test.describe("China staff (no payments access)", () => {
  test.use({ storageState: STAFF_STATE });

  test("the payments page goes to the staff home", async ({ page }) => {
    await page.goto("/payments");
    await expect(page).toHaveURL("/home");
  });
});
