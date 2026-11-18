import type { Page, TestInfo } from "@playwright/test";

import { expect, test } from "./live-api";

// The Orders list shows every product of an order (ORD-7 lines), not only the first (ORD-1): the first two with their
// own quantities, "+N more" opening the whole list (hover or click on desktop, tap on a phone), the total per unit
// and the product count, and search by any product. Screenshots go to SHOTS_DIR when set.

const out = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));
const rowOf = (page: Page, po: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name: po, exact: true }) });
/** Waits for the popover's opening fade, so a screenshot shows it fully drawn. */
const settled = (page: Page) =>
  page.getByRole("dialog").evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

test("each order lists all its products with their quantities, +N more opens the rest, search finds any product", async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const many = await api.createOrder({
    lines: [
      { item: "Denim jeans", quantity: 100, rateCny: 10 },
      { item: "Cotton fabric", quantity: 300, rateCny: 5 },
      { item: "Polo shirts", quantity: 50, rateCny: 8 },
      { item: "Men's jackets", quantity: 25, rateCny: 30 },
    ],
  });
  const two = await api.createOrder({
    lines: [
      { item: "Track pants", quantity: 80, rateCny: 6 },
      { item: "Kids t-shirts", quantity: 120, rateCny: 3 },
    ],
  });
  const one = await api.createOrder({ lines: [{ item: "Ladies kurtis", quantity: 60, rateCny: 9 }] });

  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();

  await test.step("one product: as before, no count, nothing more", async () => {
    const row = rowOf(page, one.po);
    await expect(row).toContainText("Ladies kurtis · 60 pcs");
    await expect(row.getByRole("button", { name: /more/ })).toHaveCount(0);
    await expect(row).not.toContainText("products");
  });

  await test.step("two products: both named with their quantities, the total and the count", async () => {
    const row = rowOf(page, two.po);
    await expect(row).toContainText("Track pants · 80 pcs");
    await expect(row).toContainText("Kids t-shirts · 120 pcs");
    await expect(row).toContainText("200 pcs2 products");
    await expect(row.getByRole("button", { name: /more/ })).toHaveCount(0);
  });

  await test.step("four products: two named, +2 more, totals per unit (pcs and m apart), the count", async () => {
    const row = rowOf(page, many.po);
    await expect(row).toContainText("Denim jeans · 100 pcs");
    await expect(row).toContainText("Cotton fabric · 300 m");
    await expect(row).not.toContainText("Polo shirts");
    await expect(row).toContainText("175 pcs300 m4 products");
    await page.screenshot({ path: out(testInfo, "orders-products-1440.png"), fullPage: true });
  });

  await test.step("hovering +2 more shows every product with its quantity; clicking inside never opens the order", async () => {
    const more = rowOf(page, many.po).getByRole("button", { name: `+2 more: show all 4 products of ${many.po}` });
    await more.hover();
    const list = page.getByRole("dialog", { name: `Products of ${many.po}` });
    await expect(list).toBeVisible();
    await expect(list).toContainText("4 products · 175 pcs · 300 m");
    await expect(list.getByRole("listitem")).toHaveText(["Denim jeans100 pcs", "Cotton fabric300 m", "Polo shirts50 pcs", "Men's jackets25 pcs"]);
    await settled(page);
    await page.screenshot({ path: out(testInfo, "orders-products-popover-1440.png") });
    await list.getByText("Polo shirts").click();
    await expect(page).toHaveURL("/orders");
    await page.mouse.move(5, 5);
    await expect(list).toBeHidden();
    await more.click();
    await expect(list).toBeVisible();
    await expect(page).toHaveURL("/orders");
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
  });

  await test.step("search finds the order by a product past the first two", async () => {
    await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill("men's jackets");
    await expect(rowOf(page, many.po)).toBeVisible();
    await expect(rowOf(page, two.po)).toHaveCount(0);
  });

  await test.step("phone: a tap opens the full list, which fits the screen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/orders");
    await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(many.po);
    const more = rowOf(page, many.po).getByRole("button", { name: /^\+2 more/ });
    await more.scrollIntoViewIfNeeded();
    await more.tap().catch(() => more.click());
    const list = page.getByRole("dialog", { name: `Products of ${many.po}` });
    await expect(list).toBeVisible();
    const box = await list.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await noSideScroll(page);
    await settled(page);
    await page.screenshot({ path: out(testInfo, "orders-products-popover-390.png") });
  });
});
