import { mkdirSync, writeFileSync } from "node:fs";

import type { Page, TestInfo } from "@playwright/test";

import { type Api, closedOrder, expect, test } from "./live-api";
import { downloadButton, downloadReport, type Format, MENU_ITEM } from "./report-download";
import { LOADING_STAFF_STATE } from "./sessions";

// Page report downloads (backend docs/report-downloads.md): every operational page's "Download report" menu gives
// that page's own report as PDF, Excel and CSV, built from every record its filters keep. A closed order is made
// first, so each stage page has a row. Files and full-page screenshots go to SHOTS_DIR when it is set.

test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.SHOTS_DIR;
const shot = (testInfo: TestInfo, name: string) => (SHOTS ? `${SHOTS}/${name}` : testInfo.outputPath(name));
const EXT: Record<Format, string> = { PDF: "pdf", Excel: "xlsx", CSV: "csv" };
const DATE = "\\d{4}-\\d{2}-\\d{2}";

/** Downloads all three formats; checks each name and that the PDF and Excel carry the title. Keeps the files when SHOTS_DIR is set. */
async function downloadAll(page: Page, slug: string, title: string) {
  const files: Record<Format, { name: string; text: string }> = {} as never;
  for (const format of ["PDF", "Excel", "CSV"] as const) {
    const file = await downloadReport(page, format);
    expect(file.name, `${slug} ${format}`).toMatch(new RegExp(`^${slug}-${DATE}\\.${EXT[format]}$`));
    // The PDF escapes ( ) and \ in its text; the Excel writes & as &amp;.
    if (format === "PDF") expect(file.text, `${slug} PDF`).toContain(`(${title.replace(/[()\\]/g, "\\$&")}) Tj`);
    if (format === "Excel") expect(file.text, `${slug} Excel`).toContain(title.replace(/&/g, "&amp;"));
    if (SHOTS) {
      mkdirSync(`${SHOTS}/files`, { recursive: true });
      writeFileSync(`${SHOTS}/files/${file.name}`, Buffer.from(file.text, "latin1"));
    }
    files[format] = file;
  }
  return files;
}

async function supplierId(api: Api, name: string) {
  const suppliers = await api.get<{ id: string; name: string; code: string }[]>("/suppliers");
  return suppliers.find((s) => s.name === name)!;
}

test("every page's report downloads as PDF, Excel and CSV, named after the page, with a full-page view of each", async ({ page, api }, testInfo) => {
  test.setTimeout(600_000);
  const { po } = await closedOrder(api);
  const foshan = await supplierId(api, "Foshan Fabrics");
  const pages: { path: string; slug: string; title: string; shot?: string }[] = [
    { path: "/", slug: "dashboard", title: "Dashboard", shot: "dashboard" },
    { path: "/orders", slug: "orders", title: "Orders", shot: "orders" },
    { path: "/orders/pending", slug: "pending-orders", title: "Pending orders", shot: "pending-orders" },
    { path: "/closed-orders", slug: "closed-orders", title: "Closed orders", shot: "closed-orders" },
    { path: `/orders/${po}`, slug: `order-report-${po}`, title: `Order report ${po}`, shot: "order-detail" },
    { path: "/suppliers", slug: "suppliers", title: "Suppliers", shot: "suppliers" },
    { path: `/suppliers/${foshan.id}`, slug: `supplier-${foshan.code.toLowerCase()}`, title: "Supplier report: Foshan Fabrics", shot: "supplier-detail" },
    { path: "/suppliers/performance", slug: "supplier-performance", title: "Supplier performance" },
    { path: "/suppliers/analytics", slug: "supplier-analytics", title: "Supplier analytics" },
    { path: "/payments", slug: "payments", title: "Deposits & Payments", shot: "payments" },
    { path: "/deposits", slug: "deposits-all", title: "All deposits", shot: "deposits" },
    { path: "/deposits/suppliers", slug: "deposits-suppliers", title: "Deposits by supplier" },
    { path: "/calendar/list", slug: "delivery-calendar", title: "Delivery calendar" },
    { path: "/receiving", slug: "receiving", title: "Receiving (China)", shot: "receiving" },
    { path: "/containers", slug: "containers", title: "Shipping (Containers)", shot: "shipping" },
    { path: "/clearing", slug: "clearing", title: "Clearing (India)", shot: "customs" },
    { path: "/transport", slug: "transport", title: "Transport", shot: "transport" },
    { path: "/warehouse", slug: "warehouse", title: "Warehouse", shot: "warehouse-stock" },
    { path: "/landed-cost", slug: "landed-cost", title: "Landed Cost", shot: "landed-cost" },
    { path: "/reports", slug: "reports-summary", title: "Reports summary", shot: "reports" },
    { path: "/settings/items", slug: "item-list", title: "Item list", shot: "item-list" },
    { path: "/settings/suppliers", slug: "settings-suppliers", title: "Suppliers (settings)" },
    { path: "/settings/shipping-agents", slug: "shipping-agents", title: "Shipping agents" },
    { path: "/settings/clearing-agents", slug: "clearing-agents", title: "Clearing agents" },
    { path: "/settings/transport-companies", slug: "transport-companies", title: "Transport companies" },
    { path: "/settings/offices", slug: "offices-warehouses", title: "Offices and warehouses" },
    { path: "/settings/teams", slug: "teams", title: "Teams" },
    { path: "/settings/units", slug: "units", title: "Units" },
  ];
  for (const { path, slug, title, shot: name } of pages) {
    await page.goto(path);
    await expect(downloadButton(page), path).toBeVisible();
    if (name) await page.screenshot({ path: shot(testInfo, `${name}.png`), fullPage: true });
    const files = await downloadAll(page, slug, title);
    // The stage reports hold the closed order.
    if (["orders", "closed-orders", "receiving", "containers", "clearing", "transport", "warehouse", "landed-cost"].includes(slug)) {
      expect(files.CSV.text, slug).toContain(po);
    }
  }
});

test("the menu offers the three formats, and a download holds every matching order, not only the page in view", async ({ page, api }, testInfo) => {
  test.setTimeout(180_000);
  // More orders than the table's page of 10.
  const made: string[] = [];
  for (let i = 0; i < 11; i++) made.push((await api.createOrder({ supplier: "Hangzhou Knits", lines: [{ item: "Polo shirts", quantity: 10 + i, rateCny: 7.25 }] })).po);
  const all = await api.get<{ po: string }[]>("/orders");

  await page.goto("/orders");
  await downloadButton(page).click();
  await expect(page.getByRole("menuitem")).toHaveText(Object.values(MENU_ITEM));
  await page.screenshot({ path: shot(testInfo, "orders-download-menu-open.png"), fullPage: true });
  await page.keyboard.press("Escape");

  // The table shows 10 rows; the CSV every order, with the saved line rate on the items sheet.
  await expect(page.getByRole("table").filter({ visible: true }).getByRole("row")).toHaveCount(11);
  const csv = (await downloadReport(page, "CSV")).text;
  for (const { po } of all) expect(csv).toContain(po);
  expect(csv).toContain("Order items (CNY)");
  expect(csv).toMatch(new RegExp(`${made[0]},Hangzhou Knits,1,Polo shirts,pcs,10,7.25,72.5`));

  // A search narrows the file to what it matches, and says so; nothing matching is "No rows".
  await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(made[3]!);
  const one = await downloadReport(page, "CSV");
  expect(one.text).toContain(made[3]);
  expect(one.text).not.toContain(made[4]);
  expect((await downloadReport(page, "PDF")).text).toContain(`Search: "${made[3]}"`);
  await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill("no-such-order-zz");
  expect((await downloadReport(page, "CSV")).text).toContain("No rows");
});

test("a supplier with more than ten orders downloads every one of them", async ({ page, api }) => {
  const knits = await supplierId(api, "Hangzhou Knits");
  for (let i = 0; i < 11; i++) await api.createOrder({ supplier: "Hangzhou Knits" });
  const orders = await api.get<{ supplier: { id: string }; po: string }[]>("/orders");
  const mine = orders.filter((o) => o.supplier.id === knits.id);
  expect(mine.length).toBeGreaterThan(10);
  await page.goto(`/suppliers/${knits.id}`);
  const csv = (await downloadReport(page, "CSV")).text;
  for (const { po } of mine) expect(csv).toContain(po);
});

test.describe("China staff with Containers", () => {
  test.use({ storageState: LOADING_STAFF_STATE });

  test("the shipping report leaves out the agent payments the role can't read, and says so", async ({ page }) => {
    await page.goto("/containers");
    const pdf = await downloadReport(page, "PDF");
    expect(pdf.text).toContain("Shipping-agent payments are left out: they need Payments access.");
    expect(pdf.text).not.toContain("(Shipping-agent payments \\(CNY\\)) Tj");
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the download stays in the header as an icon, its menu fits the screen, and the page never scrolls sideways", async ({ page }, testInfo) => {
    for (const [path, name] of [["/payments", "payments"], ["/orders", "orders"], ["/warehouse", "warehouse"]] as const) {
      await page.goto(path);
      const button = downloadButton(page);
      await expect(button).toBeVisible();
      await page.screenshot({ path: shot(testInfo, `mobile-${name}-toolbar.png`), fullPage: true });
      await button.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      const box = (await menu.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.screenshot({ path: shot(testInfo, `mobile-${name}-menu-open.png`) });
      const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: MENU_ITEM.Excel }).click()]);
      expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
    }
  });
});
