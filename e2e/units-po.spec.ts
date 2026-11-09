import { type Api, expect, field, test, toast, today } from "./live-api";

// Settings tab 8 (Units) feeding the item form's "Counted in", and a PO number in any format end to end (placing, the
// order page and its tabs, Edit order, the list link, duplicates), against the live API's test database. Role/label
// locators only (hidden <Activity> routes stay in the DOM). Each test adds its own records and removes them after.

test.use({ viewport: { width: 1440, height: 900 } });

const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const deleteRecord = async (api: Api, path: string) => expect((await api.request.delete(`/api/v1${path}`, { data: {} })).status(), path).toBe(204);
const idOf = async (api: Api, path: string, name: string) => (await api.get<{ id: string; name: string }[]>(path)).find((row) => row.name === name)!.id;

test("a unit added in Settings is offered on a new item at once; an inactive one keeps the items that use it", async ({ page, api }) => {
  const unit = `E2E Boxes ${stamp()}`;
  const item = `E2E Shirts ${stamp()}`;
  await page.goto("/settings/units");
  await expect(page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Units" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "+ Add unit" }).click();
  const add = page.getByRole("dialog", { name: "Add unit" });
  await add.getByLabel("Unit name").fill(unit);
  await add.getByLabel("Symbol").fill("box");
  await add.getByRole("button", { name: "Save unit" }).click();
  await expect(toast(page, "Unit added")).toBeVisible();
  const row = page.getByRole("table").getByRole("row", { name: new RegExp(unit) });
  await expect(row.getByRole("cell")).toHaveText([unit, "box", "", "Active", "EditDelete"]);

  // The same name in another letter case is refused under the field.
  await page.getByRole("link", { name: "+ Add unit" }).click();
  await add.getByLabel("Unit name").fill(unit.toUpperCase());
  await add.getByRole("button", { name: "Save unit" }).click();
  await expect(add.getByText("A unit with this name already exists.")).toBeVisible();
  await add.getByRole("button", { name: "Cancel" }).click();
  await expect(add).toBeHidden();

  // The item form offers it at once; the item list shows it; the unit lists the item.
  await page.goto("/settings/items");
  await page.getByRole("link", { name: "+ Add item" }).click();
  const addItem = page.getByRole("dialog", { name: "Add item" });
  await addItem.getByLabel("Item name").fill(item);
  await addItem.getByLabel("Counted in").selectOption(unit);
  await addItem.getByLabel("Pieces per bundle").fill("12");
  await addItem.getByRole("button", { name: "Save item" }).click();
  await expect(toast(page, "Item added")).toBeVisible();
  const itemRow = page.getByRole("table").getByRole("row", { name: new RegExp(item) });
  await expect(itemRow.getByRole("cell")).toHaveText([item, unit, "12", "", "Active", "EditDelete"]);
  await page.goto("/settings/units");
  await expect(row.getByRole("cell")).toHaveText([unit, "box", item, "Active", "EditDelete"]);

  // Deactivating asks first. The item keeps the unit (still shown and chosen on its edit); a new item can't pick it.
  await page.getByRole("link", { name: `Edit ${unit}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit unit" });
  await expect(edit.getByLabel("Unit name")).toHaveValue(unit);
  await expect(edit.getByLabel("Symbol")).toHaveValue("box");
  await edit.getByLabel("Status").selectOption("Inactive");
  await edit.getByRole("button", { name: "Save unit" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Deactivate unit?" });
  await expect(confirm).toContainText("Items that already use it keep it.");
  await confirm.getByRole("button", { name: "Deactivate unit" }).click();
  await expect(toast(page, "Unit saved")).toBeVisible();
  await expect(row).toHaveCount(0);

  await page.goto("/settings/items");
  await expect(itemRow.getByRole("cell").nth(1)).toHaveText(unit);
  await page.getByRole("link", { name: "+ Add item" }).click();
  await expect(addItem.getByLabel("Counted in").getByRole("option", { name: "Pieces" })).toHaveCount(1);
  await expect(addItem.getByLabel("Counted in").getByRole("option", { name: unit })).toHaveCount(0);
  await addItem.getByRole("button", { name: "Cancel" }).click();
  await expect(addItem).toBeHidden();
  await page.getByRole("link", { name: `Edit ${item}` }).click();
  const editItem = page.getByRole("dialog", { name: "Edit item" });
  await expect(editItem.getByLabel("Counted in")).toHaveValue(unit);
  await editItem.getByRole("button", { name: "Cancel" }).click();

  // Leave nothing behind (other Settings specs count rows): the item, then the unit it used.
  await deleteRecord(api, `/items/${await idOf(api, "/items", item)}`);
  await deleteRecord(api, `/units/${await idOf(api, "/units?status=Inactive", unit)}`);
});

test("a PO number in any format places the order, opens its page, tabs, Edit order and list link, and refuses a duplicate", async ({ page, api }) => {
  const po = `E2E/MR/2026/${stamp()}`;
  const href = `/orders/${encodeURIComponent(po)}`;
  const poBox = page.getByRole("textbox", { name: "Purchase order no.", exact: true });
  async function fillOrder(typed: string) {
    await page.goto("/orders/new");
    await poBox.fill(typed);
    await page.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: "Foshan Fabrics" });
    await field(page, "Delivery date").fill(today(20));
    await page.getByRole("combobox", { name: "Item, line 1", exact: true }).selectOption({ label: "Denim jeans" });
    await page.getByRole("textbox", { name: "Rate (¥), line 1", exact: true }).fill("12.5");
    await page.getByRole("textbox", { name: "Quantity, line 1", exact: true }).fill("200");
    await page.getByRole("button", { name: "Place order" }).click();
  }

  // Trimmed, otherwise kept as typed: no PO- prefix or letter case is forced.
  await fillOrder(`  ${po}  `);
  await expect(toast(page, `Order ${po} placed`)).toBeVisible();
  await expect(page).toHaveURL(href);
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Order sections" });
  await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Items" }).click();
  await expect(page).toHaveURL(`${href}/items`);
  await expect(tabs.getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();

  // Edit order reaches the API by the encoded URL.
  await page.getByRole("button", { name: "Edit order" }).click();
  const edit = page.getByRole("dialog", { name: "Edit order" });
  await field(edit, "Delivery date").fill(today(25));
  await edit.getByRole("button", { name: "Save order" }).click();
  await expect(toast(page, "Order saved")).toBeVisible();
  expect((await api.order(po)).deliveryDate).toBe(today(25));

  // The list links to it, encoded (searched first: the list pages by 10 and other specs place orders the same day).
  await page.goto("/orders");
  await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(po);
  await page.getByRole("link", { name: po, exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(href);
  await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();

  // The same number in another letter case is refused under the field; a blank one never leaves the form.
  await fillOrder(po.toLowerCase());
  await expect(page.getByText("This PO number is already used by another order.")).toBeVisible();
  await expect(poBox).toHaveAttribute("aria-invalid", "true");
  await poBox.fill("   ");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Enter the PO number.")).toBeVisible();
  await expect(page).toHaveURL("/orders/new");

  await deleteRecord(api, href);
});
