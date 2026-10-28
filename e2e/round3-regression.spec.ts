import type { APIRequestContext, Browser, BrowserContextOptions, Page } from "@playwright/test";

import type { ContainerListItem } from "../src/lib/api/types";
import { ANITA, type Api, containerNumber, expect, field, kpi, kv, longDate, settled, shortDate, signInState, test, toast, today } from "./live-api";
import { LOADING_STAFF_STATE, MANAGEMENT_STATE, PROCUREMENT_STATE, SIGNED_OUT, STAFF_STATE } from "./sessions";

// Round 3: independent regression over the five live tabs. Every test creates its own records through the API (or the
// UI where the mutation itself is under test) and finds them by PO or container number.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
test.use({ viewport: DESKTOP });

const as = async (browser: Browser, storageState: BrowserContextOptions["storageState"], viewport = DESKTOP) =>
  settled(await browser.newPage({ storageState, viewport }));
const rowOf = (page: Page, text: string) => page.getByRole("table").getByRole("row").filter({ hasText: text });
const cellsOf = async (page: Page, text: string) => (await rowOf(page, text).all()).map(async (r) => (await r.getByRole("cell").allTextContents()).map((c) => c.trim()));
const tabs = (page: Page) => page.getByRole("navigation", { name: "Order sections" });
const orderSearch = (page: Page) => page.getByRole("searchbox", { name: "Search PO, item or supplier" });
const poSearch = (page: Page) => page.getByRole("searchbox", { name: "Search PO or supplier" });
const containerSearch = (page: Page) => page.getByRole("searchbox", { name: "Search container or PO" });
const password = () => process.env.E2E_PASSWORD ?? "";

/** A PO with 2 lines (100 jackets @30, 200 t-shirts @5 = ¥4,000), a ¥1,000 deposit at 12, due in 5 days. */
async function makeOrder(api: Api, extra: { deliveryDate?: string } = {}) {
  return api.createOrder({
    supplier: "Shenzhen Apparel",
    lines: [
      { item: "Men's jackets", quantity: 100, rateCny: 30 },
      { item: "Kids t-shirts", quantity: 200, rateCny: 5 },
    ],
    deliveryDate: extra.deliveryDate ?? today(5),
    deposits: [{ amountCny: 1000, rateInr: 12 }],
  });
}

/** Order + receipt + container in loading status. */
async function makeFlow(api: Api) {
  const order = await makeOrder(api);
  await api.receive(order.po, { "Men's jackets": 100, "Kids t-shirts": 200 }, { shortRemark: "", bundles: 6 });
  const container = await api.load([
    { po: order.po, item: "Men's jackets", quantity: 100, bundles: 2 },
    { po: order.po, item: "Kids t-shirts", quantity: 200, bundles: 4 },
  ]);
  return { ...order, ...container };
}

async function apiAs(playwright: Parameters<typeof signInState>[0], baseURL: string | undefined, email: string): Promise<APIRequestContext> {
  const state = await signInState(playwright, baseURL, email);
  return playwright.request.newContext({ baseURL, storageState: state, extraHTTPHeaders: { Origin: baseURL ?? "" } });
}

const noHScroll = async (page: Page, where: string) => {
  const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(m.s, `${where}: page scrolls horizontally (${m.s} > ${m.w})`).toBeLessThanOrEqual(m.w);
};

// ---------------------------------------------------------------------------------------------------------------
// Journey: UI mutations with a reload after each, and the same figures on every tab.
// ---------------------------------------------------------------------------------------------------------------

type State = {
  stage: string;
  paid: string;
  paidInr: string;
  balance: string;
  payments: number;
  receipts: { cells: string[] }[]; // [thisReceipt, totalSoFar] per receipt
  receivedMain?: string; // "100 pcs"
  shortMain?: string;
  onCalendar: boolean;
  container?: { number: string; id: string; status: string; sailed: string; eta: string };
};

function pagesFor(po: string, due: string, s: State): [string, (page: Page) => Promise<void>][] {
  return [
    [
      "/orders",
      async (page) => {
        await orderSearch(page).fill(po);
        await expect(rowOf(page, po)).toContainText(s.stage);
        await expect(rowOf(page, po)).toContainText(s.paidInr);
        await expect(rowOf(page, po)).toContainText("Men's jackets");
      },
    ],
    [
      `/orders/${po}`,
      async (page) => {
        await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
        await expect(kv(page, `Goods, paid ${s.paid}`)).toHaveText(s.paidInr);
      },
    ],
    [
      `/orders/${po}/items`,
      async (page) => {
        await expect(page.getByRole("table").getByRole("row").filter({ hasText: "Kids t-shirts" })).toContainText("200");
        await expect(page.getByRole("table").getByRole("row").filter({ hasText: "Men's jackets" })).toContainText("100");
      },
    ],
    [
      `/orders/${po}/payments`,
      async (page) => {
        await expect(kpi(page, "Order value")).toContainText("¥4,000");
        await expect(kpi(page, "Paid so far")).toContainText(s.paid);
        await expect(kpi(page, "Paid so far")).toContainText(`${s.payments} payment`);
        await expect(kpi(page, "Balance to pay")).toContainText(s.balance);
        await expect(kv(page, "Goods cost in INR")).toHaveText(s.paidInr);
      },
    ],
    [
      `/orders/${po}/receiving`,
      async (page) => {
        if (s.receivedMain) {
          await expect(kpi(page, "Received in China")).toContainText(s.receivedMain);
          await expect(kpi(page, "Short")).toContainText(s.shortMain!);
        } else await expect(page.getByRole("heading", { level: 1, name: po })).toBeVisible();
      },
    ],
    [
      `/orders/${po}/containers`,
      async (page) => {
        if (s.container) {
          await expect(page.getByRole("heading", { name: `Container ${s.container.number}` })).toBeVisible();
          await expect(kv(page, "Men's jackets")).toHaveText("100 pcs");
        } else await expect(page.getByText("Not loaded into a container yet.")).toBeVisible();
      },
    ],
    [
      "/payments",
      async (page) => {
        await poSearch(page).fill(po);
        await expect(rowOf(page, po).getByRole("cell")).toHaveText([`${po}Shenzhen Apparel`, "4,000", s.paid.replace("¥", ""), s.paidInr, s.balance.replace("¥", ""), "Not yet due"]);
      },
    ],
    [
      "/calendar/list",
      async (page) => {
        if (s.onCalendar) await expect(rowOf(page, po)).toContainText(shortDate(due));
        else {
          await expect(page.getByRole("heading", { level: 1, name: "Delivery Calendar" })).toBeVisible();
          await expect(rowOf(page, po)).toHaveCount(0);
        }
      },
    ],
    [
      `/calendar?month=${due.slice(0, 7)}`,
      async (page) => {
        await expect(page.getByRole("heading", { level: 1, name: "Delivery Calendar" })).toBeVisible();
        await expect(page.getByRole("link", { name: po })).toHaveCount(s.onCalendar ? 1 : 0);
      },
    ],
    [
      "/receiving",
      async (page) => {
        await poSearch(page).fill(po);
        const got = (await Promise.all(await cellsOf(page, po))).map((c) => `${c[5]}|${c[6]}`).sort();
        expect(got).toEqual(s.receipts.map((r) => r.cells.join("|")).sort());
      },
    ],
    [
      "/containers",
      async (page) => {
        await containerSearch(page).fill(po);
        if (!s.container) return void (await expect(page.getByText(po)).toHaveCount(0));
        await expect(rowOf(page, s.container.number).getByRole("cell")).toHaveText([
          s.container.number, "Sino Freight", "FOB", po, "6", shortDate(today()), s.container.sailed, s.container.eta, s.container.status,
        ]);
      },
    ],
  ];
}

async function everywhere(page: Page, po: string, due: string, s: State, reload: boolean) {
  for (const [url, check] of pagesFor(po, due, s)) {
    await page.goto(url);
    if (reload) await page.reload();
    await check(page);
  }
}

test("journey by UI: place, pay, receive, load, sail, arrive; every tab agrees before and after each reload", async ({ page, api }) => {
  test.setTimeout(420_000);
  const due = today(5);
  let po = "";
  let s: State = { stage: "1. Order and deposit", paid: "¥1,000", paidInr: "₹12,000", balance: "¥3,000", payments: 1, receipts: [], onCalendar: true };

  await test.step("place the order (Orders), reload on the new page", async () => {
    await page.goto("/orders/new");
    po = await page.getByRole("textbox", { name: "Purchase order no." }).inputValue();
    await page.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: "Shenzhen Apparel" });
    await field(page, "Delivery date").fill(due);
    await page.getByRole("combobox", { name: "Item, line 1" }).selectOption({ label: "Men's jackets" });
    await page.getByRole("textbox", { name: "Rate (¥), line 1" }).fill("30");
    await page.getByRole("textbox", { name: "Quantity, line 1" }).fill("100");
    await page.getByRole("button", { name: "+ Add item" }).click();
    await page.getByRole("combobox", { name: "Item, line 2" }).selectOption({ label: "Kids t-shirts" });
    await page.getByRole("textbox", { name: "Rate (¥), line 2" }).fill("5");
    await page.getByRole("textbox", { name: "Quantity, line 2" }).fill("200");
    await page.getByRole("button", { name: "+ Add deposit" }).click();
    await page.getByRole("textbox", { name: "Amount (¥), deposit 1" }).fill("1000");
    await field(page, "Rate to INR").fill("12");
    await field(page, "Mode").fill("Bank transfer");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(toast(page, `Order ${po} placed`)).toBeVisible();
    await expect(page).toHaveURL(`/orders/${po}`);
    await page.reload();
    await expect(kv(page, "Goods, paid ¥1,000")).toHaveText("₹12,000");
    await everywhere(page, po, due, s, true);
  });

  await test.step("record a payment (Payments dialog), reload", async () => {
    await page.goto("/payments");
    await poSearch(page).fill(po);
    await rowOf(page, po).getByRole("button", { name: po }).click();
    await page.getByRole("button", { name: `+ Record payment for ${po}` }).click();
    const form = page.getByRole("dialog", { name: `Record payment for ${po}` });
    await form.getByRole("combobox", { name: "Kind" }).selectOption("Balance");
    await form.getByRole("textbox", { name: "Amount (¥)" }).fill("500");
    await form.getByRole("textbox", { name: "Rate (₹ per ¥)" }).fill("12.5");
    await form.getByRole("textbox", { name: "Mode" }).fill("Wire");
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(page, `Payment recorded for ${po}`).first()).toBeVisible();
    await expect(form).toBeHidden();
    s = { ...s, paid: "¥1,500", paidInr: "₹18,250", balance: "¥2,500", payments: 2 };
    await everywhere(page, po, due, s, false);
    await everywhere(page, po, due, s, true);
  });

  await test.step("save a short receipt (Receiving), reload", async () => {
    await page.goto("/receiving/new");
    await page.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: po });
    await page.getByRole("textbox", { name: "Bundles received now" }).fill("6");
    await page.getByRole("textbox", { name: "Received now, Men's jackets" }).fill("60");
    await page.getByRole("textbox", { name: "Received now, Kids t-shirts" }).fill("200");
    await page.getByRole("textbox", { name: "Short remark" }).fill("40 jackets to follow");
    await page.getByRole("button", { name: "Save receipt" }).click();
    await expect(page).toHaveURL("/receiving");
    s = { ...s, stage: "2. Receiving in China", receipts: [{ cells: ["60", "60"] }], receivedMain: "60 pcs", shortMain: "40 pcs" };
    await everywhere(page, po, due, s, false);
    await everywhere(page, po, due, s, true);
    await page.goto("/receiving/new");
    await page.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: po });
    await page.getByRole("textbox", { name: "Bundles received now" }).fill("2");
    await page.getByRole("textbox", { name: "Received now, Men's jackets" }).fill("40");
    await page.getByRole("button", { name: "Save receipt" }).click();
    await expect(page).toHaveURL("/receiving");
    s = { ...s, receipts: [...s.receipts, { cells: ["40", "100"] }], receivedMain: "100 pcs", shortMain: "0 pcs" };
    await everywhere(page, po, due, s, true);
  });

  const number = containerNumber();
  await test.step("load a container, reload; the order leaves the Calendar", async () => {
    await page.goto("/containers/new");
    await page.getByRole("textbox", { name: "Container number" }).fill(number);
    await page.getByRole("combobox", { name: "Shipping agent" }).selectOption({ label: "Sino Freight" });
    await field(page, "Expected arrival in India (ETA)").fill(today(21));
    await page.getByRole("textbox", { name: `Bundles, ${po} Men's jackets` }).fill("2");
    await page.getByRole("textbox", { name: `Quantity, ${po} Men's jackets` }).fill("100");
    await page.getByRole("textbox", { name: `Bundles, ${po} Kids t-shirts` }).fill("4");
    await page.getByRole("textbox", { name: `Quantity, ${po} Kids t-shirts` }).fill("200");
    await page.getByRole("button", { name: "Save container" }).click();
    await expect(page).toHaveURL("/containers");
    const saved = (await api.get<ContainerListItem[]>("/containers")).find((c) => c.number === number)!;
    s = {
      ...s,
      stage: "3. Container loading",
      onCalendar: false,
      container: { number, id: saved.id, status: "Loading", sailed: "–", eta: shortDate(today(21)) },
    };
    await everywhere(page, po, due, s, false);
    await everywhere(page, po, due, s, true);
  });

  await test.step("sail, reload the container page; arrive, reload", async () => {
    const id = s.container!.id;
    await page.goto(`/containers/${id}`);
    await page.getByRole("banner").getByRole("button", { name: "Mark as sailed" }).click();
    const d = page.getByRole("dialog", { name: "Mark as sailed" });
    await field(d, "Sailing date").fill(today());
    await d.getByRole("button", { name: "Mark as sailed" }).click();
    await expect(toast(page, "Container marked as sailed").first()).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("On the sea");
    await page.reload();
    await expect(page.getByRole("banner")).toContainText("On the sea");
    await expect(kv(page, "Sailed on")).toHaveText(longDate(today()));
    s = { ...s, container: { ...s.container!, status: "On the sea", sailed: shortDate(today()) } };
    await everywhere(page, po, due, s, true);

    await page.goto(`/containers/${id}`);
    await page.getByRole("banner").getByRole("button", { name: "Mark as arrived" }).click();
    await page.getByRole("dialog", { name: "Mark as arrived" }).getByRole("button", { name: "Mark as arrived" }).click();
    await expect(toast(page, "Container marked as arrived")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("banner")).toContainText("Arrived, in clearing");
    await expect(page.getByRole("banner").getByRole("button")).toHaveCount(0);
    s = { ...s, container: { ...s.container!, status: "Arrived, in clearing" } };
    await everywhere(page, po, due, s, true);
  });

  await test.step("a fresh sign-in as Management shows the same", async () => {
    const fresh = await as(page.context().browser()!, SIGNED_OUT);
    await fresh.goto("/login");
    await fresh.getByLabel("Email or username").fill("suresh@mrgarments.com");
    await fresh.getByLabel("Password", { exact: true }).fill(password());
    await fresh.getByRole("button", { name: "Sign in" }).click();
    await expect(fresh).toHaveURL("/");
    await everywhere(fresh, po, due, s, false);
    await fresh.close();
  });
});


// ---------------------------------------------------------------------------------------------------------------
// Re-login per role, and the deep-link round trip.
// ---------------------------------------------------------------------------------------------------------------

const ROLES = [
  { name: "Management", email: "suresh@mrgarments.com", menu: ["Orders", "Deposits & Payments", "Delivery Calendar", "Receiving (China)", "Containers"], pages: ["/orders", "/payments", "/calendar", "/receiving", "/containers"] },
  { name: "Procurement", email: "priya@mrgarments.com", menu: ["Orders", "Deposits & Payments", "Delivery Calendar", "Receiving (China)"], pages: ["/orders", "/payments", "/calendar", "/receiving"] },
  { name: "Accounts", email: "anita@mrgarments.com", menu: ["Orders", "Deposits & Payments"], pages: ["/orders", "/payments"] },
  { name: "China staff (Chen)", email: "chen@mrgarments.com", menu: ["Receiving (China)"], pages: ["/receiving"] },
  { name: "Loading staff (Wang)", email: "wang@mrgarments.com", menu: ["Receiving (China)", "Containers"], pages: ["/receiving", "/containers"] },
];
const ALL_PAGES = ["/orders", "/payments", "/calendar", "/receiving", "/containers"];
const MENU_LABEL: Record<string, string> = {
  "/orders": "Orders", "/payments": "Deposits & Payments", "/calendar": "Delivery Calendar", "/receiving": "Receiving (China)", "/containers": "Containers",
};

for (const role of ROLES) {
  test(`${role.name}: fresh sign-in, menu, direct URLs and figures`, async ({ browser, api }) => {
    test.setTimeout(120_000);
    const flow = await makeFlow(api);
    const page = await as(browser, SIGNED_OUT);
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(role.email);
    await page.getByLabel("Password", { exact: true }).fill(password());
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const path of ALL_PAGES) {
      const label = MENU_LABEL[path]!;
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(role.menu.includes(label) ? 1 : 0);
    }
    for (const path of ALL_PAGES) {
      await page.goto(path);
      if (role.pages.includes(path)) await expect(page).toHaveURL(path);
      else await expect(page, `${role.name} should not open ${path}`).not.toHaveURL(new RegExp(`${path}$`));
    }
    // Figures: whatever this role may see about the flow order is the same as Management saw.
    if (role.pages.includes("/orders")) {
      await page.goto("/orders");
      await orderSearch(page).fill(flow.po);
      await expect(rowOf(page, flow.po)).toContainText("₹12,000");
      await page.goto(`/orders/${flow.po}`);
      await expect(page.getByRole("heading", { level: 1, name: flow.po })).toBeVisible();
      await expect(kv(page, "Goods, paid ¥1,000")).toHaveText("₹12,000");
      // Sections the role can't view have no tab, and their URL says Not found.
      const hasTab = (label: string) => tabs(page).getByRole("link", { name: label });
      const want = { "Deposits & payments": role.pages.includes("/payments"), Receiving: role.pages.includes("/receiving"), Containers: role.pages.includes("/containers") };
      for (const [label, shown] of Object.entries(want)) await expect(hasTab(label)).toHaveCount(shown ? 1 : 0);
      for (const [seg, shown] of [["payments", want["Deposits & payments"]], ["receiving", want.Receiving], ["containers", want.Containers]] as const) {
        await page.goto(`/orders/${flow.po}/${seg}`);
        if (shown) await expect(page.getByText("Not found", { exact: true })).toHaveCount(0);
        else await expect(page.getByText("Not found", { exact: true })).toBeVisible();
      }
    }
    if (role.pages.includes("/payments")) {
      await page.goto("/payments");
      await poSearch(page).fill(flow.po);
      await expect(rowOf(page, flow.po).getByRole("cell").nth(3)).toHaveText("₹12,000");
    }
    if (role.pages.includes("/receiving")) {
      await page.goto("/receiving");
      await poSearch(page).fill(flow.po);
      await expect(rowOf(page, flow.po)).toContainText("Complete");
    }
    if (role.pages.includes("/containers")) {
      await page.goto("/containers");
      await containerSearch(page).fill(flow.number);
      await expect(rowOf(page, flow.number)).toContainText("Loading");
    }
    await page.close();
  });
}

test("a signed-out deep link goes to sign-in and (report) whether it returns to the link", async ({ browser, api }) => {
  const order = await makeOrder(api);
  const page = await as(browser, SIGNED_OUT);
  await page.goto(`/orders/${order.po}/payments`);
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email or username").fill("suresh@mrgarments.com");
  await page.getByLabel("Password", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  // Observed behaviour is annotated rather than asserted: the app need not support return-to-link.
  test.info().annotations.push({ type: "return-to-link", description: `landed on ${new URL(page.url()).pathname}` });
  await page.goto(`/orders/${order.po}/payments`);
  await expect(kpi(page, "Order value")).toContainText("¥4,000");
  await page.close();
});

test("signing out from an order page ends the session; Back and deep links ask for sign-in", async ({ browser, api }) => {
  const order = await makeOrder(api);
  const page = await as(browser, SIGNED_OUT);
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("suresh@mrgarments.com");
  await page.getByLabel("Password", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(`/orders/${order.po}`);
  await page.getByRole("button", { name: /Suresh Menon/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: order.po })).toHaveCount(0);
  for (const path of [`/orders/${order.po}`, "/payments", "/calendar", "/receiving", "/containers", "/containers/new", "/orders/new"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login/);
  }
  await page.close();
});

// ---------------------------------------------------------------------------------------------------------------
// Navigation.
// ---------------------------------------------------------------------------------------------------------------

test("back/forward across list, detail, tab and container; breadcrumbs", async ({ page, api }) => {
  const f = await makeFlow(api);
  await page.goto("/orders");
  await orderSearch(page).fill(f.po);
  await rowOf(page, f.po).getByRole("link", { name: f.po }).click();
  await expect(page).toHaveURL(`/orders/${f.po}`);
  await tabs(page).getByRole("link", { name: "Containers" }).click();
  await expect(page).toHaveURL(`/orders/${f.po}/containers`);
  await page.getByRole("link", { name: f.number }).click();
  await expect(page).toHaveURL(`/containers/${f.id}`);
  await expect(page.getByRole("heading", { level: 1, name: f.number })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(`/orders/${f.po}/containers`);
  await expect(page.getByRole("heading", { name: `Container ${f.number}` })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(`/orders/${f.po}`);
  await expect(kv(page, "Goods, paid ¥1,000")).toHaveText("₹12,000");
  await page.goBack();
  await expect(page).toHaveURL("/orders");
  await page.goForward();
  await expect(page).toHaveURL(`/orders/${f.po}`);
  await page.goForward();
  await page.goForward();
  await expect(page).toHaveURL(`/containers/${f.id}`);
  await expect(page.getByRole("banner")).toContainText("Loading");

  // Breadcrumbs.
  await page.getByRole("link", { name: "Containers", exact: true }).first().click();
  await expect(page).toHaveURL("/containers");
  await page.goto(`/orders/${f.po}/payments`);
  await page.getByRole("banner").getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL("/orders");
});

test("PO links from Payments, Calendar (month, week, list), Receiving and Containers land on the right order; container links on the right container", async ({ page, api }) => {
  const due = today(6);
  const f = await makeOrder(api, { deliveryDate: due });
  const other = await makeOrder(api, { deliveryDate: due });
  const received = await api.receive(f.po, { "Men's jackets": 100, "Kids t-shirts": 100 }, { shortRemark: "rest to follow" });
  expect(received.receipt.id).toBeTruthy();
  const monday = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - ((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);

  // Payments: the row selects the order, the card heading links to it.
  await page.goto("/payments");
  await poSearch(page).fill(f.po);
  await rowOf(page, f.po).getByRole("button", { name: f.po }).click();
  await page.getByRole("heading", { name: `${f.po} payments` }).getByRole("link", { name: f.po }).click();
  await expect(page).toHaveURL(`/orders/${f.po}`);

  for (const url of [`/calendar?month=${due.slice(0, 7)}`, `/calendar/week?week=${monday(due)}`, `/calendar/list?range=next-30&supplier=Shenzhen+Apparel`]) {
    await page.goto(url);
    await page.getByRole("link", { name: other.po, exact: true }).click();
    await expect(page, url).toHaveURL(`/orders/${other.po}`);
    await expect(page.getByRole("heading", { level: 1, name: other.po })).toBeVisible();
  }

  await page.goto("/receiving");
  await poSearch(page).fill(f.po);
  await rowOf(page, f.po).getByRole("link", { name: f.po }).click();
  await expect(page).toHaveURL(`/orders/${f.po}`);

  const full = await makeFlow(api);
  await page.goto("/containers");
  await containerSearch(page).fill(full.po);
  await rowOf(page, full.number).getByRole("link", { name: full.po }).click();
  await expect(page).toHaveURL(`/orders/${full.po}`);
  await page.goto("/containers");
  await containerSearch(page).fill(full.number);
  await rowOf(page, full.number).getByRole("link", { name: full.number }).click();
  await expect(page).toHaveURL(`/containers/${full.id}`);
  await expect(page.getByRole("heading", { level: 1, name: full.number })).toBeVisible();
  await page.getByRole("table").getByRole("link", { name: full.po }).first().click();
  await expect(page).toHaveURL(`/orders/${full.po}`);
});

test("filtered Calendar URLs and every order tab survive a reload", async ({ page, api }) => {
  test.setTimeout(150_000);
  const due = `${2060 + Math.floor(Math.random() * 30)}-05-14`;
  const o = await makeOrder(api, { deliveryDate: due });
  const monday = new Date(Date.parse(`${due}T00:00:00Z`) - ((new Date(`${due}T00:00:00Z`).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  for (const url of [`/calendar?month=${due.slice(0, 7)}&supplier=Shenzhen+Apparel`, `/calendar/week?week=${monday}&supplier=Shenzhen+Apparel`, `/calendar/list?supplier=Shenzhen+Apparel`]) {
    await page.goto(url);
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("link", { name: o.po })).toBeVisible();
    await expect(page.getByRole("button", { name: "Supplier: Shenzhen Apparel" })).toBeVisible();
  }
  for (const seg of ["", "/items", "/payments", "/receiving", "/containers"]) {
    await page.goto(`/orders/${o.po}${seg}`);
    await page.reload();
    await expect(page).toHaveURL(`/orders/${o.po}${seg}`);
    await expect(page.getByRole("heading", { level: 1, name: o.po })).toBeVisible();
  }
  for (const bad of ["/orders/PO-99999999", "/orders/abc", "/containers/00000000-0000-4000-8000-000000000000", "/containers/not-an-id"]) {
    await page.goto(bad);
    await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  }
  for (const hidden of ["clearing-transport", "warehouse", "cost", "history"]) {
    await page.goto(`/orders/${o.po}/${hidden}`);
    await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Authorization at the API.
// ---------------------------------------------------------------------------------------------------------------

test("the API refuses what each role may not do, with no inherited cookies", async ({ playwright, baseURL, api }) => {
  test.setTimeout(120_000);
  const f = await makeFlow(api);
  // can: [orders write, payments write, receiving write, containers write] and reads [orders, payments, calendar, receiving, containers]
  const matrix = [
    { email: "suresh@mrgarments.com", w: [1, 1, 1, 1], r: [1, 1, 1, 1, 1] },
    { email: "priya@mrgarments.com", w: [1, 0, 0, 0], r: [1, 1, 1, 1, 0] },
    { email: "anita@mrgarments.com", w: [0, 1, 0, 0], r: [1, 1, 0, 0, 0] },
    { email: "chen@mrgarments.com", w: [0, 0, 1, 0], r: [0, 0, 0, 1, 0] },
    { email: "wang@mrgarments.com", w: [0, 0, 1, 1], r: [0, 0, 0, 1, 1] },
  ];
  const anon = await playwright.request.newContext({ baseURL, storageState: SIGNED_OUT, extraHTTPHeaders: { Origin: baseURL ?? "" } });
  for (const [m, p] of [["GET", "/orders"], ["POST", "/orders"], ["POST", "/payments"], ["POST", "/receipts"], ["POST", "/containers"], ["PATCH", `/containers/${f.id}`], ["GET", `/orders/${f.po}`]] as const) {
    const r = await anon.fetch(`/api/v1${p}`, { method: m, data: m === "GET" ? undefined : {} });
    expect(r.status(), `anonymous ${m} ${p}`).toBe(401);
  }
  await anon.dispose();

  for (const role of matrix) {
    const ctx = await apiAs(playwright, baseURL, role.email);
    const reads = [`/orders`, `/payments`, `/deliveries`, `/receipts`, `/containers`];
    for (const [i, path] of reads.entries()) {
      const r = await ctx.get(`/api/v1${path}`);
      expect(r.status(), `${role.email} GET ${path}`).toBe(role.r[i] ? 200 : 403);
    }
    const detail = await ctx.get(`/api/v1/orders/${f.po}`);
    expect(detail.status(), `${role.email} GET /orders/:po`).toBe(role.r[0] ? 200 : 403);
    if (role.r[0]) {
      const body = await detail.json();
      expect(body.payments === null, `${role.email} payments section`).toBe(!role.r[1]);
      expect(body.receipts === null, `${role.email} receipts section`).toBe(!role.r[3]);
      expect(body.containers === null, `${role.email} containers section`).toBe(!role.r[4]);
    }
    expect((await ctx.get(`/api/v1/containers/${f.id}`)).status(), `${role.email} GET /containers/:id`).toBe(role.r[4] ? 200 : 403);
    // Writes: an empty body is 422/400 when permitted, 403 when not. Nothing is created either way.
    const writes: [string, string, number][] = [["POST", "/orders", 0], ["POST", "/payments", 1], ["POST", "/receipts", 2], ["POST", "/containers", 3], ["PATCH", `/containers/${f.id}`, 3]];
    for (const [method, path, idx] of writes) {
      const r = await ctx.fetch(`/api/v1${path}`, { method, data: {} });
      if (role.w[idx]) expect([400, 422], `${role.email} ${method} ${path}`).toContain(r.status());
      else expect(r.status(), `${role.email} ${method} ${path}`).toBe(403);
    }
    // And a real, valid-looking mutation by a forbidden role changes nothing.
    if (!role.w[1]) {
      const order = await api.order(f.po);
      const r = await ctx.post("/api/v1/payments", { data: { orderId: order.id, kind: "Balance", payeeRole: "supplier", agentId: null, amountCny: 1, paidOn: today(), rateInr: 12, mode: "x" } });
      expect(r.status()).toBe(403);
      expect((await api.order(f.po)).payments).toHaveLength(1);
    }
    if (!role.w[3]) {
      const r = await ctx.patch(`/api/v1/containers/${f.id}`, { data: { eta: today(40) } });
      expect(r.status()).toBe(403);
      expect((await api.get<ContainerListItem[]>("/containers")).find((c) => c.id === f.id)!.eta).toBe(today(20));
    }
    await ctx.dispose();
  }
});

test("UI hides the actions the role may not take", async ({ browser, api, playwright, baseURL }) => {
  const f = await makeFlow(api);
  const priya = await as(browser, PROCUREMENT_STATE);
  await priya.goto("/payments");
  await poSearch(priya).fill(f.po);
  await rowOf(priya, f.po).getByRole("button", { name: f.po }).click();
  await expect(priya.getByRole("button", { name: /Record payment/ })).toHaveCount(0);
  await priya.goto("/receiving");
  await expect(priya.getByRole("link", { name: "+ Record receipt" })).toHaveCount(0);
  await priya.goto("/receiving/new");
  await expect(priya.getByText("You don't have access to do that.")).toBeVisible();
  await expect(priya.getByRole("button", { name: "Save receipt" })).toHaveCount(0);
  await priya.goto("/orders");
  await expect(priya.getByRole("link", { name: "+ New order" })).toBeVisible();
  await priya.close();

  const anita = await as(browser, await signInState(playwright, baseURL, ANITA));
  await anita.goto("/orders");
  await expect(anita.getByRole("link", { name: "+ New order" })).toHaveCount(0);
  await anita.goto("/orders/new");
  await expect(anita.getByRole("button", { name: "Place order" })).toHaveCount(0);
  await anita.goto("/payments");
  await poSearch(anita).fill(f.po);
  await rowOf(anita, f.po).getByRole("button", { name: f.po }).click();
  await expect(anita.getByRole("button", { name: `+ Record payment for ${f.po}` })).toBeVisible();
  await anita.close();

  const wang = await as(browser, LOADING_STAFF_STATE);
  await wang.goto(`/containers/${f.id}`);
  await expect(wang.getByRole("banner").getByRole("button")).toHaveText(["Mark as sailed", "Change ETA"]);
  await wang.close();

  const chen = await as(browser, STAFF_STATE);
  await chen.goto(`/containers/${f.id}`);
  await expect(chen).not.toHaveURL(`/containers/${f.id}`);
  await chen.goto("/containers/new");
  await expect(chen).not.toHaveURL("/containers/new");
  await chen.close();
});

// ---------------------------------------------------------------------------------------------------------------
// Responsive, 390 x 844.
// ---------------------------------------------------------------------------------------------------------------

test("390x844: every page and dialog of the five tabs fits without page-level horizontal scroll", async ({ browser, api }) => {
  test.setTimeout(240_000);
  const f = await makeFlow(api);
  const fresh = await makeOrder(api);
  const page = await as(browser, MANAGEMENT_STATE, PHONE);
  const urls = [
    "/orders", "/orders/new", `/orders/${f.po}`, `/orders/${f.po}/items`, `/orders/${f.po}/payments`, `/orders/${f.po}/receiving`, `/orders/${f.po}/containers`,
    "/payments", "/calendar", "/calendar/week", "/calendar/list", "/receiving", "/receiving/new", "/containers", "/containers/new", `/containers/${f.id}`,
  ];
  for (const url of urls) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await noHScroll(page, url);
  }
  // Primary buttons of the forms are reachable.
  for (const [url, name] of [["/orders/new", "Place order"], ["/receiving/new", "Save receipt"], ["/containers/new", "Save container"]] as const) {
    await page.goto(url);
    const b = page.getByRole("button", { name });
    await b.scrollIntoViewIfNeeded();
    await expect(b).toBeVisible();
    const box = (await b.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${name} fits`).toBeLessThanOrEqual(PHONE.width);
  }
  // Dialogs.
  const dialogFits = async (d: ReturnType<Page["getByRole"]>, primary: string, where: string) => {
    await expect(d).toBeVisible();
    const box = (await d.boundingBox())!;
    expect(box.x, where).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, where).toBeLessThanOrEqual(PHONE.width + 1);
    const b = d.getByRole("button", { name: primary });
    await b.scrollIntoViewIfNeeded();
    await expect(b, where).toBeVisible();
    const bb = (await b.boundingBox())!;
    expect(bb.x + bb.width, where).toBeLessThanOrEqual(PHONE.width);
    await noHScroll(page, where);
  };
  await page.goto("/payments");
  // The search box is hidden below 640px (reported), so pick the order from the list.
  await rowOf(page, fresh.po).getByRole("button", { name: fresh.po }).click();
  await page.getByRole("button", { name: `+ Record payment for ${fresh.po}` }).click();
  await dialogFits(page.getByRole("dialog", { name: `Record payment for ${fresh.po}` }), "Record payment", "payment dialog");
  await page.keyboard.press("Escape");
  await page.goto(`/containers/${f.id}`);
  for (const [open, title, primary] of [["Change ETA", "Change ETA", "Save ETA"], ["Mark as sailed", "Mark as sailed", "Mark as sailed"]] as const) {
    await page.getByRole("button", { name: open }).filter({ visible: true }).click(); // below md the buttons sit under the header
    await dialogFits(page.getByRole("dialog", { name: title }), primary, `${title} dialog`);
    await page.keyboard.press("Escape");
  }
  await page.close();
});

// ---------------------------------------------------------------------------------------------------------------
// API failures on every client-side mutation. (There are no client-side data fetches in these tabs: every list and
// detail is read on the server, so page.route cannot reach them.)
// ---------------------------------------------------------------------------------------------------------------

const failWith = async (page: Page, pattern: string, method: string, mode: 500 | 403 | "abort") => {
  await page.route(pattern, (route) => {
    if (route.request().method() !== method) return route.fallback();
    return mode === "abort" ? route.abort() : route.fulfill({ status: mode, json: { error: { code: mode === 500 ? "internal" : "forbidden", message: "x" } } });
  });
};

test("new order: 500, aborted and 403 requests show a message, keep the values and create nothing; retry saves one", async ({ page, api }) => {
  const before = (await api.options()).nextPo;
  await page.goto("/orders/new");
  await page.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: "Foshan Fabrics" });
  await field(page, "Delivery date").fill(today(10));
  await page.getByRole("combobox", { name: "Item, line 1" }).selectOption({ label: "Denim jeans" });
  await page.getByRole("textbox", { name: "Rate (¥), line 1" }).fill("12");
  await page.getByRole("textbox", { name: "Quantity, line 1" }).fill("77");
  for (const mode of [500, "abort", 403] as const) {
    await failWith(page, "**/api/v1/orders", "POST", mode);
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(toast(page, mode === 403 ? "You don't have access to do that." : "Something went wrong.").first()).toBeVisible();
    await page.unroute("**/api/v1/orders");
    await expect(page).toHaveURL("/orders/new");
    await expect(page.getByRole("textbox", { name: "Quantity, line 1" })).toHaveValue("77");
    await expect(page.getByRole("textbox", { name: "Rate (¥), line 1" })).toHaveValue("12");
    expect((await api.options()).nextPo, `${mode} created an order`).toBe(before);
  }
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${before}$`));
});

test("payment, receipt and container forms: 500, aborted and 401 keep the values and create nothing", async ({ page, api, browser }) => {
  test.setTimeout(180_000);
  const order = await makeOrder(api);
  const paymentCount = async () => (await api.order(order.po)).payments!.length;

  // Payment.
  await page.goto("/payments");
  await poSearch(page).fill(order.po);
  await rowOf(page, order.po).getByRole("button", { name: order.po }).click();
  await page.getByRole("button", { name: `+ Record payment for ${order.po}` }).click();
  const form = page.getByRole("dialog", { name: `Record payment for ${order.po}` });
  await form.getByRole("combobox", { name: "Kind" }).selectOption("Balance");
  await form.getByRole("textbox", { name: "Amount (¥)" }).fill("250");
  await form.getByRole("textbox", { name: "Rate (₹ per ¥)" }).fill("12");
  await form.getByRole("textbox", { name: "Mode" }).fill("Cheque");
  for (const mode of [500, "abort", 403] as const) {
    await failWith(page, "**/api/v1/payments", "POST", mode);
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(page, mode === 403 ? "You don't have access to do that." : "Something went wrong.").first()).toBeVisible();
    await page.unroute("**/api/v1/payments");
    await expect(form).toBeVisible();
    await expect(form.getByRole("textbox", { name: "Amount (¥)" })).toHaveValue("250");
    await expect(form.getByRole("textbox", { name: "Mode" })).toHaveValue("Cheque");
    expect(await paymentCount()).toBe(1);
  }
  // Escape closes and the next opening is empty.
  await page.keyboard.press("Escape");
  await expect(form).toBeHidden();

  // Receipt.
  await page.goto("/receiving/new");
  await page.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: order.po });
  await page.getByRole("textbox", { name: "Bundles received now" }).fill("3");
  await page.getByRole("textbox", { name: "Received now, Men's jackets" }).fill("100");
  await page.getByRole("textbox", { name: "Received now, Kids t-shirts" }).fill("200");
  for (const mode of [500, "abort"] as const) {
    await failWith(page, "**/api/v1/receipts", "POST", mode);
    await page.getByRole("button", { name: "Save receipt" }).click();
    await expect(toast(page, "Something went wrong.").first()).toBeVisible();
    await page.unroute("**/api/v1/receipts");
    await expect(page).toHaveURL("/receiving/new");
    await expect(page.getByRole("textbox", { name: "Received now, Men's jackets" })).toHaveValue("100");
    expect((await api.order(order.po)).receipts).toHaveLength(0);
  }
  await page.getByRole("button", { name: "Save receipt" }).click();
  await expect(page).toHaveURL("/receiving");
  expect((await api.order(order.po)).receipts).toHaveLength(1);

  // Container load.
  const number = containerNumber();
  await page.goto("/containers/new");
  await page.getByRole("textbox", { name: "Container number" }).fill(number);
  await page.getByRole("combobox", { name: "Shipping agent" }).selectOption({ label: "Sino Freight" });
  await field(page, "Expected arrival in India (ETA)").fill(today(21));
  await page.getByRole("textbox", { name: `Bundles, ${order.po} Men's jackets` }).fill("1");
  await page.getByRole("textbox", { name: `Quantity, ${order.po} Men's jackets` }).fill("100");
  const count = async () => (await api.get<ContainerListItem[]>("/containers")).filter((c) => c.number === number).length;
  for (const mode of [500, "abort"] as const) {
    await failWith(page, "**/api/v1/containers", "POST", mode);
    await page.getByRole("button", { name: "Save container" }).click();
    await expect(toast(page, "Something went wrong.").first()).toBeVisible();
    await page.unroute("**/api/v1/containers");
    await expect(page.getByRole("textbox", { name: "Container number" })).toHaveValue(number);
    expect(await count()).toBe(0);
  }
  await page.getByRole("button", { name: "Save container" }).click();
  await expect(page).toHaveURL("/containers");
  expect(await count()).toBe(1);

  // 401 on a mutation: back to sign-in with the session-ended message. Own session so Management's survives.
  const other = await as(browser, SIGNED_OUT);
  await other.goto("/login");
  await other.getByLabel("Email or username").fill("suresh@mrgarments.com");
  await other.getByLabel("Password", { exact: true }).fill(password());
  await other.getByRole("button", { name: "Sign in" }).click();
  await other.waitForURL((u) => !u.pathname.startsWith("/login"));
  await other.goto("/orders/new");
  await other.getByRole("combobox", { name: "Supplier", exact: true }).selectOption({ label: "Foshan Fabrics" });
  await field(other, "Delivery date").fill(today(10));
  await other.getByRole("combobox", { name: "Item, line 1" }).selectOption({ label: "Denim jeans" });
  await other.getByRole("textbox", { name: "Rate (¥), line 1" }).fill("12");
  await other.getByRole("textbox", { name: "Quantity, line 1" }).fill("5");
  await other.route("**/api/v1/orders", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 401, json: { error: { code: "unauthorized", message: "x" } } }) : route.fallback()));
  const redirect = other.waitForRequest((r) => r.url().includes("/login?reason=session-ended"));
  await other.getByRole("button", { name: "Place order" }).click();
  await redirect;
  await other.close();
});

test("container page: 500, aborted, 403 and 409 on status changes keep the dialog and the container unchanged", async ({ page, api }) => {
  test.setTimeout(90_000);
  const f = await makeFlow(api);
  const state = async () => (await api.get<ContainerListItem[]>("/containers")).find((c) => c.id === f.id)!;
  await page.goto(`/containers/${f.id}`);
  const header = page.getByRole("banner");
  await header.getByRole("button", { name: "Change ETA" }).click();
  const d = page.getByRole("dialog", { name: "Change ETA" });
  await field(d, "Expected arrival in India (ETA)").fill(today(33));
  for (const mode of [500, "abort", 403] as const) {
    await failWith(page, `**/api/v1/containers/${f.id}`, "PATCH", mode);
    await d.getByRole("button", { name: "Save ETA" }).click();
    await expect(toast(page, mode === 403 ? "You don't have access to do that." : "Something went wrong.").first()).toBeVisible();
    await page.unroute(`**/api/v1/containers/${f.id}`);
    await expect(d).toBeVisible();
    await expect(field(d, "Expected arrival in India (ETA)")).toHaveValue(today(33));
    expect((await state()).eta).toBe(today(20));
  }
  await d.getByRole("button", { name: "Save ETA" }).click();
  await expect(toast(page, "ETA saved").first()).toBeVisible();
  expect((await state()).eta).toBe(today(33));

  // Someone else sails it in the meantime: this page is stale. The 409 must be shown, and the page must catch up.
  await api.updateContainer(f.id, { status: "sea", sailedOn: today() });
  await header.getByRole("button", { name: "Mark as sailed" }).click();
  const s = page.getByRole("dialog", { name: "Mark as sailed" });
  await field(s, "Sailing date").fill(today());
  await s.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(toast(page, "Containers move from Loading to At sea to Arrived, in that order.").first()).toBeVisible();
  // The dialog closes and the page catches up with the real state.
  await expect(s).toBeHidden();
  await expect(header).toContainText("On the sea");
  await expect(header.getByRole("button", { name: "Mark as sailed" })).toHaveCount(0);
});
