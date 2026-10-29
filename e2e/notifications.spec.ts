import type { Page } from "@playwright/test";

import { ANITA, expect, freshSignIn, test } from "./live-api";
import { STAFF_STATE } from "./sessions";

// Notifications (50_17.1) and the shell's bell against NTF-1 to NTF-4. The actor never gets their own notification,
// so Management causes each event through the API (`api`) and another role checks it. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const unreadBell = (page: Page) => page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
const panel = (page: Page) => page.getByRole("dialog", { name: "Notifications" });
const pageRow = (page: Page, po: string) => page.getByRole("list", { name: "Notifications" }).getByRole("listitem").filter({ hasText: po });
const markedRead = (page: Page) => page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/v1\/notifications\/[^/]+\/read$/.test(r.url()));

test.describe("Accounts (payments Enter)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("a payment Management recorded shows in the bell; opening it marks it read; Mark all as read clears the count", async ({ page, api }) => {
    const order = await api.createOrder();
    await api.pay(order.id, { amountCny: 500, rateInr: 12 });

    await page.goto("/payments");
    await unreadBell(page).click();
    const item = panel(page).getByRole("button", { name: new RegExp(order.po) });
    await expect(item).toContainText("New");
    const read = markedRead(page);
    await item.click();
    expect((await read).status()).toBe(200);

    await page.goto("/notifications");
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    await expect(page.getByText("Sample Data — Not Live")).toHaveCount(0);
    await expect(pageRow(page, order.po)).toBeVisible();
    await expect(pageRow(page, order.po)).not.toContainText("New");
    await page.getByRole("group", { name: "Filter notifications" }).getByRole("button", { name: "Payments" }).click();
    await expect(pageRow(page, order.po)).toBeVisible();

    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Notifications" }).getByText("New", { exact: true })).toHaveCount(0);
  });
});

test.describe("China staff (receiving)", () => {
  test.use({ storageState: STAFF_STATE });

  test("a short receipt Management recorded shows in the staff shell's bell and on the page", async ({ page, api }) => {
    const order = await api.createOrder();
    await api.receive(order.po, { "Denim jeans": 40 });

    await page.goto("/home");
    await unreadBell(page).click();
    await expect(panel(page).getByRole("button", { name: new RegExp(order.po) })).toContainText("New");
    await panel(page).getByRole("link", { name: "View all" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    await expect(pageRow(page, order.po)).toContainText("New");
  });
});

test("Management, who recorded the payment, gets no notification for it", async ({ page, api }) => {
  const order = await api.createOrder();
  await api.pay(order.id, { amountCny: 500, rateInr: 12 });
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(page.getByText(order.po)).toHaveCount(0);
});
