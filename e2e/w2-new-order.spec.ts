import type { Page } from "@playwright/test";

import { ANITA, type Api, expect, field, freshSignIn, kv, test, toast, today } from "./live-api";
import { PROCUREMENT_STATE } from "./sessions";

// New order (15) against the live API: ORD-2 for the choices, ORD-3 to place the order. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const combo = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const place = (page: Page) => page.getByRole("button", { name: "Place order" });
const poNumber = (po: string) => Number(po.slice(3));

/** A complete, valid order: Foshan Fabrics, 200 Denim jeans at ¥12.50, delivered in 20 days. */
async function fillValid(page: Page, quantity = "200") {
  await combo(page, "Supplier").selectOption({ label: "Foshan Fabrics" });
  await field(page, "Delivery date").fill(today(20));
  await combo(page, "Item, line 1").selectOption({ label: "Denim jeans" });
  await box(page, "Rate (¥), line 1").fill("12.5");
  await box(page, "Quantity, line 1").fill(quantity);
}

const nextPo = async (api: Api) => (await api.options()).nextPo;

test("the form shows the next PO and fills supplier facts and totals as you type", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");
  await expect(page.getByRole("heading", { level: 1, name: "New order" })).toBeVisible();
  await expect(box(page, "Purchase order no.")).toHaveValue(po);
  await expect(field(page, "Order date")).toHaveValue(today());
  await expect(combo(page, "Currency")).toHaveValue("CNY (¥)");

  await combo(page, "Supplier").selectOption({ label: "Foshan Fabrics" });
  await expect(box(page, "Contact person")).toHaveValue("Mr. Chen Hao");
  await expect(box(page, "Phone")).toHaveValue("+86 137 2288 5501");
  await expect(box(page, "City")).toHaveValue("Foshan");

  await combo(page, "Item, line 1").selectOption({ label: "Denim jeans" });
  await box(page, "Rate (¥), line 1").fill("12.5");
  await box(page, "Quantity, line 1").fill("200");
  await expect(box(page, "Amount (¥), line 1")).toHaveValue("2,500.00");

  await page.getByRole("button", { name: "+ Add item" }).click();
  await combo(page, "Item, line 2").selectOption({ label: "Cotton fabric" });
  await box(page, "Rate (¥), line 2").fill("8");
  await box(page, "Quantity, line 2").fill("500");
  await expect(box(page, "Amount (¥), line 2")).toHaveValue("4,000.00");
  await expect(page.getByRole("status", { name: "Order total" })).toHaveText("¥ 6,500.00");

  await page.getByRole("button", { name: "+ Add deposit" }).click();
  const payee = combo(page, "Paid to, deposit 1");
  await expect(payee.getByRole("option")).toHaveText(["Foshan Fabrics (supplier)", "Sino Freight (agent)", "Dragon Cargo (agent)"]);
  await expect(field(page, "Paid on")).toHaveValue(today());
  await box(page, "Amount (¥), deposit 1").fill("2000");
  await field(page, "Rate to INR").fill("12");
  await field(page, "Mode").fill("Bank transfer");
  await expect(page.getByText("₹24,000").first()).toBeVisible();

  await expect(kv(page, "Order total")).toHaveText("¥ 6,500");
  await expect(kv(page, "Deposits paid")).toHaveText("¥ 2,000");
  await expect(kv(page, "Deposits in INR")).toHaveText("₹24,000");
  await expect(kv(page, "Balance to pay")).toHaveText("¥ 4,500");

  // Cancel goes back to the list and places nothing.
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/orders");
  expect(await nextPo(api)).toBe(po);
});

test("each validation message shows, and nothing is placed", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");

  await place(page).click();
  for (const message of ["Choose a supplier.", "Choose the delivery date.", "Add at least one item."]) {
    await expect(page.getByText(message)).toBeVisible();
  }

  await field(page, "Order date").fill("");
  await place(page).click();
  await expect(page.getByText("Choose the order date.")).toBeVisible();

  await field(page, "Order date").fill(today());
  await field(page, "Delivery date").fill(today(-1));
  await place(page).click();
  await expect(page.getByText("The delivery date can't be before the order date.")).toBeVisible();

  // A line that is only partly filled.
  await combo(page, "Item, line 1").selectOption({ label: "Polo shirts" });
  await box(page, "Quantity, line 1").fill("1.5");
  await place(page).click();
  await expect(page.getByText("Line 1: Enter the rate.")).toBeVisible();
  await expect(page.getByText("Line 1: Enter a whole quantity.")).toBeVisible();
  await box(page, "Rate (¥), line 1").fill("5");
  await box(page, "Quantity, line 1").fill("10");
  await combo(page, "Item, line 1").selectOption({ label: "Select item" });
  await place(page).click();
  await expect(page.getByText("Line 1: Choose an item.")).toBeVisible();

  // A deposit with only an amount.
  await page.getByRole("button", { name: "+ Add deposit" }).click();
  await box(page, "Amount (¥), deposit 1").fill("100");
  await field(page, "Paid on").fill("");
  await place(page).click();
  for (const message of ["Deposit 1: Choose the date paid.", "Deposit 1: Enter the rate.", "Deposit 1: Enter the mode."]) {
    await expect(page.getByText(message)).toBeVisible();
  }

  expect(await nextPo(api)).toBe(po);
});

test("a server refusal (422) shows under its field; a failed or lost request keeps every value", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");
  // ORD-3 caps quantities at the integer column's size; the form only checks for a whole number above 0.
  await fillValid(page, "3000000000");
  await place(page).click();
  await expect(page.getByText("Enter a whole quantity of at least 1.")).toBeVisible();
  await expect(box(page, "Quantity, line 1")).toHaveValue("3000000000");
  await box(page, "Quantity, line 1").fill("200");

  // 500 from the API.
  await page.route("**/api/v1/orders", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong." } } })
      : route.fallback(),
  );
  await place(page).click();
  await expect(toast(page, "Something went wrong.")).toContainText("Please try again.");
  await expect(combo(page, "Supplier")).toHaveValue(/.+/);
  await expect(box(page, "Rate (¥), line 1")).toHaveValue("12.5");
  await expect(place(page)).toBeEnabled();
  await page.unroute("**/api/v1/orders");

  // The request never reaches the API (network failure).
  await page.route("**/api/v1/orders", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  const failed = page.waitForEvent("requestfailed", (request) => request.url().endsWith("/api/v1/orders"));
  await place(page).click();
  await failed;
  await expect(toast(page, "Something went wrong.").first()).toBeVisible();
  await expect(box(page, "Quantity, line 1")).toHaveValue("200");
  await page.unroute("**/api/v1/orders");

  expect(await nextPo(api)).toBe(po);
});

test("placing an order goes to its detail page, saves it, and the next visit starts a fresh form", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");
  await fillValid(page);
  await page.getByRole("button", { name: "+ Add deposit" }).click();
  await box(page, "Amount (¥), deposit 1").fill("1000");
  await field(page, "Rate to INR").fill("12.2");
  await field(page, "Mode").fill("Wire");
  await place(page).click();

  await expect(toast(page, `Order ${po} placed`)).toBeVisible();
  await expect(page).toHaveURL(`/orders/${po}`);
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();

  const saved = await api.order(po);
  expect(saved).toMatchObject({ stage: 1, supplier: { name: "Foshan Fabrics" }, orderDate: today(), deliveryDate: today(20), orderValueCny: 2500, paidCny: 1000, paidInr: 12_200 });
  expect(saved.lines).toMatchObject([{ item: { name: "Denim jeans" }, quantity: 200, rateCny: 12.5 }]);
  expect(saved.payments).toMatchObject([{ kind: "Deposit", payee: "Foshan Fabrics", payeeRole: "supplier", amountCny: 1000, rateInr: 12.2, mode: "Wire", status: "paid" }]);

  // Back to the list and in again: the kept (Activity) route shows an empty form with the next PO.
  await page.getByRole("link", { name: "Orders", exact: true }).first().click();
  await page.getByRole("link", { name: "+ New order" }).click();
  await expect(page).toHaveURL("/orders/new");
  await expect(box(page, "Purchase order no.")).toHaveValue(`PO-${poNumber(po) + 1}`);
  await expect(combo(page, "Supplier")).toHaveValue("");
  await expect(box(page, "Rate (¥), line 1")).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Paid to, deposit 1" })).toHaveCount(0);
});

test("double-clicking Place order places one order", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");
  await fillValid(page);
  await place(page).dblclick();
  await expect(page).toHaveURL(`/orders/${po}`);
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
  expect(await nextPo(api)).toBe(`PO-${poNumber(po) + 1}`);
});

test.describe("Procurement (orders Enter)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("places an order", async ({ page, api }) => {
    const po = await nextPo(api);
    await page.goto("/orders/new");
    await fillValid(page);
    await place(page).click();
    await expect(page).toHaveURL(`/orders/${po}`);
    expect((await api.order(po)).supplier.name).toBe("Foshan Fabrics");
  });
});

test.describe("Accounts (orders View)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("gets no form", async ({ page }) => {
    await page.goto("/orders/new");
    await expect(page.getByRole("heading", { level: 1, name: "New order" })).toBeVisible();
    await expect(page.getByText("You don't have access to do that.")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Supplier" })).toHaveCount(0);
  });
});
