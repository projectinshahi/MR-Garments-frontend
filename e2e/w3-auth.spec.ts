import { expect, test } from "@playwright/test";

import { SIGNED_OUT } from "./sessions";

// W3-auth: Sign in (01_1), Forgot password (02_1.1). Role/label locators only (hidden <Activity> routes).
// Batch 1: these pages are for signed-out users; Change password needs a session (w3-change-password.spec.ts).

test.use({ viewport: { width: 1440, height: 900 }, storageState: SIGNED_OUT });

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
