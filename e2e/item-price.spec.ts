import type { Page } from "@playwright/test";

import { expect, field, test, toast } from "./live-api";

// Item price (docs/item-price.md in the backend): Settings > Item list takes a price per item instead of the bundle
// fields, and New order fills a line's rate from the chosen item's price. The item is made here with a unique name;
// the order rate it saves never moves when the price changes later, and it ends Inactive. Role and label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const NAME = `E2E linen shirts ${Date.now().toString(36)}`;
const rowOf = (page: Page) => page.getByRole("table").getByRole("row", { name: new RegExp(NAME) });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const combo = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });

test("an item's price is set in Settings and fills the rate on New order, editable and never written back to saved orders", async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);

  // Add item: the price field replaces the bundle fields.
  await page.goto("/settings/items");
  await page.getByRole("link", { name: "+ Add item" }).click();
  const add = page.getByRole("dialog", { name: "Add item" });
  await expect(add.getByLabel(/Pieces per bundle|Bundle label/)).toHaveCount(0);
  await add.getByLabel("Item name").fill(NAME);
  await add.getByLabel("Counted in").selectOption("Pieces");
  await add.getByLabel("Item price").fill("12.5");
  await page.screenshot({ path: testInfo.outputPath("add-item.png"), fullPage: true });
  await add.getByRole("button", { name: "Save item" }).click();
  await expect(toast(page, "Item added")).toBeVisible();
  await expect(rowOf(page).getByRole("cell")).toHaveText([NAME, "Pieces", "12.50", "", "Active", "EditDelete"]);

  // Edit item: the saved price shows and can change.
  await page.getByRole("link", { name: `Edit ${NAME}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await expect(edit.getByLabel("Item price")).toHaveValue("12.5");
  await edit.getByLabel("Item price").fill("15");
  await page.screenshot({ path: testInfo.outputPath("edit-item.png"), fullPage: true });
  await edit.getByRole("button", { name: "Save item" }).click();
  await expect(toast(page, "Item saved")).toBeVisible();
  await expect(rowOf(page).getByRole("cell").nth(2)).toHaveText("15.00");

  // New order: choosing the item fills its rate; the amount follows the quantity; another item without a price
  // clears the rate; the rate stays editable.
  await page.goto("/orders/new");
  await combo(page, "Supplier").selectOption({ label: "Guangzhou Textile Co." });
  await field(page, "Delivery date").fill(new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10));
  await combo(page, "Item, line 1").selectOption({ label: NAME });
  await expect(box(page, "Rate (¥), line 1")).toHaveValue("15");
  await box(page, "Quantity, line 1").fill("10");
  await expect(box(page, "Amount (¥), line 1")).toHaveValue("150.00");
  await page.screenshot({ path: testInfo.outputPath("new-order-rate.png"), fullPage: true });
  await combo(page, "Item, line 1").selectOption({ label: "Denim jeans" });
  await expect(box(page, "Rate (¥), line 1")).toHaveValue("");
  await expect(box(page, "Amount (¥), line 1")).toHaveValue("");
  await combo(page, "Item, line 1").selectOption({ label: NAME });
  await expect(box(page, "Rate (¥), line 1")).toHaveValue("15");
  await box(page, "Rate (¥), line 1").fill("16");
  await expect(box(page, "Amount (¥), line 1")).toHaveValue("160.00");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(toast(page, /Order .* placed/)).toBeVisible();
  await expect(page).toHaveURL(/\/orders\/(?!new$)[^/?]+$/);
  const po = decodeURIComponent(page.url().split("/orders/")[1]!.split(/[/?]/)[0]!);

  // The saved line keeps the typed rate; raising the item's price afterwards changes the form's default only.
  const items = await api.get<{ id: string; name: string; price: number | null }[]>("/items");
  const item = items.find((row) => row.name === NAME)!;
  expect(item.price).toBe(15);
  expect((await api.patch(`/items/${item.id}`, { price: 20 })).status()).toBe(200);
  const order = await api.order(po);
  expect(order.lines[0]).toMatchObject({ rateCny: 16, quantity: 10 });
  expect(order.orderValueCny).toBe(160);
  const options = await api.options();
  expect(options.items.find((row) => row.id === item.id)?.price).toBe(20);

  // Ends Inactive, so the Active item list keeps its 8 seeded rows for the other settings specs.
  expect((await api.patch(`/items/${item.id}`, { status: "Inactive" })).status()).toBe(200);
});
