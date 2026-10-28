import { expect, test } from "@playwright/test";

// W3-account: Notifications (50_17.1) and My profile (51_17.2). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("notifications list shows seven rows, three unread, and filters them by chip", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();

  const list = page.getByRole("list", { name: "Notifications" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(7);
  await expect(rows.first()).toContainText("PO-2044 delivery is 1 day late");
  await expect(rows.first()).toContainText("Shenzhen Apparel · was due 29 Sep · Men’s shirts 1,800 pcs");
  await expect(rows.first()).toContainText("Today, 09:00");
  await expect(rows.nth(2)).toContainText("Guangzhou Textile Co. · ¥50,000 · about ₹15,00,000");
  await expect(rows.last()).toContainText("30 Sep, 09:00");
  await expect(list.getByText("New", { exact: true })).toHaveCount(3);
  await expect(page.getByText("Reminders go to procurement and management the day before a delivery is due")).toBeVisible();

  const chips = page.getByRole("group", { name: "Filter notifications" });
  await expect(chips.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

  await chips.getByRole("button", { name: "Unread (3)" }).click();
  await expect(rows).toHaveCount(3);
  await expect(chips.getByRole("button", { name: "Unread (3)" })).toHaveAttribute("aria-pressed", "true");

  await chips.getByRole("button", { name: "Late deliveries" }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.last()).toContainText("PO-2041 delivery is 4 days late");

  await chips.getByRole("button", { name: "Payments" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Payment due in 5 days: PO-2041");

  await chips.getByRole("button", { name: "Containers" }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Container MSKU 4471203 arrives on 2 Oct");

  await chips.getByRole("button", { name: "All" }).click();
  await expect(rows).toHaveCount(7);

  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByText("Mark all as read is not included in the current prototype.")).toBeVisible();
});

test("my profile shows the details, password date and switches, and keeps edits in client state", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: "My profile" })).toBeVisible();

  await expect(page.getByLabel("Full name")).toHaveValue("Suresh Menon");
  await expect(page.getByLabel("Email")).toHaveValue("suresh@mrgarments.com");
  await expect(page.getByLabel("Phone")).toHaveValue("+91 98470 20011");
  await expect(page.getByLabel("Role")).toHaveValue("Management");
  await expect(page.getByLabel("Office")).toHaveValue("Head office");
  await expect(page.getByLabel("Language")).toHaveValue("English");
  for (const field of ["Email", "Role", "Office"]) {
    await expect(page.getByLabel(field)).not.toBeEditable();
  }

  await page.getByLabel("Full name").fill("Suresh K Menon");
  await expect(page.getByLabel("Full name")).toHaveValue("Suresh K Menon");

  await expect(page.getByText("Last changed 12 Aug 2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Change password" })).toHaveAttribute("href", "/change-password");
  // Batch 1 (AUTH-2): Sign out is a button that ends the session (shell.spec.ts covers the sign-out itself).
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  const settings = page.getByRole("list", { name: "Notification settings" });
  for (const name of ["Delivery reminders", "Late deliveries", "Payments due"]) {
    await expect(settings.getByRole("switch", { name })).toBeChecked();
  }
  const shortReceipts = settings.getByRole("switch", { name: "Short receipts" });
  await expect(shortReceipts).not.toBeChecked();
  await shortReceipts.click();
  await expect(shortReceipts).toBeChecked();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Save changes is not included in the current prototype.")).toBeVisible();
});
