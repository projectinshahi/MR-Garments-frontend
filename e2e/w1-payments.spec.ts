import { expect, test } from "@playwright/test";

// W1-payments: Deposits & Payments (16_5_Deposits_&_Payments.jpeg). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("payments shows the KPIs, orders table and PO-2041 payment detail from the reference", async ({ page }) => {
  await page.goto("/payments");
  await expect(page.getByRole("heading", { level: 1, name: "Deposits & Payments" })).toBeVisible();

  for (const text of ["₹25,15,000", "across 5 open orders", "1 payment · PO-2041 on 5 Oct", "₹42,60,000", "4 payments"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(6);
  await expect(table.getByRole("row", { name: /PO-2049/ })).toContainText("₹4,70,000");
  await expect(table.getByRole("row", { name: /PO-2047/ })).toContainText("Not yet due");
  await expect(table.getByRole("row", { name: /PO-2041/ })).toContainText("₹10,00,000");
  await expect(table.getByRole("row", { name: /PO-2041/ })).toContainText("5 Oct");

  await expect(page.getByRole("heading", { level: 2, name: "PO-2041 payments" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "1. Deposit" })).toBeVisible();
  await expect(page.getByText("¥ 50,000 × 20.00")).toBeVisible();
  await expect(page.getByText("¥ 50,000 × 30.00")).toBeVisible();
  await expect(page.getByText("Due 5 Oct", { exact: true })).toBeVisible();
  await expect(page.getByText("₹25,00,000", { exact: true })).toBeVisible();
});

test("search filters the orders table by PO or supplier", async ({ page }) => {
  await page.goto("/payments");
  const table = page.getByRole("table");
  const search = page.getByRole("searchbox", { name: "Search PO or supplier" });

  await search.fill("guangzhou");
  await expect(table.getByRole("row")).toHaveCount(3);
  await search.fill("PO-2038");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Yiwu Trims Ltd.");
  await search.fill("nothing");
  await expect(table).toContainText("No orders match your search.");
});

test("undesigned actions show the prototype notice (D5)", async ({ page }) => {
  await page.goto("/payments");

  await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
  await expect(page.getByText("Record payment is not included in the current prototype.")).toBeVisible();

  await page.getByRole("button", { name: "+ Record payment for PO-2041" }).click();
  await expect(page.getByText("Record payment for PO-2041 is not included in the current prototype.")).toBeVisible();

  await page.getByRole("button", { name: "PO-2044" }).press("Enter");
  await expect(page.getByText("Payment detail for PO-2044 is not included in the current prototype.")).toBeVisible();
});
