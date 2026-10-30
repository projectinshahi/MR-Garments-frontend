import { expect, test } from "@playwright/test";

import { SIGNED_OUT } from "./sessions";

// W3-auth: Sign in (01_1). Role/label locators only (hidden <Activity> routes).
// Password policy: Forgot password and Change password are gone (batch1-a5-passwords.spec.ts); the sign-in note says
// to ask a Management user.

test.use({ viewport: { width: 1440, height: 900 }, storageState: SIGNED_OUT });

test("sign in toggles the password, has no forgot password link and signs in as Suresh (AT-A2)", async ({ page }) => {
  const e2ePassword = process.env.E2E_PASSWORD;
  expect(e2ePassword, "Set E2E_PASSWORD in .env.test.local").toBeTruthy();
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

  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveCount(0);
  await expect(page.getByText("Forgot your password or need an account? Ask a Management user.")).toBeVisible();

  await email.fill("suresh@mrgarments.com");
  await password.fill(e2ePassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  // B2: the sidebar block shows "SM · Suresh Menon · Full access".
  const block = page.getByRole("button", { name: /Suresh Menon/ });
  await expect(block).toContainText("SM");
  await expect(block).toContainText("Full access");
});
