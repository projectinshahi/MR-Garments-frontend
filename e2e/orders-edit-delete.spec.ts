import type { Page } from "@playwright/test";

import { ANITA, expect, field, freshSignIn, kv, longDate, test, toast, today } from "./live-api";
import { PROCUREMENT_STATE } from "./sessions";

// Edit and Delete order (ORD-5, ORD-6; docs/orders-users-contract.md) against the live API. Role/label locators only
// (hidden <Activity> routes stay in the DOM). Orders are made per test, so tests never share one.

test.use({ viewport: { width: 1440, height: 900 } });

const search = (page: Page) => page.getByRole("searchbox", { name: "Search PO, item or supplier" });
const combo = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

/** The orders list filtered to one PO, so it is on the first page whatever else the database holds. */
async function listOnly(page: Page, po: string) {
  await page.goto("/orders");
  await search(page).fill(po);
  await expect(page.getByRole("link", { name: po, exact: true })).toBeVisible();
}

test("Management places an order, edits its delivery date, then deletes it after backing out once", async ({ page, api }) => {
  const po = (await api.options()).nextPo;
  await page.goto("/orders/new");
  await combo(page, "Supplier").selectOption({ label: "Foshan Fabrics" });
  await field(page, "Delivery date").fill(today(20));
  await combo(page, "Item, line 1").selectOption({ label: "Denim jeans" });
  await box(page, "Rate (¥), line 1").fill("12.5");
  await box(page, "Quantity, line 1").fill("200");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(`/orders/${po}`);

  // Stage 1: everything but the supplier is offered; only the delivery date changes, so only it is sent.
  await page.getByRole("button", { name: "Edit order" }).click();
  const edit = page.getByRole("dialog", { name: "Edit order" });
  await expect(field(edit, "Order date")).toHaveValue(today());
  await expect(edit.getByRole("combobox", { name: "Item, line 1" })).toHaveValue(/.+/);
  await expect(edit.getByRole("status", { name: "Order total" })).toHaveText("¥ 2,500.00");
  const patch = page.waitForRequest((request) => request.method() === "PATCH" && request.url().endsWith(`/api/v1/orders/${po}`));
  await field(edit, "Delivery date").fill(today(25));
  await edit.getByRole("button", { name: "Save order" }).click();
  expect((await patch).postDataJSON()).toEqual({ deliveryDate: today(25) });
  await expect(toast(page, "Order saved")).toBeVisible();
  await expect(edit).toBeHidden();
  await expect(kv(page, "Delivery date")).toHaveText(longDate(today(25)));
  expect((await api.order(po)).deliveryDate).toBe(today(25));

  // Delete: Cancel sends nothing; confirming deletes it and goes back to the list.
  const trigger = page.getByRole("button", { name: "Delete order" });
  await trigger.click();
  const confirm = page.getByRole("alertdialog", { name: "Delete order?" });
  await expect(confirm).toContainText(`Are you sure you want to delete ${po} (Foshan Fabrics)? This can't be undone.`);
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  expect((await api.order(po)).po).toBe(po);

  await trigger.click();
  await confirm.getByRole("button", { name: "Delete order" }).click();
  await expect(toast(page, "Order deleted")).toBeVisible();
  await expect(page).toHaveURL("/orders");
  expect((await api.request.get(`/api/v1/orders/${po}`)).status()).toBe(404);
  await search(page).fill(po);
  await expect(page.getByRole("link", { name: po, exact: true })).toHaveCount(0);
});

test("the list's Edit opens the edit dialog on the order page; Cancel leaves the URL clean", async ({ page, api }) => {
  const { po } = await api.createOrder();
  await listOnly(page, po);
  await page.getByRole("link", { name: `Edit ${po}` }).click();
  await expect(page).toHaveURL(`/orders/${po}?edit=1`);
  const edit = page.getByRole("dialog", { name: "Edit order" });
  await expect(edit).toBeVisible();
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toBeHidden();
  await expect(page).toHaveURL(`/orders/${po}`);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("an order with a deposit can't be deleted: the confirmation gives the API's reason with Close only", async ({ page, api }) => {
  const { po } = await api.createOrder({ deposits: [{ amountCny: 500, rateInr: 12 }] });
  await listOnly(page, po);
  await page.getByRole("button", { name: `Delete ${po}` }).click();
  await page.getByRole("alertdialog", { name: "Delete order?" }).getByRole("button", { name: "Delete order" }).click();

  const refused = page.getByRole("alertdialog", { name: "Can't delete order" });
  await expect(refused).toContainText(/This order has 1 payment.*, so it can't be deleted\./);
  await expect(refused.getByRole("button")).toHaveText(["Close"]);
  await refused.getByRole("button", { name: "Close" }).click();
  await expect(refused).toBeHidden();
  // The row's Delete didn't open the order, and the order is still there.
  await expect(page).toHaveURL("/orders");
  await expect(page.getByRole("link", { name: po, exact: true })).toBeVisible();
  expect((await api.order(po)).po).toBe(po);
});

test.describe("Procurement (orders Enter, no admin)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("sees Edit but not Delete, on the list and the order page", async ({ page, api }) => {
    const { po } = await api.createOrder();
    await listOnly(page, po);
    await expect(page.getByRole("link", { name: `Edit ${po}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Delete ${po}` })).toHaveCount(0);

    await page.goto(`/orders/${po}`);
    await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit order" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete order" })).toHaveCount(0);
  });
});

test.describe("Accounts (orders View)", () => {
  // A fresh session: batch1-a5-passwords changes Anita's password during the run (see freshSignIn).
  test.use({ storageState: freshSignIn(ANITA) });

  test("sees neither Edit nor Delete", async ({ page, api }) => {
    const { po } = await api.createOrder();
    await listOnly(page, po);
    await expect(page.getByRole("link", { name: `Edit ${po}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Delete ${po}` })).toHaveCount(0);

    await page.goto(`/orders/${po}`);
    await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit order" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete order" })).toHaveCount(0);
  });
});
