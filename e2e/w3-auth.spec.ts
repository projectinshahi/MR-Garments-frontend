import { expect, test } from "@playwright/test";

// W3-auth: Sign in (01_1), Forgot password (02_1.1), Change password (03_1.2). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("sign in toggles the password, links to forgot password and opens the dashboard", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

  const email = page.getByLabel("Email or username");
  await expect(email).toHaveValue("");
  await expect(email).toHaveAttribute("placeholder", "name@mrgarments.com");

  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");

  const keep = page.getByRole("checkbox", { name: "Keep me signed in" });
  await expect(keep).not.toBeChecked();
  await keep.click();
  await expect(keep).toBeChecked();

  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  await expect(page.getByText("Need access? Ask your manager for an account.")).toBeVisible();

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});

test("forgot password is prefilled and its action is not in the prototype", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeVisible();
  await expect(page.getByLabel("Email or username")).toHaveValue("name@mrgarments.com");
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");

  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Send reset link is not included in the current prototype.")).toBeVisible();
});

test("change password shows 3 of 4 strength and updates the rules live", async ({ page }) => {
  await page.goto("/change-password");
  await expect(page.getByRole("heading", { level: 1, name: "Change password" })).toBeVisible();

  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue(/^.{10}$/);
  const next = page.getByLabel("New password", { exact: true });
  await expect(next).toHaveValue(/^.{12}$/);
  await expect(page.getByLabel("Confirm new password", { exact: true })).toHaveValue(/^.{12}$/);
  for (const field of ["current password", "new password", "confirm new password"]) {
    await expect(page.getByRole("button", { name: `Show ${field}`, exact: true })).toBeVisible();
  }

  const meter = page.getByRole("meter", { name: "Password strength" });
  const rules = page.getByRole("list", { name: "Password rules" });
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
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Save new password is not included in the current prototype.")).toBeVisible();
});
