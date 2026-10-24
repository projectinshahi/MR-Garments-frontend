import { expect, test } from "@playwright/test";

// W1-receiving: Receiving (China) list (22_7.1) and Record receipt (21_7). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("receiving list shows the KPIs and receipts and filters them on the client", async ({ page }) => {
  await page.goto("/receiving");
  await expect(page.getByRole("heading", { level: 1, name: "Receiving (China)" })).toBeVisible();
  for (const text of ["Receipts in September", "from 3 suppliers", "orders not yet in China office", "PO-2035 · PO-2027"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(10);
  const first = table.getByRole("row").nth(1);
  await expect(first).toContainText("24 Sep");
  await expect(first).toContainText("1,160");
  await expect(first).toContainText("40 pcs short");
  await expect(table.getByRole("row", { name: /PO-2027/ })).toContainText("24 rolls");
  await expect(table.getByRole("row", { name: /18 Sep/ })).toContainText("–");

  await page.getByRole("group", { name: "Receipt status" }).getByRole("button", { name: "Short" }).click();
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.getByRole("group", { name: "Receipt status" }).getByRole("button", { name: "All" }).click();

  await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill("hangzhou");
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill("");

  await page.getByRole("button", { name: "Supplier: All suppliers" }).click();
  await page.getByRole("menuitemradio", { name: "Foshan Fabrics" }).click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("row").nth(1)).toContainText("PO-2027");

  await expect(page.getByRole("link", { name: "+ Record receipt" })).toHaveAttribute("href", "/receiving/new");
});

test("record receipt recalculates short and the balance as quantities change", async ({ page }) => {
  await page.goto("/receiving/new");
  await expect(page.getByRole("heading", { level: 1, name: "Record receipt" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/receiving");
  await expect(page.getByLabel("Received on")).toHaveValue("24 Sep 2026");
  await expect(page.getByLabel("Received at office")).toHaveValue("Guangzhou office");
  await expect(page.getByText("Partly received", { exact: true })).toBeVisible();

  const jackets = page.getByRole("row", { name: /Men's jackets/ });
  await expect(jackets).toContainText("40 pcs");
  await expect(page.getByText("Short: 40 pcs × ¥60")).toBeVisible();
  await expect(page.getByText("¥ 29,600")).toBeVisible();

  await page.getByLabel("Received now, Men's jackets").fill("480");
  await expect(jackets).toContainText("20 pcs");
  await expect(page.getByText("Short: 20 pcs × ¥60")).toBeVisible();
  await expect(page.getByText("¥ 30,800")).toBeVisible();

  await page.getByRole("button", { name: "Save receipt" }).click();
  await expect(page.getByText("Save receipt is not included in the current prototype.")).toBeVisible();
});
