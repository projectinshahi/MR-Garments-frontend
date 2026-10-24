import { expect, test } from "@playwright/test";

// W1-orders: orders list (05_3_Orders_list.jpeg). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

const notInPrototype = (action: string) => `${action} is not included in the current prototype.`;

test("orders list shows the 10 rows of page 1 with stage, status and paid so far", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ New order" })).toHaveAttribute("href", "/orders/new");

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(11);
  const first = table.getByRole("row", { name: /PO-2049/ });
  for (const text of ["Cotton denim fabric", "Foshan Fabrics", "2,400 m", "3 Oct", "1. Order and deposit", "On track", "₹4,70,000"]) {
    await expect(first).toContainText(text);
  }
  await expect(table.getByRole("row", { name: /PO-2041/ })).toContainText("Late 4 days");
  await expect(table.getByRole("row", { name: /PO-2041/ })).toContainText("₹10,00,000");
  await expect(table.getByRole("row", { name: /PO-2028/ })).toContainText("4. Clearing in India");
  await expect(table.getByRole("row", { name: /PO-2028/ })).toContainText("In clearing");
  await expect(table.getByRole("row", { name: /PO-2019/ })).toContainText("6. India warehouse");

  await expect(page.getByText("Showing 1 to 10 of 50 orders")).toBeVisible();
  await expect(page.getByRole("button", { name: "All 50" })).toHaveAttribute("aria-pressed", "true");
});

test("search, selects and chips filter the rows", async ({ page }) => {
  await page.goto("/orders");
  const table = page.getByRole("table");

  await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill("denim");
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(page.getByText("Showing 1 to 2 of 2 orders")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill("");

  await page.getByRole("button", { name: "Stage: All stages" }).click();
  await page.getByRole("menuitemradio", { name: "3. Container loading" }).click();
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.getByRole("button", { name: "Supplier: All suppliers" }).click();
  await page.getByRole("menuitemradio", { name: "Foshan Fabrics" }).click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("row", { name: /PO-2031/ })).toBeVisible();

  await page.getByRole("button", { name: "Stage: 3. Container loading" }).click();
  await page.getByRole("menuitemradio", { name: "All stages" }).click();
  await page.getByRole("button", { name: "Supplier: Foshan Fabrics" }).click();
  await page.getByRole("menuitemradio", { name: "All suppliers" }).click();

  await page.getByRole("button", { name: "Late 3" }).click();
  await expect(page.getByRole("button", { name: "Late 3" })).toHaveAttribute("aria-pressed", "true");
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row", { name: /PO-2049/ })).toHaveCount(0);
});

test("PO-2028 opens its detail; other rows and later pages are not in the prototype (D5)", async ({ page }) => {
  await page.goto("/orders");
  const table = page.getByRole("table");

  await table.getByRole("button", { name: "PO-2041" }).click();
  await expect(page.getByText(notInPrototype("Order detail for PO-2041"))).toBeVisible();

  await page.getByRole("button", { name: "Page 2" }).click();
  await expect(page.getByText(notInPrototype("More orders"))).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Showing 1 to 10 of 50 orders")).toBeVisible();

  await table.getByRole("link", { name: "PO-2028" }).click();
  await expect(page).toHaveURL("/orders/PO-2028");
});
