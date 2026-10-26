import { expect, test } from "@playwright/test";

// W3-auth: Change password (03_1.2), signed in as Management. Batch 1: the fields start empty (a real password form
// can't be prefilled with the reference's examples), so the meter and rules are checked by typing. Nothing is saved
// here (the saving flows are in batch1-a5-passwords.spec.ts). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("change password starts empty, updates the strength and rules live, and shows field errors", async ({ page }) => {
  await page.goto("/change-password");
  await expect(page).toHaveTitle("Change password · MR Garments");
  await expect(page.getByRole("heading", { level: 1, name: "Change password" })).toBeVisible();

  const current = page.getByLabel("Current password", { exact: true });
  const next = page.getByLabel("New password", { exact: true });
  const confirm = page.getByLabel("Confirm new password", { exact: true });
  for (const field of [current, next, confirm]) await expect(field).toHaveValue("");
  for (const field of ["current password", "new password", "confirm new password"]) {
    await expect(page.getByRole("button", { name: `Show ${field}`, exact: true })).toBeVisible();
  }

  const meter = page.getByRole("meter", { name: "Password strength" });
  const rules = page.getByRole("list", { name: "Password rules" });
  await expect(meter).toHaveAttribute("aria-valuenow", "0");

  // The reference's state: 12 characters with a number but no capital letter.
  await next.fill("garments2026");
  await expect(meter).toHaveAttribute("aria-valuenow", "3");
  await expect(rules.getByRole("listitem")).toHaveText(["Met: At least 8 characters", "Met: One number", "Not met: One capital letter"]);

  await next.fill("Garments2026");
  await expect(meter).toHaveAttribute("aria-valuenow", "4");
  await expect(rules.getByRole("listitem").nth(2)).toHaveText("Met: One capital letter");

  await next.fill("short");
  await expect(meter).toHaveAttribute("aria-valuenow", "0");
  await expect(rules.getByRole("listitem")).toHaveText(["Not met: At least 8 characters", "Not met: One number", "Not met: One capital letter"]);

  await page.getByRole("button", { name: "Show new password", exact: true }).click();
  await expect(next).toHaveAttribute("type", "text");

  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/profile");

  // Empty fields: M5, M7, M10 from the API under each field (E1); focus on the first; Save works again.
  await next.fill("");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Enter your current password.")).toBeVisible();
  await expect(page.getByText("Enter a new password.")).toBeVisible();
  await expect(page.getByText("Confirm your new password.")).toBeVisible();
  await expect(current).toBeFocused();
  await expect(current).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Save new password" })).toBeEnabled();

  // K8: Cancel goes to My profile without saving.
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/profile");
});
