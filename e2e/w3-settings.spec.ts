import { expect, test } from "@playwright/test";

// W3-settings: Settings tabs 1–7 (40–46) and the Add supplier dialog (53_17.4), on the seeded test database. Role/label
// locators only (hidden <Activity> routes stay in the DOM). Saving a supplier is covered by batch1-a4-settings.spec.ts;
// this file adds none and allows for the one that spec adds, so the two run in either order.

test.use({ viewport: { width: 1440, height: 900 } });

const TABS = [
  // At least the 5 seeded suppliers (batch1-a4-settings.spec.ts may have added one).
  { name: "Suppliers", path: "/settings/suppliers", action: "+ Add supplier", record: "Guangzhou Textile Co.", rows: null },
  { name: "Shipping agents", path: "/settings/shipping-agents", action: "+ Add shipping agent", record: "Sino Freight", rows: 2 },
  { name: "Clearing agents", path: "/settings/clearing-agents", action: "+ Add clearing agent", record: "Kochi Clearing Services", rows: 2 },
  { name: "Transport companies", path: "/settings/transport-companies", action: "+ Add transport company", record: "Kerala Roadways", rows: 2 },
  { name: "Offices & warehouses", path: "/settings/offices", action: "+ Add office or warehouse", record: "Guangzhou office", rows: 3 },
  { name: "Teams", path: "/settings/teams", action: "+ Add team", record: "Retail team", rows: 3 },
  { name: "Item list", path: "/settings/items", action: "+ Add item", record: "Cotton fabric", rows: 8 },
];

test("the settings redirect and tab links reach all seven tabs", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings\/suppliers$/);
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "Settings sections" });
  for (const tab of TABS) {
    await tabs.getByRole("link", { name: tab.name }).click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(tabs.getByRole("link", { name: tab.name })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole(tab.name === "Suppliers" ? "link" : "button", { name: tab.action })).toBeVisible();
    const table = page.getByRole("table");
    if (tab.rows !== null) await expect(table.getByRole("row")).toHaveCount(tab.rows + 1);
    await expect(table.getByRole("row", { name: new RegExp(tab.record) })).toContainText("Active");
  }

  // Teams hold no stock yet: pieces 0, cost ₹0 and the average "–" (B6, B6.2).
  await tabs.getByRole("link", { name: "Teams" }).click();
  await expect(page.getByRole("row", { name: /Retail team/ }).getByRole("cell")).toHaveText(["Retail team", "0", "₹0", "–", "Active", "Edit"]);
});

test("search and status chips filter the table on the client", async ({ page }) => {
  await page.goto("/settings/suppliers");
  const table = page.getByRole("table");
  const status = page.getByRole("group", { name: "Status" });
  await expect(status.getByRole("button", { name: "Active", exact: true })).toHaveAttribute("aria-pressed", "true");

  const search = page.getByRole("searchbox", { name: "Search by name or phone" });
  await search.fill("+86 137");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("row").nth(1)).toContainText("Foshan Fabrics");
  await search.fill("yiwu");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("row").nth(1)).toContainText("Yiwu Trims Ltd.");
  await search.fill("");

  // The cleared search re-renders every row in one commit; then read how many Active rows there are.
  await expect.poll(() => table.getByRole("row").count()).toBeGreaterThanOrEqual(6);
  const active = await table.getByRole("row").count();
  await status.getByRole("button", { name: "Inactive" }).click();
  await expect(table.getByText("No suppliers match these filters.")).toBeVisible();
  await status.getByRole("button", { name: "All" }).click();
  await expect(table.getByRole("row")).toHaveCount(active);
});

test("undesigned actions show the prototype notice", async ({ page }) => {
  await page.goto("/settings/shipping-agents");
  await page.getByRole("button", { name: "+ Add shipping agent" }).click();
  await expect(page.getByText("Add shipping agent is not included in the current prototype.")).toBeVisible();

  await page.getByRole("button", { name: "Edit Dragon Cargo" }).click();
  await expect(page.getByText("Edit Dragon Cargo is not included in the current prototype.")).toBeVisible();
});

test("the Add supplier dialog opens prefilled, closes and validates", async ({ page }) => {
  await page.goto("/settings/suppliers");
  await page.getByRole("link", { name: "+ Add supplier" }).click();
  await expect(page).toHaveURL(/\?dialog=add-supplier$/);
  const dialog = page.getByRole("dialog", { name: "Add supplier" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Supplier name")).toHaveValue("Ningbo Denim Works");
  await expect(dialog.getByLabel("City")).toHaveValue("Ningbo");
  await expect(dialog.getByLabel("Contact person")).toHaveValue("Mr. Xu Feng");
  await expect(dialog.getByLabel("Phone / WeChat")).toHaveValue("+86 138 5740 9921");
  await expect(dialog.getByLabel("Currency")).toHaveValue("CNY");
  await expect(dialog.getByLabel("Address")).toHaveAttribute("placeholder", "Enter address");

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/settings\/suppliers$/);

  await page.goto("/settings/suppliers?dialog=add-supplier");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/settings\/suppliers$/);

  await page.getByRole("link", { name: "+ Add supplier" }).click();
  await dialog.getByLabel("Supplier name").fill("");
  await dialog.getByRole("button", { name: "Save supplier" }).click();
  await expect(dialog.getByText("Enter the supplier name.")).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});
