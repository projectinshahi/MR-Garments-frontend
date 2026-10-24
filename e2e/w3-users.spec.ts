import { expect, test } from "@playwright/test";

// W3-users: Users list (47_16.1), Add or edit user (48_16.2) and Roles (49_16.3). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("users list filters by search, role and status", async ({ page }) => {
  await page.goto("/users");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Users sections" }).getByRole("link", { name: "Users", exact: true })).toHaveAttribute("aria-current", "page");

  const table = page.getByRole("table");
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(9);
  await expect(table.getByRole("row", { name: /Chen Yu/ })).toContainText("Yesterday, 15:31");
  await expect(table.getByRole("row", { name: /Suresh Menon/ })).toContainText("Management");
  await expect(table.getByRole("row", { name: /Joseph M/ })).toContainText("Main warehouse");
  await expect(page.getByText("Staff with an entry role can enter data for their own stage only.", { exact: false })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search users by name or email" }).fill("WANG@");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("Wang Fang");
  await page.getByRole("searchbox", { name: "Search users by name or email" }).fill("");

  await page.getByRole("button", { name: "Role: All roles" }).click();
  await page.getByRole("menuitemradio", { name: "China staff" }).click();
  await expect(rows).toHaveCount(4);
  await page.getByRole("button", { name: "Role: China staff" }).click();
  await page.getByRole("menuitemradio", { name: "All roles" }).click();

  const status = page.getByRole("group", { name: "User status" });
  await status.getByRole("button", { name: "Inactive (0)" }).click();
  await expect(table.getByText("No users match these filters.")).toBeVisible();
  await status.getByRole("button", { name: "All", exact: true }).click();
  await expect(rows).toHaveCount(9);
  await status.getByRole("button", { name: "Active (8)" }).click();
  await expect(rows).toHaveCount(9);

  await expect(page.getByRole("link", { name: "Edit Wang Fang" })).toHaveAttribute("href", "/users/edit");
  await page.getByRole("button", { name: "Edit Priya Nair" }).click();
  await expect(page.getByText("Edit Priya Nair is not included in the current prototype.")).toBeVisible();
  await page.getByRole("button", { name: "+ Add user" }).click();
  await expect(page.getByText("Add user is not included in the current prototype.")).toBeVisible();
});

test("edit user form holds Wang Fang's details as client state", async ({ page }) => {
  await page.goto("/users/edit");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Wang Fang");
  await expect(page.getByLabel("Email")).toHaveValue("wang@mrgarments.com");
  await expect(page.getByLabel("Phone")).toHaveValue("+86 138 2210 7745");
  await expect(page.getByLabel("Role")).toHaveValue("China staff");
  await expect(page.getByLabel("Office")).toHaveValue("Guangzhou office");
  await expect(page.getByLabel("Language")).toHaveValue("English");
  await expect(page.getByLabel("Password")).toHaveAttribute("placeholder", "Set by user at first sign-in");
  await expect(page.getByLabel("Status")).toHaveValue("Active");

  await expect(page.getByRole("checkbox", { name: "Receiving (China)" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Container loading" })).toBeChecked();
  const transport = page.getByRole("checkbox", { name: "Transport" });
  await expect(transport).not.toBeChecked();
  await transport.click();
  await expect(transport).toBeChecked();

  await page.getByLabel("Phone").fill("+86 100");
  await expect(page.getByLabel("Phone")).toHaveValue("+86 100");

  const roleCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "What this role can do" }) });
  await expect(roleCard.getByText("China staff can enter receipts and container loading.", { exact: false })).toBeVisible();
  await expect(roleCard.getByRole("listitem")).toHaveCount(6);
  await expect(roleCard.getByRole("listitem").filter({ hasText: "Container loading" })).toContainText("Enter");
  await expect(roleCard.getByRole("listitem").filter({ hasText: "Reports" })).toContainText("No");

  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/users");
  await page.getByRole("button", { name: "Save user" }).click();
  await expect(page.getByText("Save user is not included in the current prototype.")).toBeVisible();
});

test("roles tab shows the read-only permission matrix", async ({ page }) => {
  await page.goto("/users/roles");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(14);
  await expect(table.getByRole("columnheader", { name: "Warehouse staff" })).toBeVisible();
  const deposits = table.getByRole("row", { name: /Deposits and payments/ });
  await expect(deposits.getByRole("cell")).toHaveText(["Deposits and payments", "Full", "View", "Enter", "–No access", "–No access", "–No access"]);
  await expect(page.getByText("Roles are fixed in this first version.", { exact: false })).toBeVisible();
});
