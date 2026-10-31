import { expect, type Page, test } from "@playwright/test";

import { PROCUREMENT_STATE } from "./sessions";

// Sprint 2026-10-31: Remove on the Users list (docs/orders-users-contract.md, USR-5 and D3), signed in as Suresh
// (Management, admin Full), on the seeded API. A user nobody has used is removed after the confirmation. A seeded user
// who has signed in is refused and offered Deactivate instead, which is cancelled: other specs sign in as the seeded
// users, so they are never deactivated or removed here. Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

const DEACTIVATE_NOTE = "They're signed out at once and can't sign in. Their name stays on everything they recorded.";
const row = (page: Page, name: string) => page.getByRole("table").getByRole("row", { name: new RegExp(name) });
const showAll = (page: Page) => page.getByRole("group", { name: "User status" }).getByRole("button", { name: "All", exact: true }).click();

test("Management adds a user, then removes them after confirming", async ({ page, baseURL }) => {
  const stamp = Date.now().toString(36);
  const name = `E2E Remove ${stamp}`;
  const email = `e2e.remove.${stamp}@mrgarments.com`;
  await page.goto("/users");
  await page.getByRole("link", { name: "+ Add user" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill(name);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("combobox", { name: "Role" }).selectOption("Accounts");
  await page.getByLabel(/^Password\s*\*?$/).filter({ visible: true }).fill("Welcome2026x");
  await page.getByRole("button", { name: "Save user" }).click();
  await expect(page).toHaveURL("/users");
  await expect(page.getByText("User added", { exact: true })).toBeVisible();

  try {
    const trigger = page.getByRole("button", { name: `Remove ${name}` });
    await trigger.click();
    const confirm = page.getByRole("alertdialog", { name: "Remove user?" });
    await expect(confirm).toContainText(`Are you sure you want to remove ${name} (${email})? This can't be undone.`);
    // Focus starts on Cancel, so Enter backs out; Cancel sends nothing and focus returns to Remove.
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(row(page, name)).toHaveCount(1);

    await trigger.click();
    await confirm.getByRole("button", { name: "Remove user" }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByText("User removed", { exact: true })).toBeVisible();
    await expect(row(page, name)).toHaveCount(0);

    // Gone for good: not under All after a reload either.
    await page.reload();
    await showAll(page);
    await expect(row(page, name)).toHaveCount(0);
  } finally {
    // A failed run mustn't leave the user behind: later specs count the active users.
    await page.goto("/users");
    await showAll(page);
    const edit = page.getByRole("link", { name: `Edit ${name}` });
    if ((await edit.count()) > 0) {
      const id = new URL((await edit.getAttribute("href"))!, baseURL).searchParams.get("id")!;
      await page.request.delete(`/api/v1/users/${id}`, { headers: { Origin: baseURL ?? "" } });
    }
  }
});

test("a seeded user who has signed in can't be removed: the confirmation offers Deactivate instead (cancelled)", async ({ page }) => {
  await page.goto("/users");
  await page.getByRole("button", { name: "Remove Priya Nair" }).click();
  await page.getByRole("alertdialog", { name: "Remove user?" }).getByRole("button", { name: "Remove user" }).click();

  const instead = page.getByRole("alertdialog", { name: "Deactivate user instead?" });
  await expect(instead).toContainText(/Priya Nair has .*signed in.*, so they can't be removed\./);
  await expect(instead).not.toContainText("Deactivate them instead.");
  await expect(instead).toContainText(DEACTIVATE_NOTE);
  await expect(instead.getByRole("button", { name: "Deactivate user" })).toBeVisible();
  await expect(instead.getByRole("button", { name: "Cancel" })).toBeFocused();
  // Other specs sign in as Priya: back out without deactivating her.
  await instead.getByRole("button", { name: "Cancel" }).click();
  await expect(instead).toBeHidden();
  await page.reload();
  await expect(row(page, "Priya Nair")).toContainText("Active");
});

test("your own row has no Remove, and your own Status can't be changed", async ({ page }) => {
  await page.goto("/users");
  await expect(page.getByRole("button", { name: "Remove Priya Nair" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit Suresh Menon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Suresh Menon" })).toHaveCount(0);

  await page.getByRole("link", { name: "Edit Suresh Menon" }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Suresh Menon");
  const status = page.getByRole("combobox", { name: "Status" });
  await expect(status).toBeDisabled();
  await expect(status).toHaveAccessibleDescription("You can't deactivate your own account.");
});

test.describe("Procurement (admin None)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("can't open Users, so can't remove anyone", async ({ page }) => {
    await page.goto("/users");
    await expect(page).not.toHaveURL(/\/users/);
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  });
});
