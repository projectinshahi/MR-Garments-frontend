import type { Browser, BrowserContextOptions, Page } from "@playwright/test";

import type { ContainerListItem, ReceiptListItem } from "../src/lib/api/types";
import { ANITA, containerNumber, expect, field, kpi, kv, longDate, settled, shortDate, signInState, test, toast, today } from "./live-api";
import { LOADING_STAFF_STATE, PROCUREMENT_STATE, SIGNED_OUT, STAFF_STATE } from "./sessions";

// Round 2: one fresh order walked through the five live tabs by the roles that do each step, in a real browser,
// checking the PO, figures and statuses on every tab, the refusals that must change nothing, and that everything
// survives a reload and a fresh sign-in.
//
// Order: Shenzhen Apparel, 100 Men's jackets at ¥30 + 200 Kids t-shirts at ¥5 = ¥4,000, due in 5 days, with a
// ¥1,000 deposit at 12.00 (₹12,000). Accounts then pays the agent ¥500 at 12.50 (₹6,250): paid ¥1,500 / ₹18,250,
// balance ¥2,500.

const VIEWPORT = { width: 1440, height: 900 };
test.use({ viewport: VIEWPORT });

const as = async (browser: Browser, storageState: BrowserContextOptions["storageState"]) => settled(await browser.newPage({ storageState, viewport: VIEWPORT }));
const rowOf = (page: Page, text: string) => page.getByRole("table").getByRole("row").filter({ hasText: text });
const tabs = (page: Page) => page.getByRole("navigation", { name: "Order sections" });

test("a new order goes from Orders through Payments, Calendar, Receiving and Containers", async ({ page, api, browser, playwright, baseURL }) => {
  test.setTimeout(240_000);
  const due = today(5);
  let po = "";
  const receiptsOf = async () => (await api.get<ReceiptListItem[]>("/receipts")).filter((r) => r.po === po);

  /** The order's figures on Orders, Payments and the order's Deposits & payments tab, as Management sees them. */
  async function expectMoney(viewer: Page, paid: string, paidInr: string, balance: string, payments: number) {
    await viewer.goto("/orders");
    await viewer.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(po);
    await expect(rowOf(viewer, po)).toContainText(paidInr);
    await viewer.goto("/payments");
    await viewer.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    await expect(rowOf(viewer, po).getByRole("cell")).toHaveText([`${po}Shenzhen Apparel`, "4,000", paid.replace("¥", ""), paidInr, balance.replace("¥", ""), "Not yet due"]);
    await viewer.goto(`/orders/${po}/payments`);
    await expect(kpi(viewer, "Order value")).toContainText("¥4,000");
    await expect(kpi(viewer, "Paid so far")).toContainText(paid);
    await expect(kpi(viewer, "Paid so far")).toContainText(`${payments} payment`);
    await expect(kpi(viewer, "Balance to pay")).toContainText(balance);
    await expect(kv(viewer, "Goods cost in INR")).toHaveText(paidInr);
  }

  await test.step("Procurement places the order with a deposit (Orders)", async () => {
    const priya = await as(browser, PROCUREMENT_STATE);
    await priya.goto("/orders");
    await priya.getByRole("link", { name: "+ New order" }).click();
    const nextPo = await priya.getByRole("textbox", { name: "Purchase order no." }).inputValue();
    await priya.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: "Shenzhen Apparel" });
    await field(priya, "Delivery date").fill(due);
    await priya.getByRole("combobox", { name: "Item, line 1" }).selectOption({ label: "Men's jackets" });
    await priya.getByRole("textbox", { name: "Rate (¥), line 1" }).fill("30");
    await priya.getByRole("textbox", { name: "Quantity, line 1" }).fill("100");
    await priya.getByRole("button", { name: "+ Add item" }).click();
    await priya.getByRole("combobox", { name: "Item, line 2" }).selectOption({ label: "Kids t-shirts" });
    await priya.getByRole("textbox", { name: "Rate (¥), line 2" }).fill("5");
    await priya.getByRole("textbox", { name: "Quantity, line 2" }).fill("200");
    await priya.getByRole("button", { name: "+ Add deposit" }).click();
    await priya.getByRole("textbox", { name: "Amount (¥), deposit 1" }).fill("1000");
    await field(priya, "Rate to INR").fill("12");
    await field(priya, "Mode").fill("Bank transfer");
    await expect(kv(priya, "Balance to pay")).toHaveText("¥ 3,000");
    await priya.getByRole("button", { name: "Place order" }).dblclick();
    await expect(toast(priya, `Order ${nextPo} placed`)).toBeVisible();
    await expect(priya).toHaveURL(`/orders/${nextPo}`);
    po = nextPo;
    await priya.close();

    const order = await api.order(po);
    expect(order).toMatchObject({ stage: 1, orderValueCny: 4000, paidCny: 1000, paidInr: 12_000, balanceCny: 3000, item: "Men's jackets", quantity: 100 });
    expect((await api.options()).nextPo).toBe(`PO-${Number(po.slice(3)) + 1}`); // the double click placed one order
  });

  await test.step("it appears in the Calendar (stage 1) and in Payments with its totals", async () => {
    await page.goto("/calendar/list");
    await expect(rowOf(page, po).getByRole("cell")).toHaveText([shortDate(due), po, "Shenzhen Apparel", "Men's jackets", "100 pcs", "Due in 5 days"]);
    await page.goto(`/calendar?month=${due.slice(0, 7)}`);
    await page.getByRole("table").getByRole("link", { name: po }).click();
    await expect(page).toHaveURL(`/orders/${po}`);
    await page.goto("/orders");
    await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(po);
    await expect(rowOf(page, po)).toContainText("1. Order and deposit");
    await expect(rowOf(page, po)).toContainText("Due in 5 days");
    await expectMoney(page, "¥1,000", "₹12,000", "¥3,000", 1);
  });

  await test.step("Accounts records a Balance payment to the agent; totals update everywhere", async () => {
    // A new session: batch1-a5-passwords ends the one auth.setup.ts saved for Anita.
    const anita = await as(browser, await signInState(playwright, baseURL, ANITA));
    await anita.goto("/payments");
    await anita.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    await rowOf(anita, po).getByRole("button", { name: po }).click();
    await anita.getByRole("button", { name: `+ Record payment for ${po}` }).click();
    const form = anita.getByRole("dialog", { name: `Record payment for ${po}` });
    await form.getByRole("combobox", { name: "Kind" }).selectOption("Balance");
    await form.getByRole("combobox", { name: "Paid to" }).selectOption({ label: "Dragon Cargo (agent)" });
    await form.getByRole("textbox", { name: "Amount (¥)" }).fill("500");
    await form.getByRole("textbox", { name: "Rate (₹ per ¥)" }).fill("12.5");
    await form.getByRole("textbox", { name: "Mode" }).fill("Wire");
    await expect(form.getByRole("status")).toHaveText("₹6,250");
    await form.getByRole("button", { name: "Record payment" }).dblclick();
    await expect(toast(anita, `Payment recorded for ${po}`).first()).toBeVisible();
    await expect(anita.getByRole("heading", { name: "2. Balance" })).toBeVisible();
    // The card's PO opens the order.
    await anita.getByRole("heading", { name: `${po} payments` }).getByRole("link", { name: po }).click();
    await expect(anita).toHaveURL(`/orders/${po}`);
    await anita.close();

    const order = await api.order(po);
    expect(order.payments).toHaveLength(2);
    expect(order.payments![1]).toMatchObject({ kind: "Balance", payee: "Dragon Cargo", payeeRole: "agent", amountCny: 500, rateInr: 12.5, mode: "Wire" });
    await expectMoney(page, "¥1,500", "₹18,250", "¥2,500", 2);
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows.nth(1).getByRole("cell")).toHaveText([longDate(today()), "Deposit", "Shenzhen Apparel", "¥1,000", "12.00", "₹12,000"]);
    await expect(rows.nth(2).getByRole("cell")).toHaveText([longDate(today()), "Balance", "Dragon Cargo", "¥500", "12.50", "₹6,250"]);
  });

  await test.step("China staff record a short receipt with a remark (stage 1 to 2)", async () => {
    const chen = await as(browser, STAFF_STATE);
    await chen.goto("/receiving");
    await chen.getByRole("link", { name: "+ Record receipt" }).click();
    await chen.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: po });
    await chen.getByRole("textbox", { name: "Bundles received now" }).fill("5");
    await chen.getByRole("textbox", { name: "Supplier delivery note no." }).fill("DN-A");
    await chen.getByRole("textbox", { name: "Received now, Men's jackets" }).fill("60");
    await chen.getByRole("textbox", { name: "Received now, Kids t-shirts" }).fill("200");
    await chen.getByRole("button", { name: "Save receipt" }).click();
    await expect(chen.getByText("Add a remark about the short items.")).toBeVisible();
    expect(await receiptsOf()).toHaveLength(0);
    await chen.getByRole("textbox", { name: "Short remark" }).fill("40 jackets to follow");
    await chen.getByRole("button", { name: "Save receipt" }).dblclick();
    await expect(toast(chen, "Receipt saved").first()).toBeVisible();
    await expect(chen).toHaveURL("/receiving");
    await chen.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    await expect(rowOf(chen, po)).toContainText("Partly received");
    await chen.close();

    expect(await receiptsOf()).toHaveLength(1);
    expect((await api.order(po)).stage).toBe(2);
    await page.goto("/orders");
    await page.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(po);
    await expect(rowOf(page, po)).toContainText("2. Receiving in China");
    await page.goto("/calendar/list");
    await expect(rowOf(page, po)).toContainText("Due in 5 days"); // stage 2 is still on the calendar
  });

  await test.step("a second receipt completes the jackets; over-receipts are refused and change nothing", async () => {
    const wang = await as(browser, LOADING_STAFF_STATE);
    await wang.goto("/receiving/new");
    await wang.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: po });
    await wang.getByRole("textbox", { name: "Bundles received now" }).fill("3");
    await wang.getByRole("textbox", { name: "Received now, Men's jackets" }).fill("41");
    await wang.getByRole("button", { name: "Save receipt" }).click();
    await expect(wang.getByText("Only 40 pcs left to receive.")).toBeVisible();
    const over = await api.post("/receipts", await api.receiptBody(po, { "Men's jackets": 41 }));
    expect(over.status()).toBe(422);
    expect((await over.json()).error.fields).toEqual({ lines: "Men's jackets: only 40 pcs left to receive." });
    expect(await receiptsOf()).toHaveLength(1);

    await wang.getByRole("textbox", { name: "Received now, Men's jackets" }).fill("40");
    await expect(wang.getByRole("textbox", { name: "Short remark" })).toHaveAttribute("aria-required", "false");
    await wang.getByRole("button", { name: "Save receipt" }).click();
    await expect(wang).toHaveURL("/receiving");
    await wang.close();
    expect(await receiptsOf()).toHaveLength(2);

    // Nothing is left: the form no longer offers the order, and the API refuses another receipt.
    const nothingLeft = await api.post("/receipts", await api.receiptBody(po, { "Men's jackets": 1 }));
    expect(nothingLeft.status()).toBe(422);
    expect((await nothingLeft.json()).error.fields.lines).toBe("Men's jackets: only 0 pcs left to receive.");
    await page.goto("/receiving/new");
    await expect(page.getByRole("combobox", { name: "Order", exact: true }).getByRole("option", { name: po, exact: true })).toHaveCount(0);

    // Receiving list: both receipts with their running totals, PO linked for Management.
    await page.goto("/receiving");
    await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
    await expect(rowOf(page, "Wang Fang")).toContainText("Complete");
    await expect(rowOf(page, "Chen Yu")).toContainText("Partly received");
    await rowOf(page, "Chen Yu").getByRole("link", { name: po }).click();
    await expect(page).toHaveURL(`/orders/${po}`);

    // Order detail, Receiving tab: both receipts.
    await tabs(page).getByRole("link", { name: "Receiving" }).click();
    await expect(page.getByRole("heading", { name: "Latest receipt in China" })).toBeVisible();
    await expect(kpi(page, "Received in China")).toContainText("100 pcs");
    await expect(kpi(page, "Received in China")).toContainText("8 bundles");
    await expect(kpi(page, "Short")).toContainText("0 pcs");
    await expect(field(page, "Received by")).toHaveValue("Wang Fang");
    const history = page.getByRole("list").filter({ hasText: "Received 40 pcs Men's jackets" });
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history.getByRole("listitem").nth(1)).toContainText("Received 60 pcs Men's jackets, 200 pcs Kids t-shirts");
    await expect(history.getByRole("listitem").nth(1)).toContainText("Chen Yu");
  });

  let containerId = "";
  const number = containerNumber();
  await test.step("China staff load it into a new container (stage 2 to 3); it leaves the Calendar", async () => {
    const wang = await as(browser, LOADING_STAFF_STATE);
    await wang.goto("/containers");
    await wang.getByRole("link", { name: "+ New container" }).click();
    await wang.getByRole("textbox", { name: "Container number" }).fill(number);
    await wang.getByRole("combobox", { name: "Shipping agent" }).selectOption({ label: "Sino Freight" });
    await field(wang, "Expected arrival in India (ETA)").fill(today(21));
    await wang.getByRole("textbox", { name: `Bundles, ${po} Men's jackets` }).fill("3");
    await wang.getByRole("textbox", { name: `Quantity, ${po} Men's jackets` }).fill("101");
    await wang.getByRole("textbox", { name: `Bundles, ${po} Kids t-shirts` }).fill("5");
    await wang.getByRole("textbox", { name: `Quantity, ${po} Kids t-shirts` }).fill("200");
    await wang.getByRole("button", { name: "Save container" }).click();
    await expect(wang.getByText("Only 100 pcs left to load.")).toBeVisible();
    const overLoad = await api.post("/containers", await api.containerBody([{ po, item: "Men's jackets", quantity: 101 }]));
    expect(overLoad.status()).toBe(422);
    expect((await overLoad.json()).error.fields.lines).toBe(`Men's jackets (${po}): only 100 pcs left to load.`);

    await wang.getByRole("textbox", { name: `Quantity, ${po} Men's jackets` }).fill("100");
    await wang.getByRole("button", { name: "Save container" }).dblclick();
    await expect(toast(wang, "Container saved").first()).toBeVisible();
    await expect(wang).toHaveURL("/containers");
    await wang.close();

    const saved = (await api.get<ContainerListItem[]>("/containers")).filter((c) => c.number === number);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: "loading", bundles: 8, orders: [{ po, part: false }], agent: { name: "Sino Freight" }, terms: "FOB" });
    containerId = saved[0]!.id;
    expect((await api.order(po)).stage).toBe(3);

    // Past receiving now: another receipt is a 409 with the API's message.
    const late = await api.post("/receipts", await api.receiptBody(po, { "Men's jackets": 1 }));
    expect(late.status()).toBe(409);
    expect((await late.json()).error.message).toBe("This order is past receiving and can't take more receipts.");

    await page.goto("/calendar/list");
    await expect(page.getByRole("heading", { level: 1, name: "Delivery Calendar" })).toBeVisible();
    await expect(rowOf(page, po)).toHaveCount(0);
    await page.goto(`/calendar?month=${due.slice(0, 7)}`);
    await expect(page.getByRole("link", { name: po })).toHaveCount(0);
  });

  await test.step("the container sails and arrives; refused changes leave it as it is; the order stays at stage 3", async () => {
    const wang = await as(browser, LOADING_STAFF_STATE);
    await wang.goto("/containers");
    await wang.getByRole("searchbox", { name: "Search container or PO" }).fill(po);
    await rowOf(wang, number).getByRole("cell", { name: "Sino Freight" }).click();
    await expect(wang).toHaveURL(`/containers/${containerId}`);
    const header = wang.getByRole("banner");
    await expect(header.getByRole("button")).toHaveText(["Mark as sailed", "Change ETA"]);

    // Arriving before sailing is refused.
    const skip = await api.patch(`/containers/${containerId}`, { status: "arrived" });
    expect(skip.status()).toBe(409);
    expect((await skip.json()).error.message).toBe("Containers move from Loading to At sea to Arrived, in that order.");

    await header.getByRole("button", { name: "Mark as sailed" }).click();
    const sail = wang.getByRole("dialog", { name: "Mark as sailed" });
    await field(sail, "Sailing date").fill(today(1));
    await sail.getByRole("button", { name: "Mark as sailed" }).click();
    await expect(sail.getByText("The sailing date can't be after today.")).toBeVisible();
    const future = await api.patch(`/containers/${containerId}`, { status: "sea", sailedOn: today(1) });
    expect(future.status()).toBe(422);
    expect((await future.json()).error.fields).toEqual({ sailedOn: "The sailing date can't be after today." });
    await field(sail, "Sailing date").fill(today());
    await sail.getByRole("button", { name: "Mark as sailed" }).dblclick();
    await expect(toast(wang, "Container marked as sailed").first()).toBeVisible();
    await expect(header).toContainText("On the sea");

    await header.getByRole("button", { name: "Mark as arrived" }).click();
    await wang.getByRole("dialog", { name: "Mark as arrived" }).getByRole("button", { name: "Mark as arrived" }).click();
    await expect(toast(wang, "Container marked as arrived")).toBeVisible();
    await expect(header).toContainText("Arrived, in clearing");
    await expect(header.getByRole("button")).toHaveCount(0);
    await wang.close();

    // An arrived container can't change.
    const change = await api.patch(`/containers/${containerId}`, { eta: today(40) });
    expect(change.status()).toBe(409);
    expect((await change.json()).error.message).toBe("This container has arrived and can't be changed.");
    const saved = (await api.get<ContainerListItem[]>("/containers")).find((c) => c.id === containerId)!;
    expect(saved).toMatchObject({ status: "arrived", sailedOn: today(), eta: today(21) });

    const order = await api.order(po);
    expect(order.stage).toBe(3);
    expect(order.containers).toMatchObject([{ id: containerId, number, status: "arrived", sailedOn: today() }]);
  });

  /** Everything the order shows on the five tabs at the end, as Management sees it. */
  async function expectFinalState(viewer: Page) {
    await viewer.goto("/orders");
    await viewer.getByRole("searchbox", { name: "Search PO, item or supplier" }).fill(po);
    await expect(rowOf(viewer, po)).toContainText("3. Container loading");
    await expect(rowOf(viewer, po)).toContainText("₹18,250");

    await viewer.goto("/containers");
    await viewer.getByRole("searchbox", { name: "Search container or PO" }).fill(po);
    await expect(rowOf(viewer, number).getByRole("cell")).toHaveText([
      number, "Sino Freight", "FOB", po, "8", shortDate(today()), shortDate(today()), shortDate(today(21)), "Arrived, in clearing",
    ]);
    await rowOf(viewer, number).getByRole("link", { name: po }).click();
    await expect(viewer).toHaveURL(`/orders/${po}`);

    await tabs(viewer).getByRole("link", { name: "Containers" }).click();
    await expect(viewer.getByRole("heading", { name: `Container ${number}` })).toBeVisible();
    await expect(viewer.getByText(`Sailed ${shortDate(today())}`)).toBeVisible();
    await expect(kv(viewer, "Men's jackets")).toHaveText("100 pcs");
    await expect(kv(viewer, "Kids t-shirts")).toHaveText("200 pcs");
    await expect(kv(viewer, "Bundles")).toHaveText("8");
    await viewer.getByRole("link", { name: number }).click();
    await expect(viewer).toHaveURL(`/containers/${containerId}`);
    await expect(viewer.getByRole("banner")).toContainText("Arrived, in clearing");

    await expectMoney(viewer, "¥1,500", "₹18,250", "¥2,500", 2);
    await viewer.goto(`/orders/${po}/receiving`);
    await expect(kpi(viewer, "Received in China")).toContainText("100 pcs");
    await viewer.goto(`/orders/${po}`);
    await expect(viewer.getByText("Shenzhen Apparel · Contact: Ms. Liu Yan")).toBeVisible();
    await expect(kv(viewer, "Goods, paid ¥1,500")).toHaveText("₹18,250");
  }

  await test.step("everything is the same after a reload and after a fresh sign-in", async () => {
    await expectFinalState(page);
    await page.reload();
    await expect(kv(page, "Goods, paid ¥1,500")).toHaveText("₹18,250");

    const fresh = await as(browser, SIGNED_OUT);
    await fresh.goto("/login");
    await fresh.getByLabel("Email or username").fill("suresh@mrgarments.com");
    await fresh.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD ?? "");
    await fresh.getByRole("button", { name: "Sign in" }).click();
    await expect(fresh).toHaveURL("/");
    await expectFinalState(fresh);
    await fresh.close();
  });
});
