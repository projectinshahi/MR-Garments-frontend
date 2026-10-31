import { expect, type Page, test } from "@playwright/test";

// Wave 3 A3: Settings tabs 5 (Offices & warehouses) and 6 (Teams) add, edit and deactivate (backend
// docs/wave3-contracts.md section 4). Each test adds uniquely named records and ends with them Inactive, so the seeded
// Active lists other specs count are unchanged. Role/label locators only (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const suffix = Date.now().toString(36);
const row = (page: Page, name: string) => page.getByRole("table").getByRole("row", { name: new RegExp(name) });

async function deactivate(page: Page, name: string, editTitle: string, toast: string) {
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  const dialog = page.getByRole("dialog", { name: editTitle });
  await dialog.getByLabel("Status").selectOption("Inactive");
  await dialog.getByRole("button", { name: /^Save/ }).click();

  // Cancel keeps the edit dialog open and saves nothing; Deactivate saves.
  const noun = editTitle.replace(/^Edit /, "");
  const confirm = page.getByRole("alertdialog", { name: `Deactivate ${noun}?` });
  await expect(confirm).toContainText(`Are you sure you want to deactivate ${name}?`);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Save/ }).click();
  await confirm.getByRole("button", { name: `Deactivate ${noun}` }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(toast, { exact: true })).toBeVisible();

  // Gone from the Active list; listed as Inactive, also after a reload.
  await expect(row(page, name)).toHaveCount(0);
  await page.reload();
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Inactive" }).click();
  await expect(row(page, name)).toContainText("Inactive");
}

test("adds, edits and deactivates an office or warehouse", async ({ page }) => {
  const name = `E2E office ${suffix}`;
  await page.goto("/settings/offices");
  await page.getByRole("link", { name: "+ Add office or warehouse" }).click();
  await expect(page).toHaveURL(/\/settings\/offices\?dialog=add$/);
  const add = page.getByRole("dialog", { name: "Add office or warehouse" });
  const save = add.getByRole("button", { name: "Save office or warehouse" });

  await save.click();
  await expect(add.getByText("Enter the office or warehouse name.")).toBeVisible();
  await expect(add.getByText("Choose a type.")).toBeVisible();

  await add.getByLabel("Name").fill(name);
  await add.getByLabel("Type").selectOption("China office");
  await add.getByLabel("Address").fill("1 Test Road, Yiwu");
  await save.click();
  await expect(add).toBeHidden();
  await expect(page).toHaveURL(/\/settings\/offices$/);
  await expect(page.getByText("Office or warehouse added", { exact: true })).toBeVisible();
  // The server sets the country from the type.
  await expect(row(page, name).getByRole("cell")).toHaveText([name, "China office", "China", "1 Test Road, Yiwu", "", "Active", "Edit"]);

  // A name already used, in another capitalisation.
  await page.getByRole("link", { name: "+ Add office or warehouse" }).click();
  await add.getByLabel("Name").fill(name.toUpperCase());
  await add.getByLabel("Type").selectOption("Warehouse");
  await save.click();
  await expect(add.getByText("An office or warehouse with this name already exists.")).toBeVisible();
  await expect(add.getByLabel("Name")).toBeFocused();
  await add.getByRole("button", { name: "Cancel" }).click();
  await expect(add).toBeHidden();

  // Edit: the type is read-only; the address change persists.
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit office or warehouse" });
  await expect(edit.getByLabel("Name")).toHaveValue(name);
  await expect(edit.getByLabel("Type")).toHaveValue("China office");
  await expect(edit.getByLabel("Type")).toHaveAttribute("readonly", "");
  await edit.getByLabel("Address").fill("2 Test Road, Yiwu");
  await edit.getByRole("button", { name: "Save office or warehouse" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText("Office or warehouse saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(row(page, name)).toContainText("2 Test Road, Yiwu");

  await deactivate(page, name, "Edit office or warehouse", "Office or warehouse saved");
});

test("adds, renames and deactivates a team", async ({ page }) => {
  const name = `E2E team ${suffix}`;
  await page.goto("/settings/teams");
  await page.getByRole("link", { name: "+ Add team" }).click();
  await expect(page).toHaveURL(/\/settings\/teams\?dialog=add$/);
  const add = page.getByRole("dialog", { name: "Add team" });
  const save = add.getByRole("button", { name: "Save team" });

  await save.click();
  await expect(add.getByText("Enter the team name.")).toBeVisible();
  await add.getByLabel("Team name").fill(`${name} draft`);
  await save.click();
  await expect(add).toBeHidden();
  await expect(page.getByText("Team added", { exact: true })).toBeVisible();
  await expect(row(page, `${name} draft`).getByRole("cell")).toHaveText([`${name} draft`, "0", "₹0", "–", "Active", "Edit"]);

  // Renaming onto a seeded team's name is refused.
  await page.getByRole("link", { name: `Edit ${name} draft` }).click();
  const edit = page.getByRole("dialog", { name: "Edit team" });
  await edit.getByLabel("Team name").fill("retail TEAM");
  await edit.getByRole("button", { name: "Save team" }).click();
  await expect(edit.getByText("A team with this name already exists.")).toBeVisible();

  await edit.getByLabel("Team name").fill(name);
  await edit.getByRole("button", { name: "Save team" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText("Team saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(row(page, name).getByRole("cell").first()).toHaveText(name);
  await expect(page.getByRole("table").getByRole("row", { name: new RegExp(`${name} draft`) })).toHaveCount(0);

  await deactivate(page, name, "Edit team", "Team saved");
});
