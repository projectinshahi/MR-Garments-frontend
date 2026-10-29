import { type Browser, expect, type Page, test } from "@playwright/test";

import { SIGNED_OUT } from "./sessions";

// Password policy (replaces Batch 1 A5's Change password and Set password flows): nobody changes or resets their own
// password in the app. Management types a new user's password on Add user (batch1-a2-users.spec.ts, AT-U7) and can set
// a new one for another user on Edit user (USR-4), which signs that user out everywhere. Change password, Forgot
// password and Set password are gone, and AUTH-4/AUTH-5 answer 403 password_change_disabled.
// Joseph M (Warehouse staff) is the user whose password is set: no saved session or other spec signs him in, and his
// E2E_PASSWORD is put back afterwards.

test.use({ viewport: { width: 1440, height: 900 } });

const JOSEPH = "joseph@mrgarments.com";
const NEW_PASSWORD = "Ledger2026x";
const M2 = "Email or password is incorrect.";
const M4 = "Your session has ended. Please sign in again.";
const DISABLED = "Passwords are set by a Management user.";
const REMOVED = ["/change-password", "/forgot-password", "/set-password?token=not-a-real-link"];

const e2ePassword = () => {
  const value = process.env.E2E_PASSWORD;
  expect(value, "Set E2E_PASSWORD in .env.test.local").toBeTruthy();
  return value!;
};

async function signIn(page: Page, email: string, secret: string) {
  if (!page.url().includes("/login")) await page.goto("/login");
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signedOutPage(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, storageState: SIGNED_OUT, viewport: { width: 1440, height: 900 } });
  return { context, page: await context.newPage() };
}

test("the self-service password pages are gone, signed out or in", async ({ page, browser, baseURL }) => {
  // Signed in as Suresh: each goes to his landing page.
  for (const path of REMOVED) {
    await page.goto(path);
    await expect(page, path).toHaveURL("/");
  }

  // Signed out: each goes to sign in, which has no Forgot password link, only the note.
  const visitor = await signedOutPage(browser, baseURL);
  try {
    for (const path of REMOVED) {
      await visitor.page.goto(path);
      await expect(visitor.page, path).toHaveURL("/login");
    }
    await expect(visitor.page.getByRole("link", { name: "Forgot password?" })).toHaveCount(0);
    await expect(visitor.page.getByText("Forgot your password or need an account? Ask a Management user.")).toBeVisible();
  } finally {
    await visitor.context.close();
  }
});

test("AUTH-5 change-password and AUTH-4 reset-password answer 403 password_change_disabled", async ({ page, baseURL }) => {
  const headers = { Origin: baseURL ?? "" };
  const change = await page.request.post("/api/v1/auth/change-password", {
    data: { currentPassword: e2ePassword(), newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
    headers,
  });
  const reset = await page.request.post("/api/v1/auth/reset-password", { data: { token: "not-a-real-link", newPassword: NEW_PASSWORD }, headers });
  for (const response of [change, reset]) {
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "password_change_disabled", message: DISABLED } });
  }
});

test("Management sets Joseph's new password: his session ends and only the new password signs in", async ({ page, browser, baseURL }) => {
  const joseph = await signedOutPage(browser, baseURL);
  await page.goto("/users");
  // From the link, not the URL: the list stays on screen (and in the address bar) until the form is ready.
  const edit = page.getByRole("link", { name: "Edit Joseph M" });
  const id = new URL((await edit.getAttribute("href"))!, baseURL).searchParams.get("id")!;
  await edit.click();
  try {
    await signIn(joseph.page, JOSEPH, e2ePassword());
    await expect(joseph.page).not.toHaveURL(/\/login/);

    const field = page.getByLabel("Set a new password", { exact: true });
    await expect(field).toHaveValue("");
    // M8 from the API under the field; nothing saved.
    await field.fill("ledger2026");
    await expect(page.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuenow", "2");
    await page.getByRole("button", { name: "Save user" }).click();
    await expect(page.getByText("Use at least 8 characters, a number and a capital letter.")).toBeVisible();
    await expect(field).toBeFocused();

    await field.fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Save user" }).click();
    await expect(page).toHaveURL("/users");
    await expect(page.getByText("User saved", { exact: true })).toBeVisible();

    // His next action goes to sign in with M4; the old password gets M2, the new one signs in.
    await joseph.page.reload();
    await expect(joseph.page).toHaveURL(/\/login/);
    await expect(joseph.page.getByText(M4)).toBeVisible();
    await signIn(joseph.page, JOSEPH, e2ePassword());
    await expect(joseph.page.getByText(M2)).toBeVisible();
    await signIn(joseph.page, JOSEPH, NEW_PASSWORD);
    await expect(joseph.page).not.toHaveURL(/\/login/);
  } finally {
    const restored = await page.request.patch(`/api/v1/users/${id}`, { data: { password: e2ePassword() }, headers: { Origin: baseURL ?? "" } });
    expect(restored.status(), "restore Joseph's E2E_PASSWORD").toBe(200);
    await joseph.context.close();
  }
});

test("Suresh's own account has no password field, and the API refuses his own password with 403", async ({ page, baseURL }) => {
  await page.goto("/users");
  await page.getByRole("link", { name: "Edit Suresh Menon" }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Suresh Menon");
  await expect(page.getByLabel(/password/i)).toHaveCount(0);

  const id = new URL(page.url()).searchParams.get("id")!;
  const response = await page.request.patch(`/api/v1/users/${id}`, { data: { password: NEW_PASSWORD }, headers: { Origin: baseURL ?? "" } });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("password_change_disabled");
});
