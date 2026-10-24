import { expect, test, type Page } from "@playwright/test";

// W1-order-detail-a: order detail tabs a–e for PO-2028 (references 06–10). Role/label locators only: visited
// routes stay in the DOM hidden by <Activity>, and role queries skip hidden content.

test.use({ viewport: { width: 1440, height: 900 } });

const card = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });

test("overview: header facts, journey, money, teams and activity", async ({ page }) => {
  await page.goto("/orders/PO-2028");
  await expect(page.getByRole("heading", { level: 1, name: "PO-2028" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Order sections" }).getByRole("link", { name: /Overview/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { level: 2, name: "Denim jeans" })).toBeVisible();
  await expect(page.getByText("Guangzhou Textile Co. · Contact: Mr. Zhao Lin")).toBeVisible();
  await expect(page.getByText("₹550.80 per piece")).toBeVisible();
  await expect(page.getByText("2,500 pcs · 50 bundles")).toBeVisible();

  const journey = card(page, "Journey of this order").getByRole("listitem");
  await expect(journey).toHaveCount(6);
  await expect(journey.last()).toContainText("6. India warehouse");
  await expect(journey.last()).toContainText("Received by Joseph M");

  await expect(card(page, "Money")).toContainText("Landed cost₹13,77,000");
  await expect(card(page, "Given to teams")).toContainText("Total2,500 pcs");
  await expect(card(page, "Latest activity").getByRole("listitem").first()).toContainText("3 Oct · Joseph M · 50 bundles");
});

test("items: table with totals, quantity by size, order terms and notes", async ({ page }) => {
  await page.goto("/orders/PO-2028/items");
  await expect(page.getByText("· Order date 5 Aug 2026")).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /Denim jeans/ })).toContainText("¥32.00");
  await expect(table.getByRole("row", { name: /Total/ })).toContainText("¥80,000");
  await expect(page.getByRole("meter", { name: "Size 32" })).toHaveAttribute("aria-valuenow", "800");
  await expect(page.getByText("300 + 600 + 800 + 500 + 300 = 2,500 pcs · 50 pcs in each bundle")).toBeVisible();
  await expect(card(page, "Order terms")).toContainText("CNF");
  await expect(card(page, "Order terms")).toContainText("¥ Chinese yuan");
  await expect(card(page, "Notes")).toContainText("Supplier to send the packing list with photos.");
});

test("deposits & payments: KPIs, payments at their own rate and the INR working", async ({ page }) => {
  await page.goto("/orders/PO-2028/payments");
  await expect(page.getByText("· Order value ¥80,000")).toBeVisible();
  await expect(page.getByText("2,500 pcs × ¥32")).toBeVisible();
  await expect(page.getByText("Fully paid")).toBeVisible();

  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: "Deposit" })).toContainText("₹8,40,000");
  await expect(rows.filter({ hasText: "Balance" })).toContainText("14.00");
  await expect(rows.filter({ hasText: "Total paid" })).toContainText("₹9,80,000");

  await expect(card(page, "How the INR figure is found")).toContainText("¥10,000 × 14.00₹1,40,000");
  await expect(card(page, "How the INR figure is found")).toContainText("Goods cost in INR₹9,80,000");
});

test("receiving: read-only receipt, short pill, photos and history", async ({ page }) => {
  await page.goto("/orders/PO-2028/receiving");
  await expect(page.getByText("· Received in China 26 Aug 2026")).toBeVisible();
  await expect(page.getByText("Nothing missing")).toBeVisible();
  await expect(page.getByLabel("Received on")).toHaveValue("26 Aug 2026");
  await expect(page.getByLabel("Received by")).toHaveValue("Wang Fang");
  await expect(page.getByLabel("Pieces received")).toHaveValue("2,500");
  await expect(page.getByLabel("Short pieces")).toHaveJSProperty("readOnly", true);
  await expect(page.getByRole("table").getByRole("row", { name: /Denim jeans/ })).toContainText("2,500");
  await expect(page.getByRole("img", { name: "Photo: Packing list.jpg" })).toBeVisible();
  await expect(card(page, "Receiving history").getByRole("listitem")).toHaveText([
    /Received, no shortage.*26 Aug 11:05 · Wang Fang/,
    /Supplier said goods are ready.*24 Aug · noted by Procurement/,
  ]);
});

test("containers: route, numbers and this order's share", async ({ page }) => {
  await page.goto("/orders/PO-2028/containers");
  await expect(page.getByText("· 1 container")).toBeVisible();
  const container = card(page, "Container CAIU 2298076");
  await expect(container).toContainText("Shipping agent: Sino Freight");
  await expect(container.getByRole("listitem")).toHaveText([/Guangzhou \(Nansha\)Loaded 9 Sep/, /On the seaSailed 12 Sep/, /Kochi portArrived 28 Sep/]);
  await expect(page.getByLabel("Seal number")).toHaveValue("SL-830417");
  await expect(page.getByLabel("Bill of lading")).toHaveValue("SFL-2208-114");
  await expect(card(page, "Goods of this order in the container")).toContainText("Share of this order in container100%");
});

test("tabs a–e navigate between the order sections", async ({ page }) => {
  await page.goto("/orders/PO-2028");
  const tabs = page.getByRole("navigation", { name: "Order sections" });
  for (const [label, path, heading] of [
    ["Items", "/items", "Items ordered"],
    ["Deposits & payments", "/payments", "Deposits and payments"],
    ["Receiving", "/receiving", "Receipt in China"],
    ["Containers", "/containers", "Container CAIU 2298076"],
  ] as const) {
    await tabs.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(`/orders/PO-2028${path}`);
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
});
