import type { Page } from "@playwright/test";

import { ANITA, type Api, expect, field, freshSignIn, kv, num, test, toast, today } from "./live-api";
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
/** ORD-2's signed ledger balance of a supplier in yuan (no account yet: 0). */
const balanceOf = async (api: Api, supplier: string) => (await api.options()).suppliers.find((s) => s.name === supplier)!.ledgerBalance?.find((b) => b.currency === "CNY")?.balanceCny ?? 0;
/** The app's wording of a signed balance (src/features/payments/money.tsx balanceText). */
const balanceText = (balance: number) => (balance === 0 ? "Settled" : `${balance > 0 ? "Available with supplier" : "Payable to supplier"} ¥${num(Math.abs(balance), 2)}`);

test("the form shows the next PO and fills supplier facts, totals and the supplier balance as you type", async ({ page, api }) => {
  const po = await nextPo(api);
  const balance = await balanceOf(api, "Foshan Fabrics");
  await page.goto("/orders/new");
  await expect(page.getByRole("heading", { level: 1, name: "New order" })).toBeVisible();
  await expect(box(page, "Purchase order no.")).toHaveValue(po);
  await expect(field(page, "Order date")).toHaveValue(today());
  // The order is in its supplier's currency: a read-only field, yuan until a supplier is chosen (docs/supplier-currency.md).
  await expect(box(page, "Currency")).toHaveValue("CNY (¥)");
  await expect(box(page, "Currency")).toHaveJSProperty("readOnly", true);

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
  await expect(page.getByRole("status", { name: "PO value" })).toHaveText("¥ 6,500.00");

  // No deposits on the order (supplier money is recorded with Record payment): the supplier's balance before and after.
  await expect(page.getByRole("button", { name: "+ Add deposit" })).toHaveCount(0);
  await expect(kv(page, "PO value")).toHaveText("¥ 6,500.00");
  await expect(kv(page, "Supplier balance now")).toHaveText(balanceText(balance));
  // An order is worth what is received (owner rule of 2026-11-23): placing it changes no balance.
  await expect(kv(page, "Supplier balance after this order")).toHaveText(balanceText(balance));
  await expect(page.getByText("A milestone, not a payment. Record what the supplier was paid with Record payment.")).toBeVisible();

  // Cancel goes back to the list and places nothing.
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/orders");
  expect(await nextPo(api)).toBe(po);
});

test("each validation message shows, and nothing is placed", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");

  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();
  for (const message of ["Choose a supplier.", "Choose the delivery date.", "Add at least one item."]) {
    await expect(page.getByText(message)).toBeVisible();
  }

  await field(page, "Order date").fill("");
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();
  await expect(page.getByText("Choose the order date.")).toBeVisible();

  await field(page, "Order date").fill(today());
  await field(page, "Delivery date").fill(today(-1));
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();
  await expect(page.getByText("The delivery date can't be before the order date.")).toBeVisible();

  // A line that is only partly filled.
  await combo(page, "Item, line 1").selectOption({ label: "Polo shirts" });
  await box(page, "Quantity, line 1").fill("1.5");
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();
  await expect(page.getByText("Line 1: Enter the rate.")).toBeVisible();
  await expect(page.getByText("Line 1: Enter a whole quantity.")).toBeVisible();
  await box(page, "Rate (¥), line 1").fill("5");
  await box(page, "Quantity, line 1").fill("10");
  await combo(page, "Item, line 1").selectOption({ label: "Select item" });
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();
  await expect(page.getByText("Line 1: Choose an item.")).toBeVisible();

  expect(await nextPo(api)).toBe(po);
});

test("a server refusal (422) shows under its field; a failed or lost request keeps every value", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");
  // ORD-3 caps quantities at the integer column's size; the form only checks for a whole number above 0.
  await fillValid(page, "3000000000");
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
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
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();
  await expect(toast(page, "Something went wrong.")).toContainText("Please try again.");
  await expect(combo(page, "Supplier")).toHaveValue(/.+/);
  await expect(box(page, "Rate (¥), line 1")).toHaveValue("12.5");
  await expect(place(page)).toBeEnabled();
  await page.unroute("**/api/v1/orders");

  // The request never reaches the API (network failure).
  await page.route("**/api/v1/orders", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  const failed = page.waitForEvent("requestfailed", (request) => request.url().endsWith("/api/v1/orders"));
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();
  await failed;
  await expect(toast(page, "Something went wrong.").first()).toBeVisible();
  await expect(box(page, "Quantity, line 1")).toHaveValue("200");
  await page.unroute("**/api/v1/orders");

  expect(await nextPo(api)).toBe(po);
});

test("placing an order leaves the supplier's account as it is until goods arrive, goes to its detail page, and the next visit starts a fresh form", async ({ page, api }) => {
  const po = await nextPo(api);
  const before = await balanceOf(api, "Foshan Fabrics");
  await page.goto("/orders/new");
  await fillValid(page);
  await box(page, "Deposit required (¥)").fill("1,500");
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
  await place(page).click();

  await expect(toast(page, `Order ${po} placed. Supplier balance ${balanceText(before)}: it changes as goods are received.`)).toBeVisible();
  await expect(page).toHaveURL(`/orders/${po}`);
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();

  const saved = await api.order(po);
  expect(saved).toMatchObject({ stage: 1, supplier: { name: "Foshan Fabrics" }, orderDate: today(), deliveryDate: today(20), orderValueCny: 0, poValueCny: 2500, paymentStatus: "awaiting_goods", held: false });
  // The deposit required (0009) is a milestone of the order, met as the supplier's account settles it.
  expect(saved).toMatchObject({ depositRequiredCny: 1500 });
  // Nothing received, so nothing is settled to it yet: the deposit is not met.
  expect(saved.depositStatus).toBe("unmet");
  expect(saved.lines).toMatchObject([{ item: { name: "Denim jeans" }, quantity: 200, rateCny: 12.5 }]);
  expect(saved.payments).toEqual([]);
  expect(saved.supplierAccount).toMatchObject({ currency: "CNY", balanceCny: before });

  // Back to the list and in again: the kept (Activity) route shows an empty form with the next PO.
  await page.getByRole("link", { name: "Orders", exact: true }).first().click();
  await page.getByRole("link", { name: "+ New order" }).click();
  await expect(page).toHaveURL("/orders/new");
  await expect(box(page, "Purchase order no.")).toHaveValue(`PO-${poNumber(po) + 1}`);
  await expect(combo(page, "Supplier")).toHaveValue("");
  await expect(box(page, "Rate (¥), line 1")).toHaveValue("");
  await expect(box(page, "Deposit required (¥)")).toHaveValue("");
});

test("double-clicking Place order places one order", async ({ page, api }) => {
  const po = await nextPo(api);
  await page.goto("/orders/new");
  await fillValid(page);
  // Container terms are chosen on the order (backend docs/order-container-terms.md).
  await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
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
    // Container terms are chosen on the order (backend docs/order-container-terms.md).
    await page.getByRole("combobox", { name: "Container terms" }).selectOption("FOB");
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
