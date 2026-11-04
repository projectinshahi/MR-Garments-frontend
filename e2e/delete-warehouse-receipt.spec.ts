import type { Page } from "@playwright/test";

import { type Api, expect, freshSignIn, test, toast, today } from "./live-api";

// Deleting warehouse receipts (WH-4) from the Warehouse list, against the live API: a stocked receipt is reversed (out
// of stock, the order back to 5), then a draft goes. Role/label locators only. Each test makes its own container.

test.use({ viewport: { width: 1440, height: 900 } });

const rowOf = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });

/** One order's container through clearing and an unloaded trip; returns what WH-3 needs to receive it. */
async function unloaded(api: Api) {
  const { po } = await api.createOrder();
  await api.receive(po, { "Denim jeans": 100 });
  const container = await api.load([{ po, item: "Denim jeans", quantity: 100, bundles: 4 }], { loadedOn: today(-10), eta: today(-2) });
  await api.updateContainer(container.id, { status: "sea", sailedOn: today(-9) });
  await api.updateContainer(container.id, { status: "arrived" });
  const clearing = await api.get<{ agents: { id: string }[] }>(`/clearings/${container.id}`);
  const cleared = await api.request.put(`/api/v1/clearings/${container.id}`, {
    data: { clearingAgentId: clearing.agents[0]!.id, arrivedOn: today(-3), handedOn: today(-3), billOfEntry: "BE-WH", dutyPaidOn: today(-2), clearedOn: today(-1), goodsValueInr: null, customsDutyInr: 1000, otherDutiesInr: 0, agentChargesInr: 0, portChargesInr: 0, complete: true },
  });
  expect(cleared.status(), await cleared.text()).toBe(200);
  const form = await api.get<{ companies: { id: string }[]; warehouses: { id: string }[] }>(`/transports/${container.id}`);
  const lr = `LR-${container.number.slice(-7)}`;
  const trip = await api.request.put(`/api/v1/transports/${container.id}`, {
    data: {
      transportCompanyId: form.companies[0]!.id,
      destinationId: form.warehouses[0]!.id,
      lrNumber: lr,
      vehicleNumber: "KL 07 WH 1",
      driverName: "",
      driverPhone: "+91 90000 00000",
      bundlesLoaded: 4,
      loadedOn: today(),
      loadedFrom: "",
      loadedBy: "",
      unloadedOn: today(),
      bundlesReceived: 4,
      receivedBy: "Joseph M",
      shortRemark: "",
      freightInr: 500,
      handlingInr: 100,
      complete: true,
    },
  });
  expect(trip.status(), await trip.text()).toBe(200);
  const tripId = ((await trip.json()) as { trip: { id: string } }).trip.id;
  const receiving = await api.get<{ lines: { orderLineId: string }[]; teams: { id: string; name: string }[]; warehouses: { id: string }[] }>(`/warehouse-receipts/${tripId}`);
  /** WH-3: Retail gets every piece; stocked unless `complete` is false. */
  const receive = async (complete: boolean) => {
    const res = await api.request.put(`/api/v1/warehouse-receipts/${tripId}`, {
      data: {
        locationId: receiving.warehouses[0]!.id,
        receivedOn: today(),
        receivedBy: "Joseph M",
        bundlesReceived: 4,
        lines: [{ orderLineId: receiving.lines[0]!.orderLineId, teamId: receiving.teams.find((t) => t.name === "Retail team")!.id, quantity: 100 }],
        complete,
      },
    });
    expect(res.status(), await res.text()).toBe(200);
  };
  return { po, ...container, lr, tripId, receive };
}

test("Management reverses a stocked receipt, then deletes a draft, from the Warehouse list", async ({ page, api }) => {
  const c = await unloaded(api);
  await c.receive(true);
  expect((await api.order(c.po)).stage).toBe(6);

  // The stocked table: Actions last (it has no Status). Cancel sends nothing.
  await page.goto("/warehouse");
  expect((await page.getByRole("table").first().getByRole("columnheader").allTextContents()).at(-1)).toBe("Actions");
  await page.getByRole("searchbox", { name: "Search item or PO" }).fill(c.po);
  const deleteStocked = page.getByRole("button", { name: `Delete warehouse receipt of ${c.po}, container ${c.number}` });
  const ask = page.getByRole("alertdialog", { name: "Delete Warehouse Receipt?" });
  await deleteStocked.click();
  await expect(ask).toContainText("Completed, in stock");
  await expect(ask).toContainText("Retail 100");
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(ask).toBeHidden();
  expect((await api.order(c.po)).stage).toBe(6);

  const deletes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") deletes.push(new URL(request.url()).pathname);
  });
  await deleteStocked.click();
  await ask.getByRole("button", { name: "Delete warehouse receipt" }).dblclick();
  await expect(toast(page, "Warehouse receipt deleted").first()).toBeVisible();
  await expect(deleteStocked).toHaveCount(0);
  expect(deletes).toEqual([`/api/v1/warehouse-receipts/${c.tripId}`]);
  expect((await api.order(c.po)).stage).toBe(5);
  // The trip is waiting to be received again (once the list refreshed); Actions follow Status in that table.
  await expect(rowOf(page, c.lr)).toContainText("Not started");
  const waitingHeads = await page.getByRole("table").last().getByRole("columnheader").allTextContents();
  expect(waitingHeads[waitingHeads.indexOf("Status") + 1]).toBe("Actions");

  // A draft: Delete on the waiting row (never opening the trip), and the trip is not started again.
  await c.receive(false);
  await page.reload();
  await expect(rowOf(page, c.lr)).toContainText("Draft saved");
  await page.getByRole("button", { name: `Delete draft warehouse receipt of trip ${c.lr}` }).click();
  await expect(ask).toContainText("Only the draft goes");
  await ask.getByRole("button", { name: "Delete warehouse receipt" }).click();
  await expect(toast(page, "Warehouse receipt deleted").first()).toBeVisible();
  await expect(page).toHaveURL("/warehouse");
  await expect(rowOf(page, c.lr)).toContainText("Not started");
  expect((await api.order(c.po)).stage).toBe(5);
});

test.describe("Warehouse staff (warehouse Enter)", () => {
  test.use({ storageState: freshSignIn("joseph@mrgarments.com") });

  test("see the Warehouse list without an Actions column", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page.getByRole("heading", { level: 1, name: "Warehouse" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  });
});
