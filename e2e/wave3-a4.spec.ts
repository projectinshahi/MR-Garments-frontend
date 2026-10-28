import { expect, type Page, test } from "@playwright/test";

// Wave 3 A4: Settings tab 7, Item list (46), with the Add and Edit item dialogs (no design; built like 53). Signed in
// as Management on the seeded test database. The item is uniquely named and ends Inactive, so the Active list keeps
// its 8 seeded rows for w3-settings.spec.ts in either order.

test.use({ viewport: { width: 1440, height: 900 } });

const NAME = `E2E blazers ${Date.now().toString(36)}`;
const rowOf = (page: Page) => page.getByRole("table").getByRole("row", { name: new RegExp(NAME) });

test("adds an item, edits it, keeps it after a reload and deactivates it with confirmation", async ({ page }) => {
  await page.goto("/settings/items");
  await page.getByRole("link", { name: "+ Add item" }).click();
  await expect(page).toHaveURL(/\/settings\/items\?dialog=add$/);
  const add = page.getByRole("dialog", { name: "Add item" });
  await expect(add).toBeVisible();

  // Exactly one of pieces per bundle and a bundle label.
  await add.getByLabel("Item name").fill(NAME);
  await add.getByLabel("Counted in").selectOption("Pieces");
  await add.getByRole("button", { name: "Save item" }).click();
  await expect(add.getByText("Enter the pieces per bundle or a bundle label.")).toBeVisible();
  await add.getByLabel("Pieces per bundle").fill("24");
  await add.getByRole("button", { name: "Save item" }).click();

  await expect(page.getByText("Item added")).toBeVisible();
  await expect(add).toBeHidden();
  await expect(rowOf(page).getByRole("cell")).toHaveText([NAME, "Pieces", "24", "", "Active", "Edit"]);

  // Switch to a bundle label; the item is on no order, so its unit can still change.
  await page.getByRole("link", { name: `Edit ${NAME}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await expect(edit.getByLabel("Item name")).toHaveValue(NAME);
  await expect(edit.getByLabel("Counted in")).toBeEnabled();
  await edit.getByLabel("Counted in").selectOption("Metres");
  await edit.getByLabel("Pieces per bundle").fill("");
  await edit.getByLabel("Bundle label").fill("Bale");
  await edit.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("Item saved")).toBeVisible();
  await expect(edit).toBeHidden();

  await page.reload();
  await expect(rowOf(page).getByRole("cell")).toHaveText([NAME, "Metres", "Bale", "", "Active", "Edit"]);

  // Deactivating asks first; Cancel saves nothing.
  await page.getByRole("link", { name: `Edit ${NAME}` }).click();
  await edit.getByLabel("Status").selectOption("Inactive");
  await edit.getByRole("button", { name: "Save item" }).click();
  const confirm = page.getByRole("dialog", { name: `Deactivate ${NAME}?` });
  await expect(confirm).toContainText("An inactive item no longer appears on new orders.");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await edit.getByRole("button", { name: "Save item" }).click();
  await confirm.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Item saved")).toBeVisible();
  await expect(edit).toBeHidden();

  await expect(rowOf(page)).toHaveCount(0);
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Inactive" }).click();
  await expect(rowOf(page).getByRole("cell")).toHaveText([NAME, "Metres", "Bale", "", "Inactive", "Edit"]);
});
