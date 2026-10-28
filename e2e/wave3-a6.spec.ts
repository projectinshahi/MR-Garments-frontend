import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";

import { periodLabel } from "../src/features/reports/data/filters";
import { expect, inr, kpi, test, today, toast } from "./live-api";

// Wave 3 A6: Landed Cost (31) and the Reports hub and reports (32–38) on live data. One order is created through the
// API and walked from order to container, checking each report as it goes; the shared test database holds other specs'
// rows too, so assertions look for this order's PO.
//
// Order: Hangzhou Knits, 100 Polo shirts at ¥10 (¥1,000), due in 3 days, ¥400 deposit at 12.00 (₹4,800). 60 received
// (40 short, ¥400), then the 60 loaded into a container.

test.use({ viewport: { width: 1440, height: 900 } });

const rowOf = (page: Page, text: string) => page.getByRole("table").getByRole("row").filter({ hasText: text });
const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
async function choose(page: Page, current: string, option: string) {
  await page.getByRole("button", { name: current }).click();
  await page.getByRole("menuitemradio", { name: option }).click();
}

test("landed cost and every report show the new order's real figures, filters narrow them, CSV downloads", async ({ page, api }) => {
  test.setTimeout(240_000);
  const order = await api.createOrder({
    supplier: "Hangzhou Knits",
    deliveryDate: today(3),
    lines: [{ item: "Polo shirts", quantity: 100, rateCny: 10 }],
    deposits: [{ amountCny: 400, rateInr: 12 }],
  });
  const { po } = order;

  await test.step("13.2 and 13.1: the order is due in 3 days and waits at stage 1", async () => {
    await page.goto("/reports/deliveries-per-day");
    await expect(heading(page, "Deliveries per day")).toBeVisible();
    await expect(page.getByRole("figure", { name: "Deliveries due per day, next 14 days" })).toBeVisible();
    await page.goto("/reports/order-status");
    await expect(heading(page, "Order status")).toBeVisible();
    const stage1 = page.getByRole("meter", { name: "1. Order and deposit" });
    expect(Number(await stage1.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(1);
  });

  await test.step("Landed Cost: an estimate waiting for the supplier payment, with its breakdown and goods payment", async () => {
    await page.goto("/landed-cost");
    await expect(heading(page, "Landed Cost")).toBeVisible();
    const row = rowOf(page, po);
    await expect(row).toContainText("Polo shirts");
    await expect(row).toContainText(inr(4800));
    await expect(row).toContainText("Estimate");
    await expect(row).toContainText("waiting for supplier payment");
    await row.getByRole("button", { name: po }).click();
    await expect(page.getByRole("heading", { level: 2, name: `${po} · Polo shirts: where the ${inr(4800)} goes` })).toBeVisible();
    await expect(rowOf(page, "Deposit").filter({ hasText: "12.00" })).toContainText(inr(4800));

    await choose(page, "Supplier: All suppliers", "Hangzhou Knits");
    await expect(page).toHaveURL(/supplier=/);
    await expect(rowOf(page, po)).toBeVisible();
    await choose(page, "Supplier: Hangzhou Knits", "Yiwu Trims Ltd.");
    await expect(rowOf(page, po)).toHaveCount(0);

    const views = page.getByRole("group", { name: "Group landed cost" });
    await views.getByRole("button", { name: "By team" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Landed cost by team" })).toBeVisible();
    await views.getByRole("button", { name: "By item" }).click();
    await expect(toast(page, "Landed cost by item is not included in the current prototype.")).toBeVisible();
  });

  await test.step("13.3: receiving 60 of 100 shows 40 pcs short, worth ¥400", async () => {
    await api.receive(po, { "Polo shirts": 60 });
    await page.goto("/reports/ordered-vs-received");
    await expect(rowOf(page, po)).toContainText("100 pcs60 pcs40 pcs¥400Reduced");
  });

  let container = "";
  await test.step("13.4: the loaded container is on the timeline", async () => {
    container = (await api.load([{ po, item: "Polo shirts", quantity: 60 }], { eta: today(10) })).number;
    await page.goto("/reports/containers-timeline");
    await expect(heading(page, "Containers timeline")).toBeVisible();
    await expect(page.getByRole("img", { name: new RegExp(`^${container}: loaded `) })).toBeVisible();
  });

  await test.step("13.5: the supplier's open order, narrowed by the supplier filter, exported as CSV", async () => {
    const suppliers = (await api.options()).suppliers;
    const id = (name: string) => suppliers.find((s) => s.name === name)!.id;
    await page.goto(`/reports/payments-per-supplier?supplier=${id("Hangzhou Knits")}`);
    await expect(page.getByText("Hangzhou Knits", { exact: true }).first()).toBeVisible(); // the filter pill and the row
    await expect(rowOf(page, "Hangzhou Knits")).toContainText(po);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3); // header, Hangzhou Knits, total

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^payments-per-supplier-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await readFile(await download.path(), "utf8");
    expect(csv).toContain("Supplier,Orders,Order value (CNY),Paid (CNY),Paid (INR),Balance (CNY)");
    expect(csv).toContain(`Hangzhou Knits,${po}`);

    await page.goto(`/reports/payments-per-supplier?supplier=${id("Yiwu Trims Ltd.")}`);
    await expect(rowOf(page, po)).toHaveCount(0);
    await page.getByRole("button", { name: "Export Excel" }).click();
    await expect(toast(page, "Export Excel is not included in the current prototype.")).toBeVisible();
  });

  await test.step("13.6 loads; the hub shows live stat strips, an empty download list and carries its filters", async () => {
    await page.goto("/reports/landed-cost-by-month");
    await expect(heading(page, "Landed cost by month")).toBeVisible();
    await expect(kpi(page, "Landed cost, all months")).toBeVisible();

    await page.goto("/reports");
    await expect(heading(page, "Reports")).toBeVisible();
    await expect(page.getByText(/^\d[\d,]* orders? · \d[\d,]* waiting at stage 1$/)).toBeVisible();
    await expect(page.getByText(/^\d[\d,]* orders? short · \d[\d,]* pcs missing/)).toBeVisible();
    await expect(page.getByText("No downloads to show.")).toBeVisible();
    await choose(page, "Supplier: All suppliers", "Hangzhou Knits");
    await expect(page.getByRole("link", { name: "Open report: Order status" })).toHaveAttribute("href", /supplier=/);
    const month = periodLabel(today().slice(0, 7));
    await choose(page, "Period: All dates", month);
    await expect(page).toHaveURL(/period=/);
    await page.getByRole("link", { name: "Open report: Order status" }).click();
    await expect(heading(page, "Order status")).toBeVisible();
    await expect(page.getByText(`${month} · Hangzhou Knits`)).toBeVisible(); // the header pill
    await expect(page.getByRole("meter", { name: "1. Order and deposit" })).toHaveAttribute("aria-valuenow", /^[1-9]/);
  });
});
