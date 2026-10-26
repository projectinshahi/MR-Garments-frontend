import { type Browser, expect, type Page, test } from "@playwright/test";

import { SIGNED_OUT } from "./sessions";

// Batch 1, A2 (users): AT-U1 to U7, U11, U12, and the browser halves of AT-T1 (with AT-A5) and AT-T2, on the seeded
// API, signed in as Suresh (Management).
// - The saved-session users suresh and chen are never changed: AT-U5 and AT-T1 use Li Wei, who has Chen Yu's role and
//   grant (China staff, Receiving). AT-U6 only tries changes to Suresh that the API refuses.
// - Every successful change is undone in a `finally` through USR-4, so later specs see the seeded users.
// - One worker runs the tests in file order. AT-U7 is last: users can't be deleted, so it leaves Test User inactive.
// - AT-U8 to U10 need the invite link, which only the API console prints (B1.9); they are manual.

test.use({ viewport: { width: 1440, height: 900 } });

// Approved wording (src/lib/feedback.ts, U36.2 and U37.2). Never reworded.
const M2 = "Email or password is incorrect.";
const M4 = "Your session has ended. Please sign in again.";
const M15 = "A user with this email already exists.";
const M20 = "At least one active Management user is required.";
const CHINA_SUMMARY = "China staff can enter receipts and container loading. They cannot see payments, landed cost or reports.";

const SEEDED = ["Suresh Menon", "Priya Nair", "Anita Joseph", "Wang Fang", "Chen Yu", "Li Wei", "Anil Sharma", "Joseph M"];
const LAST_SIGN_IN = /^(–|Today, \d\d:\d\d|Yesterday, \d\d:\d\d|\d{1,2} [A-Z][a-z]{2}( \d{4})?, \d\d:\d\d)$/;

// Form controls by role: hidden <Activity> routes stay in the DOM, and role locators skip them.
const field = {
  name: (page: Page) => page.getByRole("textbox", { name: "Full name" }),
  email: (page: Page) => page.getByRole("textbox", { name: "Email" }),
  role: (page: Page) => page.getByRole("combobox", { name: "Role" }),
  status: (page: Page) => page.getByRole("combobox", { name: "Status" }),
  stage: (page: Page, name: string) => page.getByRole("checkbox", { name }),
  save: (page: Page) => page.getByRole("button", { name: "Save user" }),
};
/** The Field group around a control, where its error message appears (E1). */
const groupOf = (page: Page, name: string) => page.getByRole("group").filter({ has: page.getByRole("combobox", { name }) });
const roleCard = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "What this role can do" }) });
const stagesCard = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Stages this person can enter data for" }) });

/** Opens a user's edit form from the list and returns their id. */
async function openEdit(page: Page, name: string) {
  await page.goto("/users");
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  await expect(field.name(page)).toHaveValue(name);
  return new URL(page.url()).searchParams.get("id")!;
}

async function saveAndExpect(page: Page, toast: "User saved" | "User added") {
  await field.save(page).click();
  await expect(page).toHaveURL("/users");
  await expect(page.getByText(toast, { exact: true })).toBeVisible();
}

/** Undo through USR-4 with Suresh's session (same-site request, B9.8). */
async function restore(page: Page, baseURL: string | undefined, id: string, body: object) {
  const response = await page.request.patch(`/api/v1/users/${id}`, { data: body, headers: { Origin: baseURL ?? "" } });
  expect(response.status(), `restore ${id}`).toBe(200);
}

/** A second browser, signed in through the form as another seeded user. */
async function signInElsewhere(browser: Browser, baseURL: string | undefined, email: string) {
  const context = await browser.newContext({ baseURL, storageState: SIGNED_OUT, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signInThroughForm(page, email);
  return { context, page };
}

async function signInThroughForm(page: Page, email: string) {
  const password = process.env.E2E_PASSWORD;
  expect(password, "Set E2E_PASSWORD in .env.test.local").toBeTruthy();
  if (!page.url().includes("/login")) await page.goto("/login");
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("AT-U1: the users list shows the 8 seeded users", async ({ page }) => {
  await page.goto("/users");
  const table = page.getByRole("table");
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(9);
  for (const [index, name] of SEEDED.entries()) await expect(rows.nth(index + 1)).toContainText(name);

  const office = (name: string) => table.getByRole("row", { name: new RegExp(name) }).getByRole("cell").nth(2);
  for (const name of ["Suresh Menon", "Priya Nair", "Anita Joseph"]) await expect(office(name)).toHaveText(""); // U28
  await expect(office("Wang Fang")).toHaveText("Guangzhou office");
  await expect(office("Anil Sharma")).toHaveText("India office");
  await expect(office("Joseph M")).toHaveText("Main warehouse");
  for (const name of SEEDED) {
    await expect(table.getByRole("row", { name: new RegExp(name) }).getByRole("cell").nth(3)).toHaveText(LAST_SIGN_IN);
  }
  await expect(table.getByRole("row", { name: /Suresh Menon/ }).getByRole("cell").nth(3)).toHaveText(/^Today, /);

  const status = page.getByRole("group", { name: "User status" });
  await expect(status.getByRole("button", { name: "Active (8)" })).toBeVisible();
  await expect(status.getByRole("button", { name: "Inactive (0)" })).toBeVisible();
});

test("AT-U2: search, role filter and the status chips", async ({ page }) => {
  await page.goto("/users");
  const rows = page.getByRole("table").getByRole("row");
  const search = page.getByRole("searchbox", { name: "Search users by name or email" });
  await search.fill("wang");
  await expect(rows).toHaveCount(2);
  await search.fill("");

  await page.getByRole("button", { name: "Role: All roles" }).click();
  await page.getByRole("menuitemradio", { name: "China staff" }).click();
  await expect(rows).toHaveCount(4);
  await page.getByRole("button", { name: "Role: China staff" }).click();
  await page.getByRole("menuitemradio", { name: "All roles" }).click();

  const status = page.getByRole("group", { name: "User status" });
  await status.getByRole("button", { name: "Inactive (0)" }).click();
  await expect(page.getByText("No users match these filters.")).toBeVisible();
  await status.getByRole("button", { name: "All", exact: true }).click();
  await expect(rows).toHaveCount(9);
});

test("AT-U12: the role card follows the Role select and the password can't be typed (B5, C5)", async ({ page }) => {
  await page.goto("/users");
  await page.getByRole("link", { name: "+ Add user" }).click();
  await expect(page).toHaveURL("/users/edit");
  await expect(field.name(page)).toHaveValue("");

  const password = page.getByLabel("Password", { exact: true });
  await expect(password).not.toBeEditable();
  await expect(password).toHaveAttribute("placeholder", "Set by user at first sign-in");

  const card = roleCard(page);
  await field.role(page).selectOption("China staff");
  await expect(card.getByText(CHINA_SUMMARY)).toBeVisible();
  await expect(card.getByRole("listitem")).toHaveCount(6);
  for (const role of ["Management", "Procurement", "Accounts", "India staff", "Warehouse staff"]) {
    await field.role(page).selectOption(role);
    await expect(card.getByRole("listitem"), role).toHaveCount(13);
    await expect(card.getByText(CHINA_SUMMARY)).toHaveCount(0);
  }
  await expect(card.getByRole("listitem").filter({ hasText: "Warehouse" })).toContainText("Enter");
  await expect(card.getByRole("listitem").filter({ hasText: "Settings and users" })).toContainText("No");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/users");
});

test("AT-U4: a stage outside the role shows M18 under the ticks and saves nothing", async ({ page }) => {
  await openEdit(page, "Wang Fang");
  await field.stage(page, "Clearing (India)").click();
  await field.save(page).click();
  await expect(stagesCard(page).getByText("China staff can't enter data for Clearing (India). Untick it first.")).toBeVisible();
  await expect(page).toHaveURL(/\/users\/edit\?id=/);
  await expect(field.stage(page, "Clearing (India)")).toBeChecked();
  await expect(field.save(page)).toBeEnabled();

  await page.reload();
  await expect(field.stage(page, "Clearing (India)")).not.toBeChecked();
  await expect(field.stage(page, "Container loading")).toBeChecked();
});

test("AT-U5: changing the role while Receiving is ticked shows M18 (Li Wei, as Chen Yu)", async ({ page }) => {
  await openEdit(page, "Li Wei");
  await field.role(page).selectOption("India staff");
  await field.save(page).click();
  await expect(stagesCard(page).getByText("India staff can't enter data for Receiving (China). Untick it first.")).toBeVisible();
  await page.reload();
  await expect(field.role(page)).toHaveValue("China staff");
});

test("AT-U6: the last Management user can't be demoted or deactivated (M20)", async ({ page }) => {
  await openEdit(page, "Suresh Menon");
  await field.role(page).selectOption("Procurement");
  await field.save(page).click();
  await expect(groupOf(page, "Role").getByText(M20)).toBeVisible();
  await expect(groupOf(page, "Status").getByText(M20)).toHaveCount(0);

  await field.role(page).selectOption("Management");
  await field.status(page).selectOption("Inactive");
  await field.save(page).click();
  await expect(groupOf(page, "Status").getByText(M20)).toBeVisible();

  await page.reload();
  await expect(field.role(page)).toHaveValue("Management");
  await expect(field.status(page)).toHaveValue("Active");
});

test("AT-U3 and AT-T2: unticking a stage saves, and the signed-in user sees it on the next page load", async ({ page, browser, baseURL }) => {
  const wang = await signInElsewhere(browser, baseURL, "wang@mrgarments.com");
  const id = await openEdit(page, "Wang Fang");
  try {
    await expect(wang.page).toHaveURL("/home");
    const wangNav = wang.page.getByRole("navigation", { name: "Main" });
    await expect(wangNav.getByRole("link", { name: "Containers" })).toBeVisible();

    await field.stage(page, "Container loading").click();
    await saveAndExpect(page, "User saved");
    await page.getByRole("link", { name: "Edit Wang Fang" }).click();
    await expect(field.stage(page, "Container loading")).not.toBeChecked();
    await expect(field.stage(page, "Receiving (China)")).toBeChecked();

    await wang.page.reload();
    await expect(wangNav.getByRole("link", { name: "Receiving (China)" })).toBeVisible();
    await expect(wangNav.getByRole("link", { name: "Containers" })).toHaveCount(0);
    await expect(wang.page).toHaveURL("/home");
  } finally {
    await restore(page, baseURL, id, { stages: [2, 3] });
    await wang.context.close();
  }
});

test("AT-T1 and AT-A5: deactivating a signed-in user ends their session and stops sign-in (Li Wei)", async ({ page, browser, baseURL }) => {
  const li = await signInElsewhere(browser, baseURL, "li@mrgarments.com");
  const id = await openEdit(page, "Li Wei");
  try {
    await expect(li.page).toHaveURL("/home");
    await field.status(page).selectOption("Inactive");
    await saveAndExpect(page, "User saved");
    await page.getByRole("group", { name: "User status" }).getByRole("button", { name: "Inactive (1)" }).click();
    await expect(page.getByRole("table").getByRole("row", { name: /Li Wei/ })).toBeVisible();

    // His next action goes to sign-in with M4 (E6, E7).
    await li.page.reload();
    await expect(li.page).toHaveURL(/\/login/);
    await expect(li.page.getByText(M4)).toBeVisible();
    // And he can't sign in again: the same M2 as a wrong password (AT-A5, B9.13).
    await signInThroughForm(li.page, "li@mrgarments.com");
    await expect(li.page.getByText(M2)).toBeVisible();
    await expect(li.page).toHaveURL(/\/login/);
  } finally {
    await restore(page, baseURL, id, { status: "Active" });
    await li.context.close();
  }
});

test("AT-U11: adding a user with Wang Fang's email shows M15 and keeps the values", async ({ page }) => {
  await page.goto("/users/edit");
  await field.name(page).fill("Second Wang");
  await field.email(page).fill("WANG@mrgarments.com");
  await field.role(page).selectOption("China staff");
  await field.save(page).click();
  await expect(page.getByRole("group").filter({ has: field.email(page) }).getByText(M15)).toBeVisible();
  await expect(field.email(page)).toBeFocused();
  await expect(field.name(page)).toHaveValue("Second Wang");
  await expect(page).toHaveURL("/users/edit");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/users");
});

test("AT-U7: adding a user lists them as Active (then deactivates them again)", async ({ page, baseURL }) => {
  try {
    await page.goto("/users");
    await page.getByRole("link", { name: "+ Add user" }).click();
    await field.name(page).fill("Test User");
    await field.email(page).fill("test@mrgarments.com");
    await field.role(page).selectOption("China staff");
    await field.stage(page, "Receiving (China)").click();
    await saveAndExpect(page, "User added");

    const row = page.getByRole("table").getByRole("row", { name: /Test User/ });
    await expect(row).toContainText("test@mrgarments.com");
    await expect(row).toContainText("China staff");
    await expect(row.getByRole("cell").nth(3)).toHaveText("–");
    await expect(row).toContainText("Active");
    await expect(page.getByRole("group", { name: "User status" }).getByRole("button", { name: "Active (9)" })).toBeVisible();

    await page.getByRole("link", { name: "Edit Test User" }).click();
    await expect(field.stage(page, "Receiving (China)")).toBeChecked();
    await expect(field.stage(page, "Container loading")).not.toBeChecked();
  } finally {
    // Users can't be deleted: set Test User inactive so the list shows the 8 seeded users as active again.
    const edit = page.getByRole("link", { name: "Edit Test User" });
    await page.goto("/users");
    await page.getByRole("group", { name: "User status" }).getByRole("button", { name: "All", exact: true }).click();
    if ((await edit.count()) > 0) {
      const id = new URL((await edit.getAttribute("href"))!, baseURL).searchParams.get("id")!;
      await restore(page, baseURL, id, { status: "Inactive" });
    }
  }
});
