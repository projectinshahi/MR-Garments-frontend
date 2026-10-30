import { expect, type Page, test } from "@playwright/test";

// QA: Delete on the Settings edit dialogs (backend docs/wave3-contracts.md section 4.1), on the API's test database.
// A record nothing uses is deleted; one in use is refused with the API's message and stays. Role/label locators only
// (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const row = (page: Page, name: string) => page.getByRole("table").getByRole("row", { name: new RegExp(name) });

test("deletes a team nothing uses after confirming", async ({ page }) => {
  const name = `E2E delete team ${Date.now().toString(36)}`;
  await page.goto("/settings/teams");
  await page.getByRole("link", { name: "+ Add team" }).click();
  const add = page.getByRole("dialog", { name: "Add team" });
  await expect(add.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await add.getByLabel("Team name").fill(name);
  await add.getByRole("button", { name: "Save team" }).click();
  await expect(add).toBeHidden();
  await expect(row(page, name)).toContainText("Active");

  await page.getByRole("link", { name: `Edit ${name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit team" });
  await edit.getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: `Delete ${name}?` });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(edit).toBeVisible();

  await edit.getByRole("button", { name: "Delete" }).click();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/settings\/teams$/);
  await expect(edit).toBeHidden();
  await expect(page.getByText("Team deleted", { exact: true })).toBeVisible();
  await expect(row(page, name)).toHaveCount(0);

  // Gone for good: not under All after a reload either.
  await page.reload();
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "All" }).click();
  await expect(row(page, name)).toHaveCount(0);
});

test("refuses to delete an office its users belong to and keeps it", async ({ page }) => {
  await page.goto("/settings/offices");
  await page.getByRole("link", { name: "Edit Guangzhou office" }).click();
  const edit = page.getByRole("dialog", { name: "Edit office or warehouse" });
  await edit.getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete Guangzhou office?" });
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText(/^This office or warehouse is used by \d+ users?.*, so it can't be deleted\. Deactivate it instead\.$/)).toBeVisible();
  await expect(confirm).toBeHidden();
  // The edit dialog stays open, so it can be deactivated instead.
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel("Status")).toHaveValue("Active");
  await edit.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(row(page, "Guangzhou office")).toContainText("Active");
});
