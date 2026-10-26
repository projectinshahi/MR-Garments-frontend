import { expect, type Page, test } from "@playwright/test";

import { SIGNED_OUT } from "./sessions";

// Batch 1 A1: sign in, sign out and sessions through the browser (backend docs/batch1-decisions.md, Part 6).
// Every test starts signed out and signs in through the form. The saved-session users (suresh, chen) are never
// deactivated or changed: signing them in or out here only touches the new session.

const VIEWPORT = { width: 1440, height: 900 };
test.use({ viewport: VIEWPORT, storageState: SIGNED_OUT });

// Approved wording (src/lib/feedback.ts, M1-M3).
const M1 = "Enter your email and password.";
const M2 = "Email or password is incorrect.";
const M3 = "Too many attempts. Try again in 15 minutes.";

function e2ePassword() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("Set E2E_PASSWORD in .env.test.local");
  return value;
}

/** Fills the sign-in form and returns the AUTH-1 status. */
async function signIn(page: Page, email: string, { password = e2ePassword(), keep = false } = {}) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  if (keep) await page.getByRole("checkbox", { name: "Keep me signed in" }).check();
  const answer = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Sign in" }).click();
  return (await answer).status();
}

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test("signed-out visitors are sent to sign in (AT-A1, AT-A10)", async ({ page }) => {
  for (const path of ["/users", "/change-password"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  }
});

test("empty fields show M1 without asking the API (U36)", async ({ page }) => {
  await page.goto("/login");
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/auth/login")) requests += 1;
  });
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(M1, { exact: true })).toBeVisible();
  expect(requests).toBe(0);
});

test("a wrong password and an unknown email get the same M2; the email stays, the password clears (AT-A3, AT-A4)", async ({ page }) => {
  for (const email of ["suresh@mrgarments.com", "nobody@mrgarments.com"]) {
    expect(await signIn(page, email, { password: "Wrong2026x" })).toBe(401);
    await expect(page.getByText(M2, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email or username")).toHaveValue(email);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(page).toHaveURL("/login");
  }
});

// AT-A5 (inactive user gets M2): API test in the backend's login.test.ts; browser side in A2's AT-T1 spec.

test("the 6th failed attempt within 15 minutes shows M3 (AT-A6)", async ({ page }) => {
  // An email no other spec signs in with, so the 15-minute block (B9.1) can't lock anyone else out.
  const email = "a1-throttle@mrgarments.com";
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    expect(await signIn(page, email, { password: `Wrong${attempt}x` }), `attempt ${attempt}`).toBe(401);
    await expect(page.getByText(M2, { exact: true })).toBeVisible();
  }
  expect(await signIn(page, email, { password: "Wrong6x" })).toBe(429);
  await expect(page.getByText(M3, { exact: true })).toBeVisible();
  await expect(page.getByText(M2, { exact: true })).toHaveCount(0);
});

for (const keep of [true, false]) {
  test(`${keep ? "with" : "without"} "Keep me signed in", a browser restart ${keep ? "keeps" : "ends"} the session (${keep ? "AT-A7" : "AT-A8"})`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    expect(await signIn(page, "priya@mrgarments.com", { keep })).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === "mrg.sid");
    expect(session?.httpOnly).toBe(true);
    if (keep) expect(session!.expires * 1000).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    else expect(session?.expires).toBe(-1);

    // A restart keeps only cookies with an expiry date; session cookies end with the browser.
    const restarted = await browser.newContext({
      baseURL,
      viewport: VIEWPORT,
      storageState: { cookies: cookies.filter((cookie) => cookie.expires !== -1), origins: [] },
    });
    const again = await restarted.newPage();
    await again.goto("/");
    if (keep) await expect(again.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    else await expect(again).toHaveURL("/login");
    await restarted.close();
  });
}

test("signing out from the user menu ends the session, and Back shows no app data (AT-A9, K2)", async ({ page }) => {
  expect(await signIn(page, "suresh@mrgarments.com")).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await mainNav(page).getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();

  await page.getByRole("button", { name: /Suresh Menon/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(mainNav(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toHaveCount(0);
  await page.goto("/orders");
  await expect(page).toHaveURL("/login");
});

// B3 (N-b, L-b, P-b) and B2 for each role, signing in through the form.
const ROLES = [
  {
    test: "AT-R1",
    email: "priya@mrgarments.com",
    name: "Priya Nair",
    initials: "PN",
    detail: "Procurement",
    landing: "/",
    heading: "Dashboard",
    links: ["Dashboard", "Orders", "Deposits & Payments", "Delivery Calendar", "Receiving (China)"],
    blocked: "/users",
  },
  {
    test: "AT-R2",
    email: "anita@mrgarments.com",
    name: "Anita Joseph",
    initials: "AJ",
    detail: "Accounts",
    landing: "/",
    heading: "Dashboard",
    links: ["Dashboard", "Orders", "Deposits & Payments"],
    blocked: "/settings/suppliers",
  },
  {
    test: "AT-R3",
    email: "chen@mrgarments.com",
    name: "Chen Yu",
    initials: "CY",
    detail: "China office · Entry only",
    landing: "/home",
    heading: "Home",
    links: ["Home", "Receiving (China)"],
    blocked: "/payments",
  },
  {
    test: "AT-R4",
    email: "anil@mrgarments.com",
    name: "Anil Sharma",
    initials: "AS",
    detail: "India office · Entry only",
    landing: "/clearing",
    heading: "Clearing (India)",
    links: ["Home", "Clearing (India)", "Transport"],
    blocked: "/payments",
  },
];

for (const role of ROLES) {
  test(`${role.name} lands on ${role.landing} with the B3 sidebar, and ${role.blocked} redirects there (${role.test})`, async ({ page }) => {
    expect(await signIn(page, role.email)).toBe(200);
    await expect(page).toHaveURL(role.landing);
    await expect(page.getByRole("heading", { level: 1, name: role.heading })).toBeVisible();
    await expect(mainNav(page).getByRole("link")).toHaveText(role.links);
    const block = page.getByRole("button", { name: new RegExp(role.name) });
    await expect(block).toContainText(role.initials);
    await expect(block).toContainText(role.detail);

    await page.goto(role.blocked);
    await expect(page).toHaveURL(role.landing);
  });
}
