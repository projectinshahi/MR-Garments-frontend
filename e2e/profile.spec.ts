import type { Page } from "@playwright/test";

import type { Profile, ProfileResponse } from "../src/lib/api/types";
import { expect, field, freshSignIn, longDate, test, toast } from "./live-api";

// My profile (51_17.2) against PRF-1 and PRF-2, as Priya (Procurement) in a session made for this file, so no saved
// session is touched. Spec files share one test database and other specs check Priya's name (batch1-a1-auth,
// batch1-a2-users), so every test puts her profile back afterwards. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 }, storageState: freshSignIn("priya@mrgarments.com") });

const NOTIFICATIONS_LINE = "Choosing which notifications you get isn't available yet. All of yours appear on the Notifications page.";

/** PRF-2 straight to the API from the page's session, with the Origin header the same-site check needs. */
const patchProfile = (page: Page, baseURL: string | undefined, data: unknown) =>
  page.request.patch("/api/v1/profile", { data, headers: { Origin: baseURL ?? "" } });

let original: Profile | undefined;

test.beforeEach(async ({ page }) => {
  const response = await page.request.get("/api/v1/profile");
  expect(response.status()).toBe(200);
  original = ((await response.json()) as ProfileResponse).profile;
});

test.afterEach(async ({ page, baseURL }) => {
  if (!original) return;
  const { name, phone, language } = original;
  expect((await patchProfile(page, baseURL, { name, phone, language })).status(), "restore Priya's profile").toBe(200);
});

test("shows the signed-in user's own profile; email, role and office are read-only; no password change or switches", async ({ page }) => {
  const profile = original!;
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: "My profile" })).toBeVisible();
  await expect(page.getByText("Sample Data — Not Live")).toHaveCount(0);

  await expect(field(page, "Full name")).toHaveValue(profile.name);
  await expect(field(page, "Email")).toHaveValue("priya@mrgarments.com");
  await expect(field(page, "Phone")).toHaveValue(profile.phone);
  await expect(field(page, "Role")).toHaveValue("Procurement");
  await expect(field(page, "Office")).toHaveValue(profile.office?.name ?? "");
  await expect(field(page, "Language")).toHaveValue(profile.language);
  for (const label of ["Email", "Role", "Office"]) await expect(field(page, label)).not.toBeEditable();

  const changed = profile.passwordChangedAt
    ? `Last changed ${longDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(profile.passwordChangedAt)))}`
    : "Not set";
  await expect(page.getByText(changed, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /change password/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /change password/i })).toHaveCount(0);

  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText(NOTIFICATIONS_LINE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("the header's Save changes saves name and phone; the sidebar shows the new name and it stays after a reload", async ({ page }) => {
  await page.goto("/profile");
  await field(page, "Full name").fill("Priya Profile Test");
  await field(page, "Phone").fill("+91 90000 00001");

  const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().endsWith("/api/v1/profile"));
  await page.getByRole("button", { name: "Save changes" }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  // Only the editable keys.
  expect(Object.keys(response.request().postDataJSON() as object).sort()).toEqual(["language", "name", "phone"]);
  await expect(toast(page, "Profile saved")).toBeVisible();
  await expect(page.getByRole("button", { name: /Priya Profile Test/ })).toBeVisible();

  await page.reload();
  await expect(field(page, "Full name")).toHaveValue("Priya Profile Test");
  await expect(field(page, "Phone")).toHaveValue("+91 90000 00001");
});

test("a blank name gets M13 under the field and nothing is saved", async ({ page }) => {
  let patched = false;
  page.on("request", (r) => {
    if (r.method() === "PATCH" && r.url().endsWith("/api/v1/profile")) patched = true;
  });
  await page.goto("/profile");
  await field(page, "Full name").fill("   ");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Enter the full name.", { exact: true })).toBeVisible();
  await expect(field(page, "Full name")).toBeFocused();
  expect(patched).toBe(false);
});

test("PRF-2 refuses keys the profile can't change, an empty body and a blank name", async ({ page, baseURL }) => {
  for (const body of [{ email: "other@mrgarments.com" }, { role: "Management" }, { id: "someone-else", name: "X" }, { password: "Garments2026" }, {}]) {
    const response = await patchProfile(page, baseURL, body);
    expect(response.status(), JSON.stringify(body)).toBe(400);
  }
  const blank = await patchProfile(page, baseURL, { name: "  " });
  expect(blank.status()).toBe(422);
  expect(((await blank.json()) as { error: { fields?: Record<string, string> } }).error.fields?.name).toBe("Enter the full name.");
  // Nothing changed.
  expect(((await (await page.request.get("/api/v1/profile")).json()) as ProfileResponse).profile).toEqual(original);
});
