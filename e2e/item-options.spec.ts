import { expect, type Page, test } from "@playwright/test";

// Regression (2026-10-31, "a deleted product still appears on the order page"). New order and Edit order offer only
// ORD-2's active items: deleting or deactivating an item in Settings takes effect there at once, also after browser
// Back, while an order that already uses the item keeps showing it. Role and label locators only (hidden <Activity>
// routes stay in the DOM). Everything it creates is removed again, so later specs see the seeded data.

test.use({ viewport: { width: 1440, height: 900 } });

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Main" });
const itemOptions = async (page: Page, line: number) =>
  (await page.getByLabel(`Item, line ${line}`).locator("option").allTextContents()).filter((name) => name !== "Select item");

/** Same-site API calls with the Management session, for setup and clean-up (B9.8). */
function api(page: Page, baseURL: string | undefined) {
  const headers = { Origin: baseURL ?? "" };
  return {
    post: async (path: string, data: object) => {
      const res = await page.request.post(`/api/v1${path}`, { data, headers });
      expect(res.status(), `POST ${path}`).toBe(201);
      return res.json();
    },
    get: async (path: string) => (await page.request.get(`/api/v1${path}`)).json(),
    delete: (path: string) => page.request.delete(`/api/v1${path}`, { data: {}, headers }),
  };
}

test("deleted and deactivated items leave New order at once, also after Back; their order keeps its item", async ({ page, baseURL }) => {
  const tag = Date.now().toString(36);
  const deleted = `E2E deleted item ${tag}`;
  const deactivated = `E2E deactivated item ${tag}`;
  const call = api(page, baseURL);
  const deletedId: string = (await call.post("/items", { name: deleted, countedIn: "Pieces", perBundle: 10 })).item.id;
  const deactivatedId: string = (await call.post("/items", { name: deactivated, countedIn: "Pieces", perBundle: 10 })).item.id;
  const { suppliers } = await call.get("/orders/options");
  const order: { po: string } = (
    await call.post("/orders", {
      supplierId: suppliers[0].id,
      orderDate: "2026-10-20",
      deliveryDate: "2026-11-30",
      lines: [{ itemId: deactivatedId, quantity: 5, rateCny: 2 }],
      deposits: [],
    })
  ).order;

  try {
    await page.goto("/orders");
    await page.getByRole("link", { name: "+ New order" }).click();
    await expect(page.getByLabel("Item, line 1")).toBeVisible();
    expect(await itemOptions(page, 1)).toEqual(expect.arrayContaining([deleted, deactivated]));

    // In Settings (client-side navigation), delete one item and deactivate the other.
    await sidebar(page).getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: /Item list/ }).click();
    await page.getByRole("link", { name: `Edit ${deleted}` }).click();
    await page.getByRole("dialog", { name: "Edit item" }).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog", { name: "Delete item?" }).getByRole("button", { name: "Delete item" }).click();
    await expect(page.getByText("Item deleted", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `Edit ${deactivated}` }).click();
    const edit = page.getByRole("dialog", { name: "Edit item" });
    await edit.getByLabel("Status").selectOption("Inactive");
    await edit.getByRole("button", { name: "Save item" }).click();
    await page.getByRole("alertdialog", { name: "Deactivate item?" }).getByRole("button", { name: "Deactivate item" }).click();
    await expect(page.getByText("Item saved", { exact: true })).toBeVisible();

    // Browser Back to the New order page kept by <Activity>: neither is offered.
    for (let i = 0; i < 5 && !page.url().endsWith("/orders/new"); i++) await page.goBack();
    await expect(page).toHaveURL(/\/orders\/new$/);
    await expect(page.getByLabel("Item, line 1")).toBeVisible();
    expect(await itemOptions(page, 1)).not.toContain(deleted);
    expect(await itemOptions(page, 1)).not.toContain(deactivated);

    // By links as well.
    await sidebar(page).getByRole("link", { name: "Orders", exact: true }).click();
    await page.getByRole("link", { name: "+ New order" }).click();
    await expect(page.getByLabel("Item, line 1")).toBeVisible();
    expect(await itemOptions(page, 1)).not.toContain(deleted);
    expect(await itemOptions(page, 1)).not.toContain(deactivated);

    // The order that uses the deactivated item still shows it; Edit order keeps it on that line only.
    await page.goto(`/orders/${order.po}/items`);
    await expect(page.getByText(deactivated).first()).toBeVisible();
    await page.goto(`/orders/${order.po}?edit=1`);
    const dialog = page.getByRole("dialog", { name: "Edit order" });
    await expect(dialog.getByLabel("Item, line 1")).toHaveValue(deactivatedId);
    await dialog.getByRole("button", { name: "+ Add item" }).click();
    expect(await itemOptions(page, 2)).not.toContain(deactivated);
    expect(await itemOptions(page, 2)).not.toContain(deleted);
  } finally {
    // The order has no payments or receipts, so ORD-6 removes it; then the unused item can go too.
    expect((await call.delete(`/orders/${order.po}`)).status(), "clean up the order").toBe(204);
    expect((await call.delete(`/items/${deactivatedId}`)).status(), "clean up the item").toBe(204);
    expect((await call.delete(`/items/${deletedId}`)).status()).toBe(404); // deleted through the UI above
  }
});
