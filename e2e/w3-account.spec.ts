import { expect, test } from "@playwright/test";

// W3-account: My profile (51_17.2); Notifications is live (e2e/notifications.spec.ts). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

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
