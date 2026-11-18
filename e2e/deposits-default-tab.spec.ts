import type { Page, TestInfo } from "@playwright/test";

import type { SupplierRow } from "../src/lib/api/types";
import { type Api, expect, test } from "./live-api";

// Deposits in the sidebar opens its Supplier advance tab (/deposits/advance), the supplier-wise overview. Every other
// tab keeps its own address (/deposits is All deposits), and the sidebar item stays highlighted on all of them.
// Role/label locators only (hidden <Activity> routes stay in the DOM). Screenshots go to SHOTS_DIR when set.

const tag = () => String(Date.now()).slice(-6);
const shot = (page: Page, testInfo: TestInfo, name: string) =>
  // Transitions finished, so a sidebar item fading out of its highlight is not caught half-lit.
  page.screenshot({ path: process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name), fullPage: true, animations: "disabled" });
const noSideScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "page scrolls sideways").toBeLessThanOrEqual(0);
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** A CNY supplier holding a ¥1,500 advance. */
async function supplierWithAdvance(api: Api) {
  const response = await api.post("/suppliers", { name: `Default Tab Supply ${tag()}`, currency: "CNY", exchangeRate: 12.5 });
  expect(response.status(), await response.text()).toBe(201);
  const { supplier } = (await response.json()) as { supplier: SupplierRow };
  expect((await api.post(`/suppliers/${supplier.id}/advances`, { amount: 1500, paidOn: today(), rateInr: 12.5, mode: "Bank transfer" })).status()).toBe(201);
  return supplier;
}

const tabs = (page: Page) => page.getByRole("navigation", { name: "Deposits views" });
const tab = (page: Page, name: RegExp) => tabs(page).getByRole("link", { name });
const ADVANCE = /Supplier advance/;

async function onAdvanceTab(page: Page) {
  await expect(page).toHaveURL("/deposits/advance");
  await expect(page.getByRole("heading", { level: 1, name: "Deposits" })).toBeVisible();
  await expect(tab(page, ADVANCE)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("searchbox", { name: "Search supplier" })).toBeVisible();
}

test("Deposits in the sidebar opens Supplier advance; other tabs, direct links, reload, Back and Forward keep working", async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const supplier = await supplierWithAdvance(api);
  const sidebar = page.getByRole("navigation", { name: "Main" });
  const deposits = sidebar.getByRole("link", { name: "Deposits", exact: true });

  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await deposits.click();
  await onAdvanceTab(page);
  await expect(deposits).toHaveAttribute("aria-current", "page");
  // The supplier-wise overview at once: the supplier's own row, its advance per currency.
  await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
  const row = page.getByRole("row", { name: new RegExp(supplier.name) });
  await expect(row).toContainText("CNY · not used yet");
  await expect(row).toContainText("¥1,500¥0¥1,500");
  await page.getByRole("searchbox", { name: "Search supplier" }).fill("");
  await shot(page, testInfo, "deposits-default-advance-1440.png");

  await page.reload();
  await onAdvanceTab(page);

  // The other tabs, each at its own address, the sidebar item still lit.
  for (const [name, path] of [
    [/All deposits/, "/deposits"],
    [/Pending/, "/deposits/pending"],
    [/Paid/, "/deposits/paid"],
    [/Suppliers/, "/deposits/suppliers"],
  ] as const) {
    await tab(page, name).click();
    await expect(page).toHaveURL(path);
    await expect(tab(page, name)).toHaveAttribute("aria-current", "page");
    await expect(deposits).toHaveAttribute("aria-current", "page");
  }

  // Back and Forward follow the tabs.
  await page.goBack();
  await expect(page).toHaveURL("/deposits/paid");
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await onAdvanceTab(page);
  await page.goForward();
  await expect(page).toHaveURL("/deposits");
  await expect(tab(page, /All deposits/)).toHaveAttribute("aria-current", "page");

  // Direct links (and a reload of each) open their own tab, not Supplier advance.
  for (const [name, path] of [
    [/All deposits/, "/deposits"],
    [/Pending/, "/deposits/pending"],
    [/Suppliers/, "/deposits/suppliers"],
  ] as const) {
    await page.goto(path);
    await expect(tab(page, name)).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page).toHaveURL(path);
    await expect(tab(page, name)).toHaveAttribute("aria-current", "page");
  }

  // From any tab, the sidebar item opens Supplier advance again; a supplier opens from it.
  await deposits.click();
  await onAdvanceTab(page);
  await page.getByRole("searchbox", { name: "Search supplier" }).fill(supplier.name);
  await page.getByRole("link", { name: supplier.name, exact: true }).click();
  await expect(page).toHaveURL(`/deposits/advance/${supplier.id}`);
  await expect(deposits).toHaveAttribute("aria-current", "page");
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
]) {
  test(`Deposits opens Supplier advance at ${viewport.width} px, its tab in view`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    // Below 768 px the sidebar is a sheet behind the menu button.
    let nav = page.getByRole("navigation", { name: "Main" });
    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      nav = page.getByRole("dialog");
    }
    await nav.getByRole("link", { name: "Deposits", exact: true }).click();
    await onAdvanceTab(page);
    // The tab bar scrolls sideways on a phone: the current tab is brought into view.
    await expect(tab(page, ADVANCE)).toBeInViewport({ ratio: 0.95 });
    await noSideScroll(page);
    await shot(page, testInfo, `deposits-default-advance-${viewport.width}.png`);
  });
}
