import { expect, type Page, test } from "@playwright/test";

import { SIGNED_OUT } from "./sessions";

// Batch 1, A5 Passwords: AT-P1 to AT-P3 (Change password, AUTH-5) and the Set password checks that need no real link
// (AUTH-4). A valid link only exists in the API console, so AT-U8 to AT-U10 stay manual; the API tests cover them.
// Anita signs in through the form. Other specs sign in as Anita too, so afterAll always restores E2E_PASSWORD.

test.use({ viewport: { width: 1440, height: 900 }, storageState: SIGNED_OUT });

const ANITA = "anita@mrgarments.com";
const NEW_PASSWORD = "Ledger2026x";
const password = () => {
  const value = process.env.E2E_PASSWORD;
  expect(value, "Set E2E_PASSWORD in .env.test.local").toBeTruthy();
  return value!;
};

async function signIn(page: Page, secret: string) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(ANITA);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const changeForm = (page: Page) => ({
  current: page.getByLabel("Current password", { exact: true }),
  next: page.getByLabel("New password", { exact: true }),
  confirm: page.getByLabel("Confirm new password", { exact: true }),
  save: page.getByRole("button", { name: "Save new password" }),
});

test.describe("Change password as Anita", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({ playwright }, testInfo) => {
    // Put Anita's password back if this run changed it (AUTH-1 then AUTH-5, from the app's own address).
    const baseURL = testInfo.project.use.baseURL ?? "";
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    const signedIn = await api.post("/api/v1/auth/login", { data: { email: ANITA, password: NEW_PASSWORD, keepSignedIn: false } });
    if (signedIn.ok()) {
      const restored = await api.post("/api/v1/auth/change-password", {
        data: { currentPassword: NEW_PASSWORD, newPassword: password(), confirmPassword: password() },
      });
      expect(restored.status(), "restore Anita's E2E_PASSWORD").toBe(204);
    }
    await api.dispose();
  });

  test("AT-P1: wrong current password, no capital letter and a mismatch show M6, M8 and M11", async ({ page }) => {
    await signIn(page, password());
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto("/change-password");
    const form = changeForm(page);
    await form.current.fill("Wrong2026x");
    await form.next.fill("ledger2026");
    await form.confirm.fill("ledger2027");
    await form.save.click();

    await expect(page.getByText("Current password is incorrect.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters, a number and a capital letter.")).toBeVisible();
    await expect(page.getByText("New passwords do not match.")).toBeVisible();
    await expect(form.current).toBeFocused();
    await expect(form.next).toHaveValue("ledger2026");
    await expect(form.save).toBeEnabled();
  });

  test("AT-P2 and AT-P3: a valid change ends the other browser's session; only the new password signs in", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signIn(page, password());
    await expect(page).not.toHaveURL(/\/login/);

    // AT-P2: Anita is also signed in in a second browser.
    const other = await browser.newContext({ storageState: SIGNED_OUT, baseURL, viewport: { width: 1440, height: 900 } });
    const otherPage = await other.newPage();
    await signIn(otherPage, password());
    await expect(otherPage).not.toHaveURL(/\/login/);

    await page.goto("/change-password");
    const form = changeForm(page);
    await form.current.fill(password());
    await form.next.fill(NEW_PASSWORD);
    await form.confirm.fill(NEW_PASSWORD);
    await form.save.click();
    await expect(page).toHaveURL("/profile");
    await expect(page.getByText("Password changed", { exact: true })).toBeVisible();

    // This browser keeps working (renewed session ID); the second one's next action goes to sign-in with M4.
    await page.reload();
    await expect(page).toHaveURL("/profile");
    await otherPage.reload();
    await expect(otherPage).toHaveURL(/\/login/);
    await expect(otherPage.getByText("Your session has ended. Please sign in again.")).toBeVisible();
    await other.close();

    // AT-P3: sign out, then the old password gets M2 and the new one signs in.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await signIn(page, password());
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await signIn(page, NEW_PASSWORD);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("Set password (no real link)", () => {
  test("shows 03's layout without Current password", async ({ page }) => {
    await page.goto("/set-password?token=not-a-real-link");
    await expect(page).toHaveTitle("Set password · MR Garments");
    await expect(page.getByRole("heading", { level: 1, name: "Set your password" })).toBeVisible();
    await expect(page.getByText("Choose a password for your account.")).toBeVisible();
    await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show new password", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show confirm new password", exact: true })).toBeVisible();
    await expect(page.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByRole("list", { name: "Password rules" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  test("checks the confirmation and the rules, then refuses a bad link with M12", async ({ page }) => {
    await page.goto("/set-password?token=not-a-real-link");
    const next = page.getByLabel("New password", { exact: true });
    const confirm = page.getByLabel("Confirm new password", { exact: true });
    const save = page.getByRole("button", { name: "Save password" });

    // M11 in the browser.
    await next.fill(NEW_PASSWORD);
    await confirm.fill(`${NEW_PASSWORD}y`);
    await save.click();
    await expect(page.getByText("New passwords do not match.")).toBeVisible();
    await expect(confirm).toBeFocused();

    // M8 from the API, which checks the rules before the link.
    await next.fill("ledger2026");
    await confirm.fill("ledger2026");
    await save.click();
    await expect(page.getByText("Use at least 8 characters, a number and a capital letter.")).toBeVisible();
    await expect(next).toBeFocused();

    // M12 above the form; the values stay.
    await next.fill(NEW_PASSWORD);
    await confirm.fill(NEW_PASSWORD);
    await save.click();
    await expect(page.getByText("This link is invalid or has expired. Ask your manager for a new one.")).toBeVisible();
    await expect(page).toHaveURL(/\/set-password/);
    await expect(next).toHaveValue(NEW_PASSWORD);
  });
});
