import { expect, type Page, test } from "@playwright/test";

// Wave 3 A2: Settings tabs 3 and 4 (42, 43) add, edit and deactivate through the API, on the seeded test database.
// Each test adds its own uniquely named record and leaves it Inactive, so the Active lists keep only the seeded rows
// that w3-settings.spec.ts counts. Role/label locators only (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const RUN = Date.now().toString(36);

const TABS = [
  {
    path: "/settings/clearing-agents",
    noun: "clearing agent",
    nameLabel: "Clearing agent name",
    seeded: "Kochi Clearing Services",
    name: `Cochin Customs House Agents ${RUN}`,
    fields: [
      ["Contact person", "Mr. Thomas Varghese"],
      ["Phone", "+91 98470 55501"],
      ["Port", "Kochi"],
    ],
    change: ["Port", "Vizhinjam"],
  },
  {
    path: "/settings/transport-companies",
    noun: "transport company",
    nameLabel: "Transport company name",
    seeded: "Kerala Roadways",
    name: `Periyar Logistics ${RUN}`,
    fields: [
      ["Contact person", "Mr. Jose Mathew"],
      ["Phone", "+91 94470 88123"],
    ],
    change: ["Contact person", "Mr. Jose M"],
  },
] as const;

const capitalised = (text: string) => text[0]!.toUpperCase() + text.slice(1);

for (const tab of TABS) {
  const Noun = capitalised(tab.noun);
  const rowOf = (page: Page) => page.getByRole("table").getByRole("row", { name: new RegExp(tab.name) });
  const values = (fields: readonly (readonly [string, string])[]) => fields.map(([, value]) => value);

  test(`${Noun}: add, refuse a duplicate, edit, reload, then deactivate with confirmation`, async ({ page }) => {
    await page.goto(tab.path);
    await page.getByRole("link", { name: `+ Add ${tab.noun}` }).click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}\\?dialog=add$`));
    const add = page.getByRole("dialog", { name: `Add ${tab.noun}` });
    await expect(add).toBeVisible();
    await expect(add.getByLabel("Status")).toHaveCount(0);

    // Empty name: the form's own message, nothing sent.
    await add.getByRole("button", { name: `Save ${tab.noun}` }).click();
    await expect(add.getByText(`Enter the ${tab.noun} name.`)).toBeVisible();

    // Add: toast, closed, the new row last, Active with a 0 count.
    await add.getByLabel(tab.nameLabel).fill(tab.name);
    for (const [label, value] of tab.fields) await add.getByLabel(label).fill(value);
    await add.getByRole("button", { name: `Save ${tab.noun}` }).click();
    await expect(page.getByText(`${Noun} added`)).toBeVisible();
    await expect(add).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(rowOf(page).getByRole("cell")).toHaveText([tab.name, ...values(tab.fields), "0", "Active", "Edit"]);

    // A seeded name in another capitalisation: the API's 409 under the name field.
    await page.getByRole("link", { name: `+ Add ${tab.noun}` }).click();
    await add.getByLabel(tab.nameLabel).fill(tab.seeded.toLowerCase());
    await add.getByRole("button", { name: `Save ${tab.noun}` }).click();
    await expect(add.getByText(`A ${tab.noun} with this name already exists.`)).toBeVisible();
    await add.getByRole("button", { name: "Cancel" }).click();
    await expect(add).toBeHidden();

    // Edit: prefilled, saved, still there after a reload.
    await page.getByRole("link", { name: `Edit ${tab.name}` }).click();
    const edit = page.getByRole("dialog", { name: `Edit ${tab.noun}` });
    await expect(edit.getByLabel(tab.nameLabel)).toHaveValue(tab.name);
    await expect(edit.getByLabel("Status")).toHaveValue("Active");
    await edit.getByLabel(tab.change[0]).fill(tab.change[1]);
    await edit.getByRole("button", { name: `Save ${tab.noun}` }).click();
    await expect(page.getByText(`${Noun} saved`)).toBeVisible();
    await expect(edit).toBeHidden();
    const changed = tab.fields.map(([label, value]) => [label, label === tab.change[0] ? tab.change[1] : value] as const);
    await expect(rowOf(page).getByRole("cell")).toHaveText([tab.name, ...values(changed), "0", "Active", "Edit"]);
    await page.reload();
    await expect(rowOf(page).getByRole("cell")).toHaveText([tab.name, ...values(changed), "0", "Active", "Edit"]);

    // Deactivate: asks first; Cancel saves nothing, Deactivate does.
    await page.getByRole("link", { name: `Edit ${tab.name}` }).click();
    await edit.getByLabel("Status").selectOption("Inactive");
    await edit.getByRole("button", { name: `Save ${tab.noun}` }).click();
    const confirm = page.getByRole("alertdialog", { name: `Deactivate ${tab.noun}?` });
    await expect(confirm).toContainText(`Are you sure you want to deactivate ${tab.name}?`);
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(edit).toBeVisible();
    await edit.getByRole("button", { name: `Save ${tab.noun}` }).click();
    await confirm.getByRole("button", { name: `Deactivate ${tab.noun}` }).click();
    // The open confirmation already hides the edit dialog and the list from the accessibility tree, so wait for the
    // save itself: the URL drops ?dialog= only after it succeeds.
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(edit).toBeHidden();
    await expect(rowOf(page)).toHaveCount(0);

    await page.reload();
    await expect(rowOf(page)).toHaveCount(0);
    await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Inactive" }).click();
    await expect(rowOf(page).getByRole("cell")).toHaveText([tab.name, ...values(changed), "0", "Inactive", "Edit"]);
  });
}
