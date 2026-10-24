import { expect, test } from "@playwright/test";

// W2-warehouse: Warehouse list (30_11.1) and Receive goods (29_11). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("warehouse list shows stock, receipts and totals, and searches on the client", async ({ page }) => {
  await page.goto("/warehouse");
  await expect(page.getByRole("heading", { level: 1, name: "Warehouse" })).toBeVisible();
  for (const text of ["Received in stock", "15,800 pcs", "6 items", "Retail team", "6,000 pcs", "5,900 pcs", "3,900 pcs"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }

  const table = page.getByRole("table");
  // Header, six receipts and the totals row.
  await expect(table.getByRole("row")).toHaveCount(8);
  const first = table.getByRole("row").nth(1);
  for (const text of ["3 Oct 2026", "Denim jeans", "PO-2028 · Guangzhou Textile Co.", "CAIU 2298076", "2,500", "₹550.80"]) {
    await expect(first).toContainText(text);
  }
  const totals = table.getByRole("row").last();
  for (const text of ["Total", "6 items", "15,800", "6,000", "5,900", "3,900", "₹267.19"]) {
    await expect(totals).toContainText(text);
  }
  await expect(page.getByText("Cost per piece is shown to management only. Warehouse staff see quantities.")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search item or PO" }).fill("po-2030");
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").nth(1)).toContainText("Track pants");
  await expect(totals).toContainText("1 item");
  await expect(totals).toContainText("₹236.33");
  await page.getByRole("searchbox", { name: "Search item or PO" }).fill("");
  await expect(table.getByRole("row")).toHaveCount(8);

  await page.getByRole("button", { name: "Team: All teams" }).click();
  await page.getByRole("menuitemradio", { name: "Retail team" }).click();
  await expect(page.getByText("Filter by team is not included in the current prototype.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Team: All teams" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Warehouse: Main warehouse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Receive goods" })).toHaveAttribute("href", "/warehouse/receive");
});

test("receive goods updates the team split and cost by team as quantities change", async ({ page }) => {
  await page.goto("/warehouse/receive");
  await expect(page.getByRole("heading", { level: 1, name: "Receive goods" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/warehouse");
  await expect(page.getByLabel("Vehicle number")).toHaveValue("KL 07 CD 4821");
  await expect(page.getByLabel("Vehicle number")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Unloaded on")).toHaveValue("3 Oct 2026");
  await expect(page.getByLabel("Warehouse", { exact: true })).toHaveValue("Main warehouse");
  await expect(page.getByText("Total for 2,500 pcs")).toBeVisible();
  await expect(page.getByText("₹550.80")).toBeVisible();

  const note = page.getByText("✓ Matches the 50 bundles loaded");
  await expect(note).toBeVisible();
  await page.getByLabel("Bundles received").fill("48");
  await expect(note).toBeHidden();
  await page.getByLabel("Bundles received").fill("50");
  await expect(note).toBeVisible();

  const summary = page.getByRole("status").filter({ hasText: "given to teams" });
  await expect(summary).toContainText("✓ 2,500 of 2,500 pcs given to teams");
  await expect(summary).toContainText("Nothing left unassigned");
  const retail = page.getByRole("listitem").filter({ hasText: "Retail team" });
  await expect(retail).toContainText("₹5,50,800");

  await page.getByLabel("Retail team, Denim jeans").fill("800");
  await expect(summary).toContainText("✓ 2,300 of 2,500 pcs given to teams");
  await expect(summary).toContainText("200 pcs left unassigned");
  await expect(retail).toContainText("800 pcs");
  await expect(retail).toContainText("₹4,40,640");
  await expect(page.getByRole("meter", { name: "Retail team share of 2,500 pcs" })).toHaveAttribute("aria-valuenow", "800");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Save draft is not included in the current prototype.")).toBeVisible();
  await page.getByRole("button", { name: "Save and add to stock" }).click();
  await expect(page.getByText("Save and add to stock is not included in the current prototype.")).toBeVisible();
});
