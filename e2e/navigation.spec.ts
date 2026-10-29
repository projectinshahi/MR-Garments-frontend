import { expect, type Locator, type Page } from "@playwright/test";

import { MANAGEMENT_NAV } from "../src/config/navigation";
import { ANITA, freshSignIn, settled, test } from "./live-api";
import { LOADING_STAFF_STATE, PROCUREMENT_STATE } from "./sessions";

// Every sidebar item and every tab bar opens its page on click and again on reload (direct URL), with no error page,
// no console error and no failed API request. Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });
// Each test opens and reloads up to 13 pages.
test.describe.configure({ timeout: 120_000 });

/** Console errors and API responses of 400 or more, collected while the test runs. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

async function expectOpened(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("This page failed to load.")).toHaveCount(0);
}

/** Clicks each link in `nav` by name, then reloads its URL. */
async function clickThrough(page: Page, nav: () => Locator, links: { name: string; path: string }[]) {
  for (const { name, path } of links) {
    await nav().getByRole("link", { name, exact: true }).click();
    await expectOpened(page, path);
    await expect(nav().getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expectOpened(page, path);
  }
}

test("every sidebar item opens its page", async ({ page }) => {
  const problems = watch(settled(page));
  await page.goto("/");
  const links = MANAGEMENT_NAV.flatMap((section) => section.items).map((item) => ({
    name: item.title,
    // /settings opens its first tab.
    path: item.href === "/settings" ? "/settings/suppliers" : item.href,
  }));
  for (const { name, path } of links) {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }).click();
    await expectOpened(page, path);
    await page.reload();
    await expectOpened(page, path);
  }
  expect(problems).toEqual([]);
});

test("sidebar links change pages without reloading the browser, and Back and Forward follow the history", async ({ page }) => {
  const problems = watch(settled(page));
  const sidebar = page.getByRole("navigation", { name: "Main" });
  const heading = (name: string) => page.getByRole("heading", { level: 1, name });
  await page.goto("/orders");
  await expect(heading("Orders")).toBeVisible();
  // A full page load would start a new window object and drop this mark.
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));

  await sidebar.getByRole("link", { name: "Deposits & Payments", exact: true }).click();
  await expect(heading("Deposits & Payments")).toBeVisible();
  await sidebar.getByRole("link", { name: "Containers", exact: true }).click();
  await expect(heading("Containers")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/payments");
  await expect(heading("Deposits & Payments")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/orders");
  await expect(heading("Orders")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL("/payments");
  await expect(heading("Deposits & Payments")).toBeVisible();

  expect(await page.evaluate(() => (window as Window & { sameDocument?: boolean }).sameDocument)).toBe(true);
  expect(problems).toEqual([]);
});

test("Settings tabs 1-7 open", async ({ page }) => {
  const problems = watch(settled(page));
  await page.goto("/settings");
  const tabs = [
    ["Suppliers", "suppliers"],
    ["Shipping agents", "shipping-agents"],
    ["Clearing agents", "clearing-agents"],
    ["Transport companies", "transport-companies"],
    ["Offices & warehouses", "offices"],
    ["Teams", "teams"],
    ["Item list", "items"],
  ];
  // Start on tab 2 so tab 1 is a real click, not the redirect target.
  await clickThrough(
    page,
    () => page.getByRole("navigation", { name: "Settings sections" }),
    [...tabs.slice(1), tabs[0]!].map(([name, slug]) => ({ name: name!, path: `/settings/${slug}` })),
  );
  expect(problems).toEqual([]);
});

test("calendar tabs open", async ({ page }) => {
  const problems = watch(settled(page));
  await page.goto("/calendar");
  await clickThrough(page, () => page.getByRole("navigation", { name: "Calendar views" }), [
    { name: "Week", path: "/calendar/week" },
    { name: "List", path: "/calendar/list" },
    { name: "Month", path: "/calendar" },
  ]);
  expect(problems).toEqual([]);
});

test("order detail tabs open", async ({ page, api }) => {
  const problems = watch(settled(page));
  const { po } = await api.createOrder();
  await page.goto(`/orders/${po}`);
  await clickThrough(page, () => page.getByRole("navigation", { name: "Order sections" }), [
    { name: "Items", path: `/orders/${po}/items` },
    { name: "Deposits & payments", path: `/orders/${po}/payments` },
    { name: "Receiving", path: `/orders/${po}/receiving` },
    { name: "Containers", path: `/orders/${po}/containers` },
    { name: "Overview", path: `/orders/${po}` },
  ]);
  expect(problems).toEqual([]);
});

test("every report opens from the Reports hub", async ({ page }) => {
  const problems = watch(settled(page));
  for (const slug of ["order-status", "deliveries-per-day", "ordered-vs-received", "containers-timeline", "payments-per-supplier", "landed-cost-by-month"]) {
    await page.goto("/reports");
    await page.locator(`a[href^="/reports/${slug}"]`).filter({ visible: true }).click();
    await expectOpened(page, `/reports/${slug}`);
    await page.reload();
    await expectOpened(page, `/reports/${slug}`);
  }
  expect(problems).toEqual([]);
});

test("the mobile menu opens a page", async ({ page }) => {
  const problems = watch(settled(page));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Landed Cost", exact: true }).click();
  await expectOpened(page, "/landed-cost");
  expect(problems).toEqual([]);
});

/**
 * Holds the page's navigation response (RSC, not prefetches) for `ms`, and counts those requests, so a test can see
 * the progress bar while the current page stays, and that the click navigated once.
 */
async function slowNavigation(page: Page, path: string, ms = 1500) {
  const requests: string[] = [];
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      const headers = route.request().headers();
      if (headers.rsc && !headers["next-router-prefetch"]) {
        requests.push(route.request().url());
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
      await route.fallback();
    },
  );
  return requests;
}

test("the mobile menu closes at once; a progress bar shows until the page is ready, after one navigation", async ({ page }) => {
  const problems = watch(settled(page));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  const navigations = await slowNavigation(page, "/payments");
  const bar = page.getByRole("progressbar", { name: "Loading page" });

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Deposits & Payments", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bar).toBeVisible();
  // The current page stays until the next one is ready.
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();

  await expect(page.getByRole("heading", { level: 1, name: "Deposits & Payments" })).toBeVisible();
  await expect(bar).toHaveCount(0);
  expect(navigations).toHaveLength(1);
  expect(problems).toEqual([]);
});

// A container's page has no loading frame of its own (an order's has, so opening one is instant), so the list stays
// while it loads.
test("opening a container from its table row shows the progress bar until the container is on screen", async ({ page, api }) => {
  const { po } = await api.createOrder({ lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
  await api.receive(po, { "Denim jeans": 100 });
  const container = await api.load([{ po, item: "Denim jeans", quantity: 100 }]);
  await page.goto("/containers");
  const navigations = await slowNavigation(page, `/containers/${container.id}`);
  const bar = page.getByRole("progressbar", { name: "Loading page" });
  // The agent cell, not the container link: the row's own click handler.
  await page.getByRole("row").filter({ hasText: container.number }).getByRole("cell").nth(1).click();
  await expect(bar).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Containers" })).toBeVisible();
  await expect(page).toHaveURL(`/containers/${container.id}`);
  await expect(bar).toHaveCount(0);
  expect(navigations).toHaveLength(1);
});

test("an address no page matches shows the app's not-found page inside the shell", async ({ page }) => {
  // /warehouse/receive lost its page in wave 3 (receiving goods now opens per trip); old bookmarks still point there.
  for (const path of ["/warehouse/receive", "/settings/no-such-tab", "/reports/no-such-report"]) {
    await page.goto(path);
    await expect(page.getByText("This record doesn't exist, or its link is wrong.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  }
  await page.getByRole("link", { name: "Go to Orders" }).click();
  await expectOpened(page, "/orders");
});

test("closing a Settings dialog leaves no extra history entry, so one Back press leaves the tab", async ({ page }) => {
  await page.goto("/settings/teams");
  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Suppliers", exact: true }).click();
  await expectOpened(page, "/settings/suppliers");
  await page.getByRole("link", { name: "+ Add supplier" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expectOpened(page, "/settings/teams");
});

test.describe("staff not-found", () => {
  test.use({ storageState: LOADING_STAFF_STATE });

  test("the not-found button goes to the staff member's home page, not to Orders they can't open", async ({ page }) => {
    await page.goto("/containers/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("This record doesn't exist, or its link is wrong.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Orders" })).toHaveCount(0);
    await page.getByRole("link", { name: "Go to your home page" }).click();
    await expectOpened(page, "/home");
  });
});

// The dashboard's card links show only for pages the role may open; the proxy sent the others back to the dashboard.
// Anita (Accounts) gets a fresh session: batch1-a5-passwords ends the one auth.setup.ts saved for her.
for (const { role, state, shown, hidden } of [
  { role: "Accounts", state: freshSignIn(ANITA), shown: ["All payments"], hidden: ["Open calendar", "All containers"] },
  { role: "Procurement", state: PROCUREMENT_STATE, shown: ["Open calendar", "All payments"], hidden: ["All containers"] },
]) {
  test.describe(`${role} dashboard`, () => {
    test.use({ storageState: state });

    test("shows only the card links it can open", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
      for (const name of shown) await expect(page.getByRole("link", { name })).toBeVisible();
      for (const name of hidden) await expect(page.getByRole("link", { name })).toHaveCount(0);
    });
  });
}
