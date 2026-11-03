import type { Page } from "@playwright/test";

import { type Api, expect, freshSignIn, test, toast, today } from "./live-api";

// Deleting a road trip (TRN-4) and a clearing (CLR-4) from the Transport and Clearing lists, against the live API.
// Role/label locators only (hidden <Activity> routes stay in the DOM). Each test makes its own container.

test.use({ viewport: { width: 1440, height: 900 } });

const rowOf = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });

/** One order's container, arrived, cleared (CLR-3) and on the road (TRN-3). */
async function onTheRoad(api: Api) {
  const { po } = await api.createOrder();
  await api.receive(po, { "Denim jeans": 100 });
  const container = await api.load([{ po, item: "Denim jeans", quantity: 100, bundles: 4 }], { loadedOn: today(-10), eta: today(-2) });
  await api.updateContainer(container.id, { status: "sea", sailedOn: today(-9) });
  await api.updateContainer(container.id, { status: "arrived" });
  const clearing = await api.get<{ agents: { id: string }[] }>(`/clearings/${container.id}`);
  const cleared = await api.request.put(`/api/v1/clearings/${container.id}`, {
    data: {
      clearingAgentId: clearing.agents[0]!.id,
      arrivedOn: today(-3),
      handedOn: today(-3),
      billOfEntry: "BE-E2E",
      dutyPaidOn: today(-2),
      clearedOn: today(-1),
      goodsValueInr: null,
      customsDutyInr: 1000,
      otherDutiesInr: 0,
      agentChargesInr: 0,
      portChargesInr: 0,
      complete: true,
    },
  });
  expect(cleared.status(), await cleared.text()).toBe(200);
  const tripForm = await api.get<{ companies: { id: string }[]; warehouses: { id: string }[] }>(`/transports/${container.id}`);
  const lr = `LR-${container.number.slice(-7)}`;
  const trip = await api.request.put(`/api/v1/transports/${container.id}`, {
    data: {
      transportCompanyId: tripForm.companies[0]!.id,
      destinationId: tripForm.warehouses[0]!.id,
      lrNumber: lr,
      vehicleNumber: "KL 07 E2E 1",
      driverName: "",
      driverPhone: "+91 90000 00000",
      bundlesLoaded: 4,
      loadedOn: today(),
      loadedFrom: "",
      loadedBy: "",
      unloadedOn: null,
      bundlesReceived: null,
      receivedBy: "",
      shortRemark: "",
      freightInr: 500,
      handlingInr: 100,
      complete: false,
    },
  });
  expect(trip.status(), await trip.text()).toBe(200);
  return { po, ...container, lr };
}

test("Management deletes a container's road trip, then its clearing; the clearing is refused while the trip exists", async ({ page, api }) => {
  const c = await onTheRoad(api);
  expect((await api.order(c.po)).stage).toBe(5);

  // Clearing list: Actions right after Status. The trip refuses the clearing's delete, with the server's reason.
  await page.goto("/clearing");
  const clearingHeads = await page.getByRole("columnheader").allTextContents();
  expect(clearingHeads[clearingHeads.indexOf("Status") + 1]).toBe("Actions");
  await page.getByRole("searchbox", { name: "Search container or PO" }).fill(c.number);
  const deleteClearing = page.getByRole("button", { name: `Delete clearing of container ${c.number}` });
  const askClearing = page.getByRole("alertdialog", { name: "Delete Clearing?" });
  await deleteClearing.click();
  await expect(askClearing).toContainText(`Transport trip ${c.lr} (on the way) depends on this clearing`);
  await askClearing.getByRole("button", { name: "Delete clearing" }).click();
  const refused = page.getByRole("alertdialog", { name: "Can't delete clearing" });
  await expect(refused).toContainText(`transport trip ${c.lr} depends on it. Delete that trip first.`);
  await refused.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL("/clearing");

  // Transport list: Actions right after the status column. Cancel sends nothing; a double-click deletes once.
  await page.goto("/transport");
  const tripHeads = await page.getByRole("columnheader").allTextContents();
  expect(tripHeads[tripHeads.indexOf("Bundles received") + 1]).toBe("Actions");
  await page.getByRole("searchbox", { name: "Search vehicle, LR or PO" }).fill(c.lr);
  const deleteTrip = page.getByRole("button", { name: `Delete trip ${c.lr}` });
  const askTrip = page.getByRole("alertdialog", { name: "Delete Transport Trip?" });
  await deleteTrip.click();
  await expect(askTrip).toContainText("Its freight and handling leave the landed cost");
  await askTrip.getByRole("button", { name: "Cancel" }).click();
  await expect(askTrip).toBeHidden();
  expect((await api.order(c.po)).stage).toBe(5);
  const deletes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") deletes.push(new URL(request.url()).pathname);
  });
  await deleteTrip.click();
  await askTrip.getByRole("button", { name: "Delete trip" }).dblclick();
  await expect(toast(page, "Trip deleted").first()).toBeVisible();
  await expect(deleteTrip).toHaveCount(0);
  await expect(page).toHaveURL("/transport");
  expect(deletes).toEqual([`/api/v1/transports/${c.id}`]);
  expect((await api.order(c.po)).stage).toBe(4);

  // Now the clearing goes; the container waits for clearing again and the order is back at loading.
  await page.goto("/clearing");
  await page.getByRole("searchbox", { name: "Search container or PO" }).fill(c.number);
  await deleteClearing.click();
  await expect(askClearing).toContainText("Its duty and charges leave the landed cost");
  await askClearing.getByRole("button", { name: "Delete clearing" }).click();
  await expect(toast(page, "Clearing deleted").first()).toBeVisible();
  await expect(deleteClearing).toHaveCount(0);
  await expect(rowOf(page, c.number)).toContainText("Waiting for agent");
  expect((await api.order(c.po)).stage).toBe(3);
});

test.describe("India staff (clearing and transport Enter)", () => {
  test.use({ storageState: freshSignIn("anil@mrgarments.com") });

  test("see the Clearing and Transport lists without an Actions column", async ({ page }) => {
    for (const path of ["/clearing", "/transport"]) {
      await page.goto(path);
      await expect(page.getByRole("columnheader").first()).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Delete (clearing|trip)/ })).toHaveCount(0);
    }
  });
});
