import { expect, test } from "@playwright/test";

// W3-users: Users list (47_16.1), Add or edit user (48_16.2) and Roles (49_16.3), on the seeded Batch 1 API, signed in
// as Suresh (Management). Role/label locators only (hidden <Activity> routes). Nothing here is saved; the saving flows
// are in batch1-a2-users.spec.ts, which runs first and leaves the 8 seeded users active (Test User inactive).

test.use({ viewport: { width: 1440, height: 900 } });

const LAST_SIGN_IN = /^(–|Today, \d\d:\d\d|Yesterday, \d\d:\d\d|\d{1,2} [A-Z][a-z]{2}( \d{4})?, \d\d:\d\d)$/;

test("users list filters by search, role and status", async ({ page }) => {
  await page.goto("/users");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Users sections" }).getByRole("link", { name: "Users", exact: true })).toHaveAttribute("aria-current", "page");

  const table = page.getByRole("table");
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(9);
  const suresh = table.getByRole("row", { name: /Suresh Menon/ });
  await expect(suresh).toContainText("Management");
  // No office for the Head office users yet (U28); Suresh signed in for this run, so his last sign-in is today.
  await expect(suresh.getByRole("cell").nth(2)).toHaveText("");
  await expect(suresh.getByRole("cell").nth(3)).toHaveText(/^Today, \d\d:\d\d$/);
  await expect(table.getByRole("row", { name: /Joseph M/ }).getByRole("cell").nth(2)).toHaveText("Main warehouse");
  await expect(table.getByRole("row", { name: /Li Wei/ }).getByRole("cell").nth(3)).toHaveText(LAST_SIGN_IN);
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
  await status.getByRole("button", { name: /^Inactive \(\d+\)$/ }).click();
  await expect(table.getByRole("row", { name: /Wang Fang/ })).toHaveCount(0);
  await status.getByRole("button", { name: "All", exact: true }).click();
  await expect(table.getByRole("row", { name: /Wang Fang/ })).toHaveCount(1);
  await status.getByRole("button", { name: "Active (8)" }).click();
  await expect(rows).toHaveCount(9);

  await expect(page.getByRole("link", { name: "Edit Wang Fang" })).toHaveAttribute("href", /^\/users\/edit\?id=[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "+ Add user" })).toHaveAttribute("href", "/users/edit");
});

test("edit user form holds Wang Fang's details", async ({ page }) => {
  await page.goto("/users");
  await page.getByRole("link", { name: "Edit Wang Fang" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Wang Fang");
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue("wang@mrgarments.com");
  // The seed holds no phone numbers (48 draws +86 138 2210 7745).
  await expect(page.getByRole("textbox", { name: "Phone" })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Role" })).toHaveValue("China staff");
  await expect(page.getByRole("combobox", { name: "Office" }).locator("option:checked")).toHaveText("Guangzhou office");
  await expect(page.getByRole("combobox", { name: "Language" })).toHaveValue("English");
  // Password policy: Management may set a new password for someone else; left empty, the current one stays.
  const password = page.getByLabel("Set a new password", { exact: true });
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("placeholder", "Leave empty to keep the current password");
  await expect(password).toBeEditable();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("Active");

  await expect(page.getByRole("checkbox", { name: "Receiving (China)" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Container loading" })).toBeChecked();
  const transport = page.getByRole("checkbox", { name: "Transport" });
  await expect(transport).not.toBeChecked();
  await transport.click();
  await expect(transport).toBeChecked();

  const roleCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "What this role can do" }) });
  await expect(roleCard.getByText("China staff can enter receipts and container loading.", { exact: false })).toBeVisible();
  await expect(roleCard.getByRole("listitem")).toHaveCount(6);
  await expect(roleCard.getByRole("listitem").filter({ hasText: "Container loading" })).toContainText("Enter");
  await expect(roleCard.getByRole("listitem").filter({ hasText: "Reports" })).toContainText("No");

  // Cancel (K8) goes back to the list without saving.
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/users");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/users");
  await page.getByRole("link", { name: "Edit Wang Fang" }).click();
  await expect(page.getByRole("checkbox", { name: "Transport" })).not.toBeChecked();
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
