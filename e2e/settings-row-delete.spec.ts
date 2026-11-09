import type { Page } from "@playwright/test";

import { type Api, expect, test, toast } from "./live-api";
import { ACCOUNTS_STATE, PROCUREMENT_STATE } from "./sessions";

// The red Delete on every Settings table row (next to Edit), against the live API's test database. Role/label locators
// only (hidden <Activity> routes stay in the DOM). Each test adds its own records.

const TABS = [
  { tab: "/settings/suppliers", api: "/suppliers", key: "supplier", noun: "supplier", body: {} },
  { tab: "/settings/shipping-agents", api: "/shipping-agents", key: "shippingAgent", noun: "shipping agent", body: {} },
  { tab: "/settings/clearing-agents", api: "/clearing-agents", key: "clearingAgent", noun: "clearing agent", body: {} },
  { tab: "/settings/transport-companies", api: "/transport-companies", key: "transportCompany", noun: "transport company", body: {} },
  { tab: "/settings/offices", api: "/locations", key: "location", noun: "office or warehouse", body: { type: "Warehouse" } },
  { tab: "/settings/teams", api: "/teams", key: "team", noun: "team", body: {} },
  { tab: "/settings/items", api: "/items", key: "item", noun: "item", body: { countedIn: "Pieces", price: 10 } },
  { tab: "/settings/units", api: "/units", key: "unit", noun: "unit", body: {} },
] as const;
type Tab = (typeof TABS)[number];

const unique = (label: string) => `E2E ${label} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
async function add(api: Api, tab: Tab, name: string) {
  const res = await api.post(tab.api, { ...tab.body, name });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json())[tab.key].id as string;
}
const ids = async (api: Api, tab: Tab) => (await api.get<{ id: string }[]>(tab.api)).map((row) => row.id);
async function open(page: Page, tab: string, name: string) {
  await page.goto(tab);
  await page.getByRole("searchbox", { name: "Search by name or phone" }).fill(name);
  return page.getByRole("table").getByRole("row").filter({ hasText: name });
}
function deletesOf(page: Page) {
  const deletes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") deletes.push(new URL(request.url()).pathname);
  });
  return deletes;
}
const capitalised = (noun: string) => `${noun[0]!.toUpperCase()}${noun.slice(1)}`;
// Leave nothing behind: other Settings specs count the rows under each status chip.
const deleteRecord = async (api: Api, tab: Tab, id: string) => expect((await api.request.delete(`/api/v1${tab.api}/${id}`, { data: {} })).status()).toBe(204);
const deleteRecord204 = async (api: Api, path: string) => expect((await api.request.delete(`/api/v1${path}`, { data: {} })).status(), path).toBe(204);
/** Removes an order the test made, its payments first (PAY-3, then ORD-6), so its supplier or agent can go too. */
async function removeOrder(api: Api, po: string) {
  for (const payment of (await api.order(po)).payments ?? []) await deleteRecord204(api, `/payments/${payment.id}`);
  await deleteRecord204(api, `/orders/${encodeURIComponent(po)}`);
}

test.describe("Management", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("every tab: Delete sits next to Edit, Escape sends nothing, a double-click deletes once and the row goes", async ({ page, api }) => {
    test.setTimeout(120_000);
    const deletes = deletesOf(page);
    for (const tab of TABS) {
      const name = unique(tab.key);
      const id = await add(api, tab, name);
      const row = await open(page, tab.tab, name);
      // Edit and Delete end the actions cell; Suppliers puts its Deposits link before them (phase 2).
      await expect(row.getByRole("cell").last()).toHaveText(/EditDelete$/);
      const ask = page.getByRole("alertdialog", { name: `Delete ${tab.noun}?` });

      await row.getByRole("button", { name: `Delete ${name}` }).click();
      await expect(ask).toContainText(`Type${capitalised(tab.noun)}Name${name}Reference${id}`);
      await expect(ask).toContainText("If it is used by any");
      await page.keyboard.press("Escape");
      await expect(ask).toBeHidden();
      expect(deletes, tab.key).toEqual([]);

      await row.getByRole("button", { name: `Delete ${name}` }).click();
      await ask.getByRole("button", { name: `Delete ${tab.noun}` }).dblclick();
      await expect(toast(page, `${capitalised(tab.noun)} deleted`).first()).toBeVisible();
      await expect(row).toHaveCount(0);
      expect(deletes, tab.key).toEqual([`/api/v1${tab.api}/${id}`]);
      expect(await ids(api, tab)).not.toContain(id);
      deletes.length = 0;
    }
  });

  test("a supplier with an order is refused with what uses it, and Deactivate instead is offered; Cancel keeps it", async ({ page, api }) => {
    const supplier = TABS[0];
    const name = unique("busy supplier");
    const id = await add(api, supplier, name);
    const { po } = await api.createOrder({ supplier: name });
    const row = await open(page, supplier.tab, name);
    await row.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("alertdialog", { name: "Delete supplier?" }).getByRole("button", { name: "Delete supplier" }).click();
    const instead = page.getByRole("alertdialog", { name: "Deactivate supplier instead?" });
    await expect(instead).toContainText("This supplier is used by 1 order, so it can't be deleted.");
    await instead.getByRole("button", { name: "Cancel" }).click();
    await expect(instead).toBeHidden();
    await expect(row).toContainText("Active");
    expect(await ids(api, supplier)).toContain(id);
    await removeOrder(api, po);
    await deleteRecord(api, supplier, id);
  });

  test("a paid shipping agent keeps its name, so its payments still block its delete", async ({ page, api }) => {
    const agents = TABS[1];
    const name = unique("paid agent");
    const id = await add(api, agents, name);
    const { po } = await api.createOrder({ deposits: [{ amountCny: 100, rateInr: 12, payee: name, payeeRole: "agent" }] });
    const row = await open(page, agents.tab, name);
    await row.getByRole("link", { name: `Edit ${name}` }).click();
    const edit = page.getByRole("dialog", { name: "Edit shipping agent" });
    await edit.getByRole("textbox", { name: "Shipping agent name" }).fill(`${name} renamed`);
    await edit.getByRole("button", { name: "Save shipping agent" }).click();
    await expect(edit).toContainText("1 payment is recorded under this name, so it can't change.");
    await edit.getByRole("button", { name: "Cancel" }).click();
    await expect(edit).toBeHidden();

    await row.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("alertdialog", { name: "Delete shipping agent?" }).getByRole("button", { name: "Delete shipping agent" }).click();
    await expect(page.getByRole("alertdialog", { name: "Deactivate shipping agent instead?" })).toContainText(
      "This shipping agent is used by 1 agent payment, so it can't be deleted.",
    );
    await page.keyboard.press("Escape");
    await removeOrder(api, po);
    await deleteRecord(api, agents, id);
  });

  test("on a phone, Delete stays in view and the confirmation fits", async ({ page, api }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const supplier = TABS[0];
    const name = unique("phone supplier");
    const id = await add(api, supplier, name);
    const row = await open(page, supplier.tab, name);
    const button = row.getByRole("button", { name: `Delete ${name}` });
    await expect(button).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await button.click();
    const ask = page.getByRole("alertdialog", { name: "Delete supplier?" });
    await expect(ask.getByRole("button", { name: "Delete supplier" })).toBeInViewport();
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(ask).toBeHidden();
    await deleteRecord(api, supplier, id);
  });
});

for (const [role, state] of [
  ["Procurement", PROCUREMENT_STATE],
  ["Accounts", ACCOUNTS_STATE],
] as const) {
  test.describe(role, () => {
    test.use({ storageState: state, viewport: { width: 1440, height: 900 } });

    test("can't open Settings, and the API refuses the delete", async ({ page, api, baseURL }) => {
      const supplier = TABS[0];
      const id = await add(api, supplier, unique(`${role} supplier`));
      await page.goto(supplier.tab);
      await expect(page).not.toHaveURL(/\/settings/);
      await expect(page.getByRole("button", { name: /^Delete E2E/ })).toHaveCount(0);
      // Sent as the app sends it (Origin and JSON), so the same-site check passes and the API decides.
      const res = await page.request.delete(`/api/v1${supplier.api}/${id}`, { headers: { Origin: baseURL ?? "" }, data: {} });
      expect([res.status(), (await res.json()).error.code]).toEqual([403, "forbidden"]);
      expect(await ids(api, supplier)).toContain(id);
      await deleteRecord(api, supplier, id);
    });
  });
}
