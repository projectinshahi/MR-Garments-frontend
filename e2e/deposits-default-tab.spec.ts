import type { Page, TestInfo } from "@playwright/test";

import { expect, test } from "./live-api";

// The sidebar's Supplier ledger (D14, unified supplier ledger) replaced Deposits: it opens the supplier accounts
// (/supplier-ledger), its tabs keep their own addresses, and every old /deposits address redirects to its ledger page
// with the sidebar item lit. Role/label locators only (hidden <Activity> routes stay in the DOM). Screenshots go to
// SHOTS_DIR when set.

const shot = (page: Page, testInfo: TestInfo, name: string) =>
  // Transitions finished, so a sidebar item fading out of its highlight is not caught half-lit.
  page.screenshot({ path: process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name), fullPage: true, animations: "disabled" });
const noSideScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "page scrolls sideways").toBeLessThanOrEqual(0);

const tabs = (page: Page) => page.getByRole("navigation", { name: "Supplier ledger views" });
const tab = (page: Page, name: string) => tabs(page).getByRole("link", { name });

async function onAccounts(page: Page) {
  await expect(page).toHaveURL("/supplier-ledger");
  await expect(page.getByRole("heading", { level: 1, name: "Supplier ledger" })).toBeVisible();
  await expect(tab(page, "Supplier accounts")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("searchbox", { name: "Search supplier" })).toBeVisible();
}

test("Supplier ledger in the sidebar opens the accounts; tabs, reload, Back and Forward keep working", async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const supplier = await api.newSupplier("Default Tab Supply");
  await api.paySupplier(supplier.id, { amount: 1500, rateInr: 12.5 });
  const sidebar = page.getByRole("navigation", { name: "Main" });
  const ledger = sidebar.getByRole("link", { name: "Supplier ledger", exact: true });

  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Payments", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: /^Deposits/ })).toHaveCount(0);
  await ledger.click();
  await onAccounts(page);
  await expect(ledger).toHaveAttribute("aria-current", "page");
  // The supplier's own row: its CNY account, ¥1,500 available with it.
  await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
  const row = page.getByRole("row").filter({ hasText: supplier.name });
  await expect(row).toContainText("CNY");
  await expect(row).toContainText("¥1,500.00");
  await expect(row).toContainText("Available with supplier");
  await page.getByRole("searchbox", { name: "Search supplier" }).fill("");
  await shot(page, testInfo, "supplier-ledger-default-1440.png");

  await page.reload();
  await onAccounts(page);

  await tab(page, "Deposit milestones").click();
  await expect(page).toHaveURL("/supplier-ledger/milestones");
  await expect(tab(page, "Deposit milestones")).toHaveAttribute("aria-current", "page");
  await expect(ledger).toHaveAttribute("aria-current", "page");

  // Back and Forward follow the tabs.
  await page.goBack();
  await onAccounts(page);
  await page.goForward();
  await expect(page).toHaveURL("/supplier-ledger/milestones");

  // A supplier opens from the accounts; the item stays lit.
  await ledger.click();
  await onAccounts(page);
  await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
  await page.getByRole("link", { name: supplier.name, exact: true }).click();
  await expect(page).toHaveURL(`/supplier-ledger/${supplier.id}`);
  await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
  await expect(ledger).toHaveAttribute("aria-current", "page");
});

test("every old Deposits address redirects to its supplier ledger page", async ({ page, api }) => {
  const supplier = await api.newSupplier("Redirect Supply");
  for (const [from, to] of [
    ["/deposits", "/supplier-ledger"],
    ["/deposits/advance", "/supplier-ledger"],
    ["/deposits/suppliers", "/supplier-ledger"],
    ["/deposits/pending", "/supplier-ledger/milestones"],
    ["/deposits/paid", "/supplier-ledger/milestones"],
    [`/deposits/advance?supplier=${supplier.id}`, `/supplier-ledger/${supplier.id}`],
    [`/deposits/advance/${supplier.id}`, `/supplier-ledger/${supplier.id}`],
    [`/deposits/suppliers/${supplier.id}`, `/supplier-ledger/${supplier.id}`],
  ]) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(to.endsWith(supplier.id) ? supplier.name : "Supplier ledger");
  }
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
]) {
  test(`Supplier ledger opens the accounts at ${viewport.width} px, its tab in view`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    // Below 768 px the sidebar is a sheet behind the menu button.
    let nav = page.getByRole("navigation", { name: "Main" });
    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      nav = page.getByRole("dialog");
    }
    await nav.getByRole("link", { name: "Supplier ledger", exact: true }).click();
    await onAccounts(page);
    await expect(tab(page, "Supplier accounts")).toBeInViewport({ ratio: 0.95 });
    await noSideScroll(page);
    await shot(page, testInfo, `supplier-ledger-default-${viewport.width}.png`);
  });
}
