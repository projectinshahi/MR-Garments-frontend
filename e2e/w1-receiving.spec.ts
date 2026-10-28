import type { Page } from "@playwright/test";

import type { ReceiptListItem } from "../src/lib/api/types";
import { ANITA, type Api, expect, field, freshSignIn, kpi, kv, settled, shortDate, test, toast, today } from "./live-api";
import { MANAGEMENT_STATE, PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Receiving (China): list (22) from REC-1 and Record receipt (21) through REC-2/REC-3. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const search = (page: Page) => page.getByRole("searchbox", { name: "Search PO or supplier" });
const rowOf = (page: Page, po: string) => page.getByRole("table").getByRole("row").filter({ hasText: po });
const chips = (page: Page) => page.getByRole("group", { name: "Receipt status" });
const save = (page: Page) => page.getByRole("button", { name: "Save receipt" });
const receivedNow = (page: Page, item: string) => page.getByRole("textbox", { name: `Received now, ${item}` });
const receiptsOf = async (api: Api, po: string) => (await api.get<ReceiptListItem[]>("/receipts")).filter((r) => r.po === po);
const EMPTY = "No receipts match these filters.";

/** Opens Record receipt with `po` chosen. */
async function openForm(page: Page, po: string) {
  await page.goto("/receiving/new");
  await expect(page.getByRole("heading", { level: 1, name: "Record receipt" })).toBeVisible();
  await page.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: po });
}

test("the list shows each receipt with its totals, filters by search, office, supplier and status, and links the PO", async ({ page, api }) => {
  const partly = await api.createOrder({ supplier: "Hangzhou Knits", lines: [{ item: "Ladies kurtis", quantity: 200, rateCny: 18 }] });
  await api.receive(partly.po, { "Ladies kurtis": 120 }, { bundles: 4 });
  const complete = await api.createOrder({ supplier: "Shenzhen Apparel", lines: [{ item: "Track pants", quantity: 90, rateCny: 22 }] });
  await api.receive(complete.po, { "Track pants": 90 }, { bundles: 3, shortRemark: "" });
  const thisMonth = (await api.get<ReceiptListItem[]>("/receipts")).filter((r) => r.receivedOn.slice(0, 7) === today().slice(0, 7));

  await page.goto("/receiving");
  await expect(page.getByRole("heading", { level: 1, name: "Receiving (China)" })).toBeVisible();
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(today().slice(5, 7)) - 1]!;
  await expect(kpi(page, `Receipts in ${month}`).locator("p").nth(1)).toHaveText(String(thisMonth.length));
  await expect(kpi(page, "Waiting to be received")).toContainText("orders not yet in China office");
  await expect(kpi(page, "Partly received")).toContainText(partly.po);
  await expect(kpi(page, "Short items this month")).toContainText("–");

  await search(page).fill(partly.po);
  await expect(rowOf(page, partly.po).getByRole("cell")).toHaveText([
    shortDate(today()), partly.po, "Hangzhou Knits", "Ladies kurtis", "200 pcs", "120", "120", "–", "4", "Suresh Menon", "Partly received",
  ]);
  await search(page).fill("shenzhen apparel");
  await expect(rowOf(page, complete.po).getByRole("cell")).toHaveText([
    shortDate(today()), complete.po, "Shenzhen Apparel", "Track pants", "90 pcs", "90", "90", "0", "3", "Suresh Menon", "Complete",
  ]);
  await search(page).fill("no such receipt zzz");
  await expect(page.getByText(EMPTY)).toBeVisible();

  // Status chips.
  await search(page).fill(partly.po);
  await chips(page).getByRole("button", { name: "Complete" }).click();
  await expect(chips(page).getByRole("button", { name: "Complete" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(EMPTY)).toBeVisible();
  await chips(page).getByRole("button", { name: "Partly received" }).click();
  await expect(rowOf(page, partly.po)).toBeVisible();
  await search(page).fill(complete.po);
  await expect(page.getByText(EMPTY)).toBeVisible();
  await chips(page).getByRole("button", { name: "All", exact: true }).click();
  await expect(rowOf(page, complete.po)).toBeVisible();

  // Office and supplier filters.
  await page.getByRole("button", { name: "Office: All offices" }).click();
  await page.getByRole("menuitemradio", { name: "Guangzhou office" }).click();
  await expect(rowOf(page, complete.po)).toBeVisible();
  await page.getByRole("button", { name: "Supplier: All suppliers" }).click();
  await page.getByRole("menuitemradio", { name: "Hangzhou Knits" }).click();
  await expect(page.getByText(EMPTY)).toBeVisible();
  await search(page).fill(partly.po);
  await expect(rowOf(page, partly.po)).toBeVisible();

  // The PO opens the order.
  await rowOf(page, partly.po).getByRole("link", { name: partly.po }).click();
  await expect(page).toHaveURL(`/orders/${partly.po}`);
});

test("Record receipt: the chosen order's lines, short and the effect on payment follow what you type", async ({ page, api }) => {
  const order = await api.createOrder({
    supplier: "Guangzhou Textile Co.",
    lines: [
      { item: "Men's jackets", quantity: 500, rateCny: 60 },
      { item: "Cotton fabric", quantity: 300, rateCny: 10 },
    ],
    deposits: [{ amountCny: 5000, rateInr: 12 }],
  });
  await api.receive(order.po, { "Men's jackets": 20 }, { receivedOn: today(-1), bundles: 1 });

  await openForm(page, order.po);
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/receiving");
  const details = page.getByRole("region", { name: "Receipt details" });
  await expect(details).toContainText("Men's jackets");
  await expect(details).toContainText("Guangzhou Textile Co.");
  await expect(page.getByText("Partly received", { exact: true })).toBeVisible();
  await expect(field(page, "Received on")).toHaveValue(today());
  await expect(page.getByRole("combobox", { name: "Received at office" })).toHaveValue(/.+/);
  await expect(page.getByRole("combobox", { name: "Received at office" }).locator("option:checked")).toHaveText("Guangzhou office");
  await expect(page.getByRole("textbox", { name: "Received by" })).toHaveValue("Suresh Menon");

  const jackets = page.getByRole("row").filter({ hasText: "Men's jackets" });
  await expect(jackets).toContainText("500 pcs");
  await expect(jackets).toContainText("20 pcs");
  await expect(jackets.getByRole("cell").last()).toHaveText("480 pcs");
  await expect(kv(page, "Order value")).toHaveText("¥ 33,000");
  await expect(kv(page, "Deposits paid")).toHaveText("¥ 5,000");
  await expect(kv(page, "Balance before this receipt")).toHaveText("¥ 28,000");
  await expect(page.getByText(`Deliveries for ${order.po}`)).toBeVisible();
  await expect(page.getByText(`${shortDate(today(-1))} · Guangzhou office`)).toBeVisible();

  await receivedNow(page, "Men's jackets").fill("470");
  await receivedNow(page, "Cotton fabric").fill("300");
  await expect(jackets.getByRole("cell").last()).toHaveText("10 pcs");
  await expect(kv(page, "Short: 10 pcs × ¥60")).toHaveText("− ¥ 600");
  await expect(kv(page, "Balance to pay now")).toHaveText("¥ 27,400");
  // Still short, so the remark is required.
  await expect(page.getByRole("textbox", { name: "Short remark" })).toHaveAttribute("aria-required", "true");
  await receivedNow(page, "Men's jackets").fill("480");
  await expect(page.getByRole("textbox", { name: "Short remark" })).toHaveAttribute("aria-required", "false");
});

test("Record receipt: every client check, and nothing is saved", async ({ page, api }) => {
  const order = await api.createOrder({ lines: [{ item: "Polo shirts", quantity: 200, rateCny: 15 }] });
  await openForm(page, order.po);

  await save(page).click();
  await expect(page.getByText("Enter a whole number.")).toBeVisible();
  await expect(page.getByText("Enter what was received for at least one item.")).toBeVisible();

  await field(page, "Received on").fill(today(1));
  await page.getByRole("textbox", { name: "Bundles received now" }).fill("2");
  await receivedNow(page, "Polo shirts").fill("201");
  await save(page).click();
  await expect(page.getByText("The date can't be after today.")).toBeVisible();
  await expect(page.getByText("Only 200 pcs left to receive.")).toBeVisible();

  await field(page, "Received on").fill(today());
  await receivedNow(page, "Polo shirts").fill("150");
  await save(page).click();
  await expect(page.getByText("Add a remark about the short items.")).toBeVisible();

  await receivedNow(page, "Polo shirts").fill("1.5");
  await save(page).click();
  await expect(page.getByText("Enter a whole number.")).toBeVisible();

  expect(await receiptsOf(api, order.po)).toHaveLength(0);
});

test("Record receipt: the API's 422 and 409 show; a failed or lost request keeps the values", async ({ page, api }) => {
  const order = await api.createOrder({ lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
  await openForm(page, order.po);
  await page.getByRole("textbox", { name: "Bundles received now" }).fill("2");
  await receivedNow(page, "Denim jeans").fill("80");
  await page.getByRole("textbox", { name: "Short remark" }).fill("20 to follow");

  // Someone else receives 30 meanwhile: 80 more would over-receive (REC-3 422 on lines).
  await api.receive(order.po, { "Denim jeans": 30 });
  await save(page).click();
  await expect(page.getByText("Denim jeans: only 70 pcs left to receive.")).toBeVisible();
  await expect(receivedNow(page, "Denim jeans")).toHaveValue("80");

  // 500, then a lost request.
  await receivedNow(page, "Denim jeans").fill("50");
  await page.route("**/api/v1/receipts", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong." } } }) : route.fallback(),
  );
  await save(page).click();
  await expect(toast(page, "Something went wrong.").first()).toContainText("Please try again.");
  await page.unroute("**/api/v1/receipts");
  await page.route("**/api/v1/receipts", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  const failed = page.waitForEvent("requestfailed", (request) => request.url().endsWith("/api/v1/receipts"));
  await save(page).click();
  await failed;
  await expect(page.getByRole("textbox", { name: "Short remark" })).toHaveValue("20 to follow");
  await page.unroute("**/api/v1/receipts");

  // The order is loaded into a container meanwhile (stage 3): REC-3 refuses with 409 and its own message.
  await api.load([{ po: order.po, item: "Denim jeans", quantity: 30 }]);
  await save(page).click();
  await expect(toast(page, "This order is past receiving and can't take more receipts.")).toBeVisible();
  await expect(page).toHaveURL("/receiving/new");

  expect(await receiptsOf(api, order.po)).toHaveLength(1);
});

test("saving a receipt returns to the list, moves the order to stage 2, and the next visit starts fresh", async ({ page, api }) => {
  const order = await api.createOrder({ lines: [{ item: "Men's shorts", quantity: 60, rateCny: 9 }] });
  await openForm(page, order.po);
  await page.getByRole("textbox", { name: "Bundles received now" }).fill("2");
  await page.getByRole("textbox", { name: "Supplier delivery note no." }).fill("DN-77");
  await receivedNow(page, "Men's shorts").fill("60");
  await save(page).click();

  await expect(toast(page, "Receipt saved")).toBeVisible();
  await expect(page).toHaveURL("/receiving");
  await search(page).fill(order.po);
  await expect(rowOf(page, order.po)).toContainText("Complete");
  expect((await api.order(order.po)).stage).toBe(2);
  expect((await api.order(order.po)).receipts).toMatchObject([{ bundles: 2, deliveryNote: "DN-77", shortRemark: "", receivedBy: "Suresh Menon" }]);

  // The fully received order is no longer offered, and the form is empty.
  await page.getByRole("link", { name: "+ Record receipt" }).click();
  await expect(page).toHaveURL("/receiving/new");
  await expect(page.getByRole("combobox", { name: "Order", exact: true }).getByRole("option", { name: order.po, exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Bundles received now" })).toHaveValue("");

  // Cancel goes back to the list.
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/receiving");
});

test("double-clicking Save receipt saves one receipt", async ({ page, api }) => {
  const order = await api.createOrder({ lines: [{ item: "Track pants", quantity: 40, rateCny: 20 }] });
  await openForm(page, order.po);
  await page.getByRole("textbox", { name: "Bundles received now" }).fill("1");
  await receivedNow(page, "Track pants").fill("10");
  await page.getByRole("textbox", { name: "Short remark" }).fill("30 to follow");
  await save(page).dblclick();
  await expect(page).toHaveURL("/receiving");
  expect(await receiptsOf(api, order.po)).toHaveLength(1);
});

test.describe("China staff (receiving Enter)", () => {
  test.use({ storageState: STAFF_STATE });

  test("records a receipt in their name that Management then sees; the PO is plain text", async ({ page, api, browser }) => {
    const order = await api.createOrder({ supplier: "Hangzhou Knits", lines: [{ item: "Kids t-shirts", quantity: 300, rateCny: 4 }] });
    await openForm(page, order.po);
    await expect(page.getByRole("textbox", { name: "Received by" })).toHaveValue("Chen Yu");
    await page.getByRole("textbox", { name: "Bundles received now" }).fill("6");
    await receivedNow(page, "Kids t-shirts").fill("300");
    await save(page).click();
    await expect(page).toHaveURL("/receiving");
    await search(page).fill(order.po);
    await expect(rowOf(page, order.po)).toContainText("Chen Yu");
    await expect(rowOf(page, order.po).getByRole("link", { name: order.po })).toHaveCount(0);

    const management = settled(await browser.newPage({ storageState: MANAGEMENT_STATE, viewport: { width: 1440, height: 900 } }));
    await management.goto("/receiving");
    await search(management).fill(order.po);
    await expect(rowOf(management, order.po)).toContainText("Chen Yu");
    await management.close();
  });
});

test.describe("Procurement (receiving View)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("sees the list without + Record receipt, and the form URL says no access", async ({ page }) => {
    await page.goto("/receiving");
    await expect(page.getByRole("heading", { level: 1, name: "Receiving (China)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "+ Record receipt" })).toHaveCount(0);
    await expect(kpi(page, "Waiting to be received")).toContainText("–");

    await page.goto("/receiving/new");
    await expect(page.getByText("You don't have access to do that.")).toBeVisible();
    await page.getByRole("link", { name: "Back to Receiving" }).click();
    await expect(page).toHaveURL("/receiving");
  });
});

test.describe("Accounts (no receiving access)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("the receiving page goes to the dashboard", async ({ page }) => {
    await page.goto("/receiving");
    await expect(page).toHaveURL("/");
  });
});
