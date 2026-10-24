import { expect, test } from "@playwright/test";

// W2-new-order: New order, Stage 1 (15_4_New_order.jpeg). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("new order shows the prefilled PO-2050 form, deposits and summary", async ({ page }) => {
  await page.goto("/orders/new");
  await expect(page.getByRole("heading", { level: 1, name: "New order" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/orders");

  await expect(page.getByLabel("Purchase order no.")).toHaveValue("PO-2050");
  await expect(page.getByLabel("Order date")).toHaveValue("30 Sep 2026");
  await expect(page.getByLabel("Delivery date")).toHaveValue("25 Oct 2026");
  await expect(page.getByLabel("Supplier")).toHaveValue("Foshan Fabrics");
  await expect(page.getByLabel("Currency")).toHaveValue("CNY (¥)");
  await expect(page.getByLabel("Contact person")).toHaveValue("Mr. Li Wei");
  await expect(page.getByLabel("Phone")).toHaveValue("+86 757 8812 0345");
  await expect(page.getByLabel("City")).toHaveValue("Foshan, China");

  await expect(page.getByLabel("Item, line 1")).toHaveValue("Cotton denim fabric");
  await expect(page.getByLabel("Rate (¥), line 1")).toHaveValue("18.50");
  await expect(page.getByLabel("Quantity, line 3")).toHaveValue("10,000");
  await expect(page.getByLabel("Amount (¥), line 2")).toHaveValue("14,880.00");
  await expect(page.getByRole("status", { name: "Order total" })).toHaveText("¥ 62,780.00");

  for (const text of ["Foshan Fabrics (supplier)", "Sino Freight (agent)", "₹2,32,000", "₹17,400", "₹2,49,400", "¥ 21,500", "¥ 41,280"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
});

test("editing a rate or quantity recalculates the line, the order total and the balance", async ({ page }) => {
  await page.goto("/orders/new");
  await page.getByLabel("Quantity, line 1").fill("3,000");
  await expect(page.getByLabel("Amount (¥), line 1")).toHaveValue("55,500.00");
  await expect(page.getByRole("status", { name: "Order total" })).toHaveText("¥ 73,880.00");
  await expect(page.getByText("¥ 73,880", { exact: true })).toBeVisible();
  await expect(page.getByText("¥ 52,380", { exact: true })).toBeVisible();

  await page.getByLabel("Rate (¥), line 3").fill("0.40");
  await expect(page.getByLabel("Amount (¥), line 3")).toHaveValue("4,000.00");
  await expect(page.getByText("¥ 52,880", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ Add item" }).click();
  await expect(page.getByLabel("Item, line 4")).toHaveValue("");
  await page.getByLabel("Item, line 4").fill("Zippers");
  await page.getByLabel("Rate (¥), line 4").fill("1.20");
  await page.getByLabel("Quantity, line 4").fill("500");
  await expect(page.getByLabel("Amount (¥), line 4")).toHaveValue("600.00");
  await expect(page.getByRole("status", { name: "Order total" })).toHaveText("¥ 74,980.00");
});

test("undesigned actions show the not-in-prototype toast", async ({ page }) => {
  await page.goto("/orders/new");
  for (const action of ["Add deposit", "Save draft", "Place order"]) {
    await page.getByRole("button", { name: action === "Add deposit" ? "+ Add deposit" : action }).click();
    await expect(page.getByText(`${action} is not included in the current prototype.`)).toBeVisible();
  }
});
