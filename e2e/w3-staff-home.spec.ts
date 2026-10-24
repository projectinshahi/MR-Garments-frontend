import { expect, test } from "@playwright/test";

// W3-staff-home: entry-only China staff home (39_14_Staff_home.jpeg). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("staff home shows the banner, waiting orders, recent receipts and the account's access", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.getByText("Wed, 30 Sep 2026", { exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { level: 2, name: "Good afternoon, Chen Yu" })).toBeVisible();
  await expect(page.getByText("5 orders are waiting for you to record what was received in China.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Record a receipt" })).toHaveAttribute("href", "/receiving/new");

  const waiting = page.getByRole("region", { name: "Waiting for you" }).getByRole("table");
  await expect(waiting.getByRole("row")).toHaveCount(6);
  const first = waiting.getByRole("row").nth(1);
  for (const text of ["PO-2041", "Cotton fabric rolls", "Guangzhou Textile Co.", "5,000 m", "26 Sep · late"]) {
    await expect(first).toContainText(text);
  }
  await expect(waiting.getByRole("row", { name: /PO-2038/ })).toContainText("40,000 pcs");
  await expect(waiting.getByRole("row", { name: /PO-2047/ })).toContainText("1 Oct");
  await expect(waiting.getByRole("row", { name: /PO-2049/ })).toContainText("3 Oct");

  const recent = page.getByRole("region", { name: "Entered by you recently" }).getByRole("table");
  await expect(recent.getByRole("row")).toHaveCount(3);
  await expect(recent.getByRole("row", { name: /Men's jackets/ })).toContainText("460 pcs");
  await expect(recent.getByRole("row", { name: /Care labels/ })).toContainText("500 pcs");
  await expect(recent.getByRole("row", { name: /Care labels/ })).toContainText("24 Sep");

  for (const text of ["Record goods received in China", "Change a receipt you entered", "Cost and landed cost", "Reports and the management dashboard"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Clearing agents and transporters do not log in.", { exact: true })).toBeVisible();
});

test("undesigned staff actions show the prototype notice", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Record receipt for PO-2044" }).click();
  await expect(page.getByText("Record receipt for PO-2044 is not included in the current prototype.")).toBeVisible();

  await page.getByRole("button", { name: "Edit receipt PO-2035 Men's jackets" }).click();
  await expect(page.getByText("Edit receipt is not included in the current prototype.")).toBeVisible();
});
