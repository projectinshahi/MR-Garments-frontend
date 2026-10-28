import type { Locator, Page } from "@playwright/test";

import type { ContainerListItem } from "../src/lib/api/types";
import { ANITA, type Api, containerNumber, expect, field, freshSignIn, kpi, kv, longDate, settled, shortDate, test, toast, today } from "./live-api";
import { LOADING_STAFF_STATE, MANAGEMENT_STATE, PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Containers: list (24) from CON-1, Load container (23) through CON-2/CON-3, and the container page (CON-4) with its
// status and date actions (CON-5). Container numbers are TEST + 7 random digits. Role/label locators only.

test.use({ viewport: { width: 1440, height: 900 } });

const search = (page: Page) => page.getByRole("searchbox", { name: "Search container or PO" });
const rowOf = (page: Page, text: string) => page.getByRole("table").getByRole("row").filter({ hasText: text });
const chips = (page: Page) => page.getByRole("group", { name: "Container status" });
const saveContainer = (page: Page) => page.getByRole("button", { name: "Save container" });
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const containersNamed = async (api: Api, number: string) =>
  (await api.get<ContainerListItem[]>("/containers")).filter((c) => c.number.toLowerCase() === number.toLowerCase());
const EMPTY = "No containers match these filters.";

/** An order with `received` Denim jeans received (of 100), ready to load. */
async function receivedOrder(api: Api, received = 100) {
  const order = await api.createOrder({ lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
  await api.receive(order.po, { "Denim jeans": received }, received < 100 ? {} : { shortRemark: "" });
  return order;
}

async function fillContainer(page: Page, number: string) {
  await page.getByRole("textbox", { name: "Container number" }).fill(number);
  await page.getByRole("combobox", { name: "Shipping agent" }).selectOption({ label: "Sino Freight" });
  await field(page, "Expected arrival in India (ETA)").fill(today(20));
}

test("the list shows each container, filters by search, agent, terms and status, and opens it by row, number or PO", async ({ page, api }) => {
  const order = await receivedOrder(api);
  const sino = await api.load([{ po: order.po, item: "Denim jeans", quantity: 60, bundles: 3 }], { loadedOn: today(-1), eta: today(19) });
  const dragon = await api.load([{ po: order.po, item: "Denim jeans", quantity: 40, bundles: 2 }], { agent: "Dragon Cargo", terms: "CNF" });
  await api.updateContainer(dragon.id, { status: "sea", sailedOn: today() });

  await page.goto("/containers");
  await expect(page.getByRole("heading", { level: 1, name: "Containers" })).toBeVisible();
  await expect(kpi(page, "Loading now")).toContainText(sino.number);
  await expect(kpi(page, "Active containers")).toContainText("on the way or in port");
  await expect(page.getByText(/^An order can be split across containers/)).toBeVisible();

  await search(page).fill(sino.number);
  await expect(rowOf(page, sino.number).getByRole("cell")).toHaveText([
    sino.number, "Sino Freight", "FOB", `${order.po} (part)`, "3", shortDate(today(-1)), "–", shortDate(today(19)), "Loading",
  ]);
  // Search by PO finds both containers of the order.
  await search(page).fill(order.po);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
  await expect(rowOf(page, dragon.number)).toContainText("On the sea");
  await expect(rowOf(page, dragon.number)).toContainText(shortDate(today()));

  // Status chips (the counts match the rows).
  for (const [label, shown, hidden] of [
    ["Loading", sino, dragon],
    ["On the way", dragon, sino],
  ] as const) {
    const chip = chips(page).getByRole("button", { name: new RegExp(`^${label} \\(\\d+\\)$`) });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(rowOf(page, shown.number)).toBeVisible();
    await expect(rowOf(page, hidden.number)).toHaveCount(0);
  }
  await chips(page).getByRole("button", { name: /^Arrived \(\d+\)$/ }).click();
  await expect(page.getByText(EMPTY)).toBeVisible();
  const active = chips(page).getByRole("button", { name: /^Active \(\d+\)$/ });
  await active.click();
  const total = Number((await active.textContent())!.match(/\((\d+)\)/)![1]);
  expect(total).toBe((await api.get<ContainerListItem[]>("/containers")).length);

  // Agent and terms filters.
  await page.getByRole("button", { name: "Shipping agent: All agents" }).click();
  await page.getByRole("menuitemradio", { name: "Dragon Cargo" }).click();
  await expect(rowOf(page, dragon.number)).toBeVisible();
  await expect(rowOf(page, sino.number)).toHaveCount(0);
  await page.getByRole("button", { name: "Terms: All terms" }).click();
  await page.getByRole("menuitemradio", { name: "FOB" }).click();
  await expect(page.getByText(EMPTY)).toBeVisible();
  await page.getByRole("button", { name: "Terms: FOB" }).click();
  await page.getByRole("menuitemradio", { name: "CNF" }).click();
  await expect(rowOf(page, dragon.number)).toBeVisible();
  await search(page).fill("no such container zzz");
  await expect(page.getByText(EMPTY)).toBeVisible();

  // Row click, number link and PO link.
  await page.goto("/containers");
  await search(page).fill(sino.number);
  await rowOf(page, sino.number).getByRole("cell", { name: "Sino Freight" }).click();
  await expect(page).toHaveURL(`/containers/${sino.id}`);
  await page.goto("/containers");
  await search(page).fill(sino.number);
  await rowOf(page, sino.number).getByRole("link", { name: sino.number }).click();
  await expect(page).toHaveURL(`/containers/${sino.id}`);
  await page.goto("/containers");
  await search(page).fill(sino.number);
  await rowOf(page, sino.number).getByRole("link", { name: order.po }).click();
  await expect(page).toHaveURL(`/orders/${order.po}`);
});

test("Load container: received lines, contents and loads follow what you type", async ({ page, api }) => {
  const order = await receivedOrder(api, 80);
  await page.goto("/containers");
  await page.getByRole("link", { name: "+ New container" }).click();
  await expect(page).toHaveURL("/containers/new");
  await expect(page.getByRole("heading", { level: 1, name: "Load container" })).toBeVisible();
  await expect(field(page, "Loaded on")).toHaveValue(today());
  await expect(page.getByRole("combobox", { name: "Container terms" })).toHaveValue("FOB");

  const line = page.getByRole("row").filter({ hasText: order.po });
  await expect(line).toContainText("80 pcs received · 0 loaded");
  await page.getByRole("combobox", { name: "Shipping agent" }).selectOption({ label: "Dragon Cargo" });
  await field(page, "Expected departure (ETD)").fill(today(2));
  await field(page, "Expected arrival in India (ETA)").fill(today(24));
  await expect(page.getByText("About 22 days at sea. Agent: Dragon Cargo.")).toBeVisible();

  await page.getByRole("textbox", { name: `Bundles, ${order.po} Denim jeans` }).fill("4");
  await page.getByRole("textbox", { name: `Quantity, ${order.po} Denim jeans` }).fill("50");
  const glance = page.getByRole("region", { name: "Contents at a glance" });
  await expect(kv(glance, "Orders in this container")).toHaveText("1");
  await expect(kv(glance, "Item lines")).toHaveText("1");
  await expect(kv(glance, "Total bundles")).toHaveText("4");
  await expect(page.getByText("50 of 80")).toBeVisible();
  await expect(page.getByRole("meter", { name: `${order.po} · Denim jeans loaded` })).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByText("Rest, 30 pcs, goes in the next container")).toBeVisible();
  await page.getByRole("textbox", { name: `Quantity, ${order.po} Denim jeans` }).fill("80");
  await expect(page.getByText("Everything received is loaded")).toBeVisible();

  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/containers");
});

test("Load container: every client check, a duplicate number (409) and an over-load (422) from the API", async ({ page, api }) => {
  const order = await receivedOrder(api);
  const existing = await api.load([{ po: order.po, item: "Denim jeans", quantity: 10 }]);
  const quantity = page.getByRole("textbox", { name: `Quantity, ${order.po} Denim jeans` });
  await page.goto("/containers/new");

  await saveContainer(page).click();
  for (const message of ["Enter the container number.", "Choose a shipping agent.", "Enter the expected arrival date.", "Enter a quantity for at least one line."]) {
    await expect(page.getByText(message)).toBeVisible();
  }
  await fillContainer(page, existing.number.toLowerCase());
  await field(page, "Expected arrival in India (ETA)").fill(today(-1));
  await quantity.fill("91");
  await saveContainer(page).click();
  await expect(page.getByText("The ETA can't be before the loading date.")).toBeVisible();
  await expect(page.getByText("Only 90 pcs left to load.")).toBeVisible();

  // The same number in another case is taken.
  await field(page, "Expected arrival in India (ETA)").fill(today(20));
  await quantity.fill("40");
  await saveContainer(page).click();
  await expect(page.getByText("A container with this number already exists.")).toBeVisible();

  // Another container takes 60 meanwhile: 40 more would load more than received.
  const number = containerNumber();
  await page.getByRole("textbox", { name: "Container number" }).fill(number);
  await api.load([{ po: order.po, item: "Denim jeans", quantity: 60 }]);
  await saveContainer(page).click();
  await expect(page.getByText(`Denim jeans (${order.po}): only 30 pcs left to load.`)).toBeVisible();
  expect(await containersNamed(api, number)).toHaveLength(0);
});

test("Load container: a failed or lost request keeps the values; saving goes to the list; a double click saves one", async ({ page, api }) => {
  const order = await receivedOrder(api);
  const number = containerNumber();
  await page.goto("/containers/new");
  await fillContainer(page, number);
  await page.getByRole("textbox", { name: `Quantity, ${order.po} Denim jeans` }).fill("100");

  await page.route("**/api/v1/containers", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong." } } }) : route.fallback(),
  );
  await saveContainer(page).click();
  await expect(toast(page, "Something went wrong.").first()).toContainText("Please try again.");
  await page.unroute("**/api/v1/containers");
  await page.route("**/api/v1/containers", (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  const failed = page.waitForEvent("requestfailed", (request) => request.url().endsWith("/api/v1/containers"));
  await saveContainer(page).click();
  await failed;
  await page.unroute("**/api/v1/containers");
  await expect(page.getByRole("textbox", { name: "Container number" })).toHaveValue(number);
  await expect(page.getByRole("textbox", { name: `Quantity, ${order.po} Denim jeans` })).toHaveValue("100");

  await saveContainer(page).dblclick();
  await expect(toast(page, "Container saved")).toBeVisible();
  await expect(page).toHaveURL("/containers");
  await search(page).fill(number);
  await expect(rowOf(page, number)).toContainText(order.po);
  expect(await containersNamed(api, number)).toHaveLength(1);
  expect((await api.order(order.po)).stage).toBe(3);

  // The next visit starts from an empty form, and the fully loaded line is gone.
  await page.getByRole("link", { name: "+ New container" }).click();
  await expect(page.getByRole("textbox", { name: "Container number" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: `Quantity, ${order.po} Denim jeans` })).toHaveCount(0);
});

test("container page: details, Change ETA, Mark as sailed with its checks, Change dates, Mark as arrived", async ({ page, api }) => {
  const order = await receivedOrder(api);
  const container = await api.load([{ po: order.po, item: "Denim jeans", quantity: 100, bundles: 5 }], { loadedOn: today(-3), eta: today(20) });
  await page.goto(`/containers/${container.id}`);

  const header = page.getByRole("banner");
  await expect(page.getByRole("heading", { level: 1, name: container.number })).toBeVisible();
  await expect(header).toContainText("Loading");
  await expect(page.getByRole("table").getByRole("row").nth(1).getByRole("cell")).toHaveText([order.po, "Denim jeans", "5", "100 pcs"]);
  for (const [label, value] of [
    ["Shipping agent", "Sino Freight"],
    ["Terms", "FOB"],
    ["Port of loading", "Guangzhou (Nansha)"],
    ["Port of arrival", "Kochi"],
    ["Loaded on", longDate(today(-3))],
    ["Sailed on", "–"],
    ["ETA India", longDate(today(20))],
    ["Bundles", "5"],
  ]) {
    await expect(kv(page, label!)).toHaveText(value!);
  }
  await expect(header.getByRole("button")).toHaveText(["Mark as sailed", "Change ETA"]);

  // Change ETA: cancel, a check, then save.
  await header.getByRole("button", { name: "Change ETA" }).click();
  let form: Locator = dialog(page, "Change ETA");
  await expect(form).toContainText("Correct the expected arrival in India.");
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(form).toHaveCount(0);
  await header.getByRole("button", { name: "Change ETA" }).click();
  await field(form, "Expected arrival in India (ETA)").fill(today(-5));
  await form.getByRole("button", { name: "Save ETA" }).click();
  await expect(form.getByText("The ETA can't be before the loading date.")).toBeVisible();
  await field(form, "Expected arrival in India (ETA)").fill("");
  await form.getByRole("button", { name: "Save ETA" }).click();
  await expect(form.getByText("Enter the ETA.")).toBeVisible();
  await field(form, "Expected arrival in India (ETA)").fill(today(22));
  await form.getByRole("button", { name: "Save ETA" }).click();
  await expect(toast(page, "ETA saved")).toBeVisible();
  await expect(kv(page, "ETA India")).toHaveText(longDate(today(22)));

  // Mark as sailed: each date check, then sail.
  await header.getByRole("button", { name: "Mark as sailed" }).click();
  form = dialog(page, "Mark as sailed");
  await expect(form).toContainText("Enter the date it sailed.");
  await form.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(form.getByText("Enter the sailing date.")).toBeVisible();
  await field(form, "Sailing date").fill(today(1));
  await form.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(form.getByText("The sailing date can't be after today.")).toBeVisible();
  await field(form, "Sailing date").fill(today(-4));
  await form.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(form.getByText("The sailing date can't be before the loading date.")).toBeVisible();
  await field(form, "Sailing date").fill(today(-1));
  await field(form, "Expected arrival in India (ETA)").fill(today(-2));
  await form.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(form.getByText("The ETA can't be before the sailing date.")).toBeVisible();
  await field(form, "Expected arrival in India (ETA)").fill(today(22));
  await form.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(toast(page, "Container marked as sailed")).toBeVisible();
  await expect(header).toContainText("On the sea");
  await expect(kv(page, "Sailed on")).toHaveText(longDate(today(-1)));
  await expect(header.getByRole("button")).toHaveText(["Mark as arrived", "Change dates"]);

  // Change dates.
  await header.getByRole("button", { name: "Change dates" }).click();
  form = dialog(page, "Change dates");
  await expect(field(form, "Sailing date")).toHaveValue(today(-1));
  await field(form, "Sailing date").fill(today());
  await form.getByRole("button", { name: "Save dates" }).click();
  await expect(toast(page, "Dates saved")).toBeVisible();
  await expect(kv(page, "Sailed on")).toHaveText(longDate(today()));

  // Mark as arrived: nothing can change after it.
  await header.getByRole("button", { name: "Mark as arrived" }).click();
  form = dialog(page, "Mark as arrived");
  await expect(form).toContainText("After this, the container can't be changed.");
  await form.getByRole("button", { name: "Mark as arrived" }).click();
  await expect(toast(page, "Container marked as arrived")).toBeVisible();
  await expect(header).toContainText("Arrived, in clearing");
  await expect(header.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("This container has arrived and can't be changed.")).toBeVisible();

  // Persisted, and the order's stage did not move.
  await page.reload();
  await expect(header).toContainText("Arrived, in clearing");
  expect((await api.order(order.po)).stage).toBe(3);
  await page.getByRole("table").getByRole("link", { name: order.po }).click();
  await expect(page).toHaveURL(`/orders/${order.po}`);
});

test("container page: the API's 409s for stale pages and its 422 show; an unknown container is not found", async ({ page, api }) => {
  const order = await receivedOrder(api);
  const container = await api.load([{ po: order.po, item: "Denim jeans", quantity: 100 }], { loadedOn: today(-2) });
  await page.goto(`/containers/${container.id}`);
  const header = page.getByRole("banner");

  // The server checks the sailing date too (the request is changed to a future date on its way).
  await header.getByRole("button", { name: "Mark as sailed" }).click();
  let form = dialog(page, "Mark as sailed");
  await field(form, "Sailing date").fill(today());
  await page.route(`**/api/v1/containers/${container.id}`, (route) =>
    route.request().method() === "PATCH" ? route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), sailedOn: today(1) }) }) : route.fallback(),
  );
  await form.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(form.getByText("The sailing date can't be after today.")).toBeVisible();
  await page.unroute(`**/api/v1/containers/${container.id}`);

  // Sailed elsewhere meanwhile: marking it again is refused (409 invalid_status_change).
  await api.updateContainer(container.id, { status: "sea", sailedOn: today() });
  await form.getByRole("button", { name: "Mark as sailed" }).click();
  await expect(toast(page, "Containers move from Loading to At sea to Arrived, in that order.")).toBeVisible();
  // The 409 means the page is stale: the dialog closes and the page shows the real state (Round 3).
  await expect(form).toBeHidden();
  await expect(header).toContainText("On the sea");

  // Arrived elsewhere meanwhile: changing its ETA is refused (409 container_arrived).
  await page.reload();
  await api.updateContainer(container.id, { status: "arrived" });
  await header.getByRole("button", { name: "Change dates" }).click();
  form = dialog(page, "Change dates");
  await field(form, "Expected arrival in India (ETA)").fill(today(30));
  await form.getByRole("button", { name: "Save dates" }).click();
  await expect(toast(page, "This container has arrived and can't be changed.")).toBeVisible();
  const saved = (await api.get<ContainerListItem[]>("/containers")).find((c) => c.id === container.id)!;
  expect(saved).toMatchObject({ status: "arrived", sailedOn: today() });
  expect(saved.eta).not.toBe(today(30));

  await page.goto("/containers/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await page.goto("/containers/not-a-container");
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
});

test.describe("China staff with Containers (containers Enter)", () => {
  test.use({ storageState: LOADING_STAFF_STATE });

  test("loads a container and marks it sailed; Management sees it; POs are plain text", async ({ page, api, browser }) => {
    const order = await receivedOrder(api);
    const number = containerNumber();
    await page.goto("/containers/new");
    await fillContainer(page, number);
    await page.getByRole("textbox", { name: `Quantity, ${order.po} Denim jeans` }).fill("100");
    await saveContainer(page).click();
    await expect(page).toHaveURL("/containers");
    await search(page).fill(number);
    await expect(rowOf(page, number).getByRole("link", { name: order.po })).toHaveCount(0);
    await rowOf(page, number).getByRole("link", { name: number }).click();
    await page.getByRole("banner").getByRole("button", { name: "Mark as sailed" }).click();
    await field(dialog(page, "Mark as sailed"), "Sailing date").fill(today());
    await dialog(page, "Mark as sailed").getByRole("button", { name: "Mark as sailed" }).click();
    await expect(page.getByRole("banner")).toContainText("On the sea");

    const management = settled(await browser.newPage({ storageState: MANAGEMENT_STATE, viewport: { width: 1440, height: 900 } }));
    await management.goto("/containers");
    await search(management).fill(number);
    await expect(rowOf(management, number)).toContainText("On the sea");
    await management.close();
  });
});

test.describe("China staff without Containers", () => {
  test.use({ storageState: STAFF_STATE });

  test("the containers pages go to the staff home", async ({ page }) => {
    await page.goto("/containers");
    await expect(page).toHaveURL("/home");
    await page.goto("/containers/new");
    await expect(page).toHaveURL("/home");
  });
});

for (const [role, state] of [
  ["Procurement", PROCUREMENT_STATE],
  ["Accounts", freshSignIn(ANITA)],
] as const) {
  test.describe(`${role} (no containers access)`, () => {
    test.use({ storageState: state });

    test("the containers pages go to the dashboard", async ({ page, api }) => {
      const order = await receivedOrder(api);
      const container = await api.load([{ po: order.po, item: "Denim jeans", quantity: 10 }]);
      await page.goto("/containers");
      await expect(page).toHaveURL("/");
      await page.goto(`/containers/${container.id}`);
      await expect(page).toHaveURL("/");
    });
  });
}
