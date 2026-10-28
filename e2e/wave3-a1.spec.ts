import { expect, type Locator, test } from "@playwright/test";

// Wave 3 A1: add, edit and deactivate on Settings tabs 1 (Suppliers) and 2 (Shipping agents), docs/wave3-contracts.md
// section 4, on the API's test database. Role/label locators only (hidden <Activity> routes stay in the DOM). Each run
// adds its own uniquely named records, so the spec doesn't depend on the rows other specs add.

test.use({ viewport: { width: 1440, height: 900 } });

const TABS = [
  { noun: "supplier", path: "/settings/suppliers", nameLabel: "Supplier name", cityLabel: "City" },
  { noun: "shipping agent", path: "/settings/shipping-agents", nameLabel: "Shipping agent name", cityLabel: "Office city" },
];

for (const tab of TABS) {
  test(`${tab.noun}: add, edit, reload, then deactivate after confirming`, async ({ page }) => {
    const tag = Date.now().toString(36);
    // Neither name contains the other, so the row locators stay apart.
    const name = `E2E ${tab.noun} ${tag}`;
    const renamed = `E2E ${tab.noun} edited ${tag}`;
    const title = tab.noun[0]!.toUpperCase() + tab.noun.slice(1);
    const row = (text: string) => page.getByRole("table").getByRole("row", { name: new RegExp(text) });
    const save = (dialog: Locator) => dialog.getByRole("button", { name: `Save ${tab.noun}` }).click();

    await page.goto(tab.path);
    await page.getByRole("link", { name: `+ Add ${tab.noun}` }).click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}\\?dialog=add$`));
    const add = page.getByRole("dialog", { name: `Add ${tab.noun}` });
    await expect(add.getByLabel("Status")).toHaveCount(0);
    await add.getByLabel(tab.nameLabel).fill(name);
    await add.getByLabel(tab.cityLabel).fill("Ningbo");
    await save(add);
    await expect(add).toBeHidden();
    await expect(page.getByText(`${title} added`, { exact: true })).toBeVisible();
    await expect(row(name)).toContainText("Ningbo");
    await expect(row(name)).toContainText("Active");

    // Edit: the same form filled from the row, plus Status.
    await page.getByRole("link", { name: `Edit ${name}` }).click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}\\?dialog=edit&id=[0-9a-f-]{36}$`));
    const edit = page.getByRole("dialog", { name: `Edit ${tab.noun}` });
    await expect(edit.getByLabel(tab.nameLabel)).toHaveValue(name);
    await expect(edit.getByLabel(tab.cityLabel)).toHaveValue("Ningbo");
    await expect(edit.getByLabel("Status")).toHaveValue("Active");
    await edit.getByLabel(tab.nameLabel).fill(renamed);
    await edit.getByLabel(tab.cityLabel).fill("Shanghai");
    await save(edit);
    await expect(edit).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(page.getByText(`${title} saved`, { exact: true })).toBeVisible();
    await expect(row(renamed)).toContainText("Shanghai");

    await page.reload();
    await expect(row(renamed)).toContainText("Shanghai");
    await expect(row(name)).toHaveCount(0);

    // Deactivating asks first; Cancel goes back to the form and saves nothing.
    await page.getByRole("link", { name: `Edit ${renamed}` }).click();
    await edit.getByLabel("Status").selectOption("Inactive");
    await save(edit);
    const confirm = page.getByRole("dialog", { name: `Deactivate ${renamed}?` });
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(edit.getByLabel("Status")).toHaveValue("Inactive");
    await save(edit);
    await confirm.getByRole("button", { name: "Deactivate" }).click();
    await expect(edit).toBeHidden();
    // The Active chip is selected, so the row leaves the list; it stays under Inactive after a reload.
    await expect(row(renamed)).toHaveCount(0);
    await page.reload();
    await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Inactive" }).click();
    await expect(row(renamed)).toContainText("Inactive");
  });
}
