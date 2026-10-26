import { expect, type Page, test } from "@playwright/test";

// Batch 1 acceptance tests AT-S1 to AT-S7 (Settings part; the Roles tab belongs to the Users spec), signed in as
// Management on the seeded test database, which is reset at the start of every run. Serial: AT-S1 counts the seeded
// suppliers before AT-S4 adds "Ningbo Denim Works", and AT-S5 needs that supplier.

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

const SUPPLIERS = [
  ["Guangzhou Textile Co.", "Mr. Zhao Lin", "+86 138 0013 2244", "Guangzhou"],
  ["Shenzhen Apparel", "Ms. Liu Yan", "+86 139 2266 8810", "Shenzhen"],
  ["Foshan Fabrics", "Mr. Chen Hao", "+86 137 2288 5501", "Foshan"],
  ["Yiwu Trims Ltd.", "Ms. Wu Mei", "+86 135 5799 3120", "Yiwu"],
  ["Hangzhou Knits", "Mr. Sun Jie", "+86 136 5711 4092", "Hangzhou"],
];
const NINGBO = {
  name: "Ningbo Denim Works",
  city: "Ningbo",
  contactPerson: "Mr. Xu Feng",
  phone: "+86 138 5740 9921",
  address: "88 Zhongshan Road, Ningbo",
  notes: "Denim only; ships from Ningbo port",
};
const M22 = "A supplier with this name already exists.";

const rows = (page: Page) => page.getByRole("table").getByRole("row");
const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Add supplier" });

async function openAddSupplier(page: Page) {
  await page.goto("/settings/suppliers");
  await page.getByRole("link", { name: "+ Add supplier" }).click();
  await expect(page).toHaveURL(/\?dialog=add-supplier$/);
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test("AT-S1: Suppliers lists the 5 seeded suppliers as 40, with 0 open orders", async ({ page }) => {
  await page.goto("/settings/suppliers");
  await expect(rows(page)).toHaveCount(SUPPLIERS.length + 1);
  for (const [index, supplier] of SUPPLIERS.entries()) {
    await expect(rows(page).nth(index + 1).getByRole("cell")).toHaveText([...supplier, "¥", "0", "Active", "Edit"]);
  }
});

test("AT-S2: search by name or phone and the Active/Inactive/All chips filter the rows", async ({ page }) => {
  await page.goto("/settings/suppliers");
  const search = page.getByRole("searchbox", { name: "Search by name or phone" });
  const status = page.getByRole("group", { name: "Status" });

  await search.fill("SHENZHEN apparel");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toContainText("Shenzhen Apparel");
  await search.fill("+86 135");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toContainText("Yiwu Trims Ltd.");
  await search.fill("+861365711");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toContainText("Hangzhou Knits");
  await search.fill("");
  await expect(rows(page)).toHaveCount(6);

  await status.getByRole("button", { name: "Inactive" }).click();
  await expect(page.getByRole("table").getByText("No suppliers match these filters.")).toBeVisible();
  await status.getByRole("button", { name: "All" }).click();
  await expect(rows(page)).toHaveCount(6);
  await status.getByRole("button", { name: "Active", exact: true }).click();
  await expect(rows(page)).toHaveCount(6);
});

test("AT-S3: Save with the supplier name empty shows M21 under Supplier name", async ({ page }) => {
  const dialog = await openAddSupplier(page);
  const name = dialog.getByLabel("Supplier name");
  await name.fill("");
  await dialog.getByRole("button", { name: "Save supplier" }).click();

  await expect(dialog.getByText("Enter the supplier name.")).toBeVisible();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(dialog.getByLabel("City")).toHaveValue("Ningbo");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(rows(page)).toHaveCount(6);
});

test("AT-S4: adding Ningbo Denim Works closes the dialog, toasts and persists with address and notes", async ({ page }) => {
  const dialog = await openAddSupplier(page);
  await dialog.getByLabel("Supplier name").fill(NINGBO.name);
  await dialog.getByLabel("City").fill(NINGBO.city);
  await dialog.getByLabel("Contact person").fill(NINGBO.contactPerson);
  await dialog.getByLabel("Phone / WeChat").fill(NINGBO.phone);
  await dialog.getByLabel("Address").fill(NINGBO.address);
  await dialog.getByLabel("Notes").fill(NINGBO.notes);
  await dialog.getByRole("button", { name: "Save supplier" }).click();

  // K7: the dialog closes, ?dialog=add-supplier leaves the address, the toast shows, the list reloads (Active chip).
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/settings\/suppliers$/);
  await expect(page.getByText("Supplier added", { exact: true })).toBeVisible();
  const cells = [NINGBO.name, NINGBO.contactPerson, NINGBO.phone, NINGBO.city, "¥", "0", "Active", "Edit"];
  await expect(rows(page).nth(6).getByRole("cell")).toHaveText(cells);

  await page.reload();
  await expect(rows(page)).toHaveCount(7);
  await expect(rows(page).nth(6).getByRole("cell")).toHaveText(cells);

  // Address and notes are stored, though the table doesn't show them.
  const response = await page.request.get("/api/v1/suppliers?search=ningbo");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual([{ ...NINGBO, id: expect.any(String), currency: "CNY", openOrders: 0, status: "Active" }]);
});

test("AT-S5: adding ningbo denim works again shows M22 and saves nothing", async ({ page }) => {
  const dialog = await openAddSupplier(page);
  const name = dialog.getByLabel("Supplier name");
  const save = dialog.getByRole("button", { name: "Save supplier" });
  await name.fill("ningbo denim works");
  await save.click();

  await expect(dialog.getByText(M22)).toBeVisible();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("ningbo denim works");
  await expect(dialog.getByLabel("Contact person")).toHaveValue(NINGBO.contactPerson);
  await expect(save).toBeEnabled();
  await expect(page).toHaveURL(/\?dialog=add-supplier$/);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(rows(page)).toHaveCount(7);
  await expect(page.getByRole("table").getByRole("row", { name: /ningbo denim works/i })).toHaveCount(1);
});

test("AT-S6: Edit on a supplier shows the unchanged prototype message", async ({ page }) => {
  await page.goto("/settings/suppliers");
  await page.getByRole("button", { name: "Edit Guangzhou Textile Co." }).click();
  await expect(page.getByText("Edit Guangzhou Textile Co. is not included in the current prototype.")).toBeVisible();
});

// B6: values that differ from 41-46 come from later batches (0, ₹0, "–", empty orders) or from real users (Staff).
// Staff is matched loosely, because other specs may add or deactivate users at these offices.
const READ_ONLY: { path: string; action: string; rows: (string | RegExp)[][] }[] = [
  {
    path: "/settings/shipping-agents",
    action: "Add shipping agent",
    rows: [
      ["Sino Freight", "Ms. Zhang Min", "+86 20 8123 4567", "Guangzhou", "0"],
      ["Dragon Cargo", "Mr. Huang Bo", "+86 755 8899 1200", "Shenzhen", "0"],
    ],
  },
  {
    path: "/settings/clearing-agents",
    action: "Add clearing agent",
    rows: [
      ["Kochi Clearing Services", "Mr. Anil Kumar", "+91 98470 12345", "Kochi", "0"],
      ["Southern Port Agents", "Mr. Rajesh Nair", "+91 98950 44210", "Kochi", "0"],
    ],
  },
  {
    path: "/settings/transport-companies",
    action: "Add transport company",
    rows: [
      ["Kerala Roadways", "Mr. Biju Thomas", "+91 94470 30011", "0"],
      ["Malabar Carriers", "Mr. Salim P", "+91 98460 77120", "0"],
    ],
  },
  {
    path: "/settings/offices",
    action: "Add office or warehouse",
    rows: [
      ["Guangzhou office", "China office", "China", "Guangzhou", /Wang Fang/],
      ["India office", "India office", "India", "Kochi", /Anil Sharma/],
      ["Main warehouse", "Warehouse", "India", "Kochi", /Joseph M/],
    ],
  },
  {
    path: "/settings/teams",
    action: "Add team",
    rows: [
      ["Retail team", "0", "₹0", "–"],
      ["Wholesale team", "0", "₹0", "–"],
      ["Online team", "0", "₹0", "–"],
    ],
  },
  {
    path: "/settings/items",
    action: "Add item",
    rows: [
      ["Denim jeans", "Pieces", "50", ""],
      ["Track pants", "Pieces", "50", ""],
      ["Kids t-shirts", "Pieces", "50", ""],
      ["Ladies kurtis", "Pieces", "50", ""],
      ["Polo shirts", "Pieces", "50", ""],
      ["Men's shorts", "Pieces", "50", ""],
      ["Men's jackets", "Pieces", "50", ""],
      ["Cotton fabric", "Metres", "Roll", ""],
    ],
  },
];

test("AT-S7: Settings tabs 2-7 are read-only lists with the B6 values and unchanged messages", async ({ page }) => {
  for (const tab of READ_ONLY) {
    await page.goto(tab.path);
    await expect(rows(page)).toHaveCount(tab.rows.length + 1);
    for (const [index, cells] of tab.rows.entries()) {
      await expect(rows(page).nth(index + 1).getByRole("cell")).toHaveText([...cells, "Active", "Edit"]);
    }

    await page.getByRole("button", { name: `+ ${tab.action}` }).click();
    await expect(page.getByText(`${tab.action} is not included in the current prototype.`)).toBeVisible();
    const first = String(tab.rows[0]![0]);
    await page.getByRole("button", { name: `Edit ${first}` }).click();
    await expect(page.getByText(`Edit ${first} is not included in the current prototype.`)).toBeVisible();
  }
});
