import type { Page } from "@playwright/test";

import { containerNumber, expect, field, settled, shortDate, signInState, test, toast, today } from "./live-api";

// Wave 3, Agent 5: one container through Clearing (India), Transport and Warehouse in a real browser, by the roles that
// do each step, checking the order's stage, the refusals and that every saved record survives a reload.
//
// Set up through the API as Management: Foshan Fabrics, 100 Denim jeans at ¥10, received in full, loaded today in 4
// bundles (CNF), sailed today and arrived. India staff (Anil) clear it and move it by road; 3 of 4 bundles arrive.
// Warehouse staff (Joseph) give 60 pcs to Retail and 40 to Wholesale.

const VIEWPORT = { width: 1440, height: 900 };
test.use({ viewport: VIEWPORT });

const ANIL = "anil@mrgarments.com";
const JOSEPH = "joseph@mrgarments.com";
const CLOSED = "This record is complete and can't be changed.";

const rowOf = (page: Page, text: string) => page.getByRole("table").getByRole("row").filter({ hasText: text });

test("an arrived container is cleared, moved by road and received into stock", async ({ page, api, browser, playwright, baseURL }) => {
  test.setTimeout(240_000);
  const as = async (email: string) => settled(await browser.newPage({ storageState: await signInState(playwright, baseURL, email), viewport: VIEWPORT }));
  const number = containerNumber();
  const lr = `LR-${number}`;

  const order = await api.createOrder({ lines: [{ item: "Denim jeans", quantity: 100, rateCny: 10 }] });
  await api.receive(order.po, { "Denim jeans": 100 });
  const container = await api.load([{ po: order.po, item: "Denim jeans", quantity: 100, bundles: 4 }], { number, terms: "CNF" });
  await api.updateContainer(container.id, { status: "sea", sailedOn: today() });
  await api.updateContainer(container.id, { status: "arrived" });
  const stage = async () => (await api.order(order.po)).stage;
  expect(await stage()).toBe(3);

  await test.step("Clearing: the arrived container waits for the agent; a draft moves the order to stage 4", async () => {
    const anil = await as(ANIL);
    await anil.goto("/clearing");
    await anil.getByRole("searchbox", { name: "Search container or PO" }).fill(number);
    await expect(rowOf(anil, number)).toContainText("Waiting for agent");
    await rowOf(anil, number).getByRole("link", { name: number }).click();
    await expect(anil).toHaveURL(`/clearing/${container.id}`);
    await expect(anil.getByRole("heading", { level: 1, name: `Container ${number}` })).toBeVisible();

    await anil.getByRole("combobox", { name: "Clearing agent" }).selectOption({ label: "Kochi Clearing Services" });
    await expect(field(anil, "Agent contact person")).toHaveAttribute("readonly", "");
    await expect(field(anil, "Arrived at port")).toHaveValue(today());
    await field(anil, "Handed to agent on").fill(today());
    await field(anil, "Bill of entry no.").fill("BE-E2E-1");
    await anil.getByRole("textbox", { name: "Customs duty" }).fill("19600");
    await anil.getByRole("textbox", { name: "Clearing agent charges" }).fill("1800");
    await expect(anil.getByRole("textbox", { name: "Customs duty" })).toHaveValue("19,600");
    await expect(anil.locator("output")).toHaveText("₹21,400");

    await anil.getByRole("button", { name: "Save draft" }).click();
    await expect(toast(anil, "Clearing draft saved").first()).toBeVisible();
    expect(await stage()).toBe(4);
    await anil.reload();
    await expect(field(anil, "Bill of entry no.")).toHaveValue("BE-E2E-1");
    await expect(anil.getByRole("textbox", { name: "Customs duty" })).toHaveValue("19,600");

    // Marking cleared needs the duty and cleared dates; the refusal saves nothing.
    await anil.getByRole("button", { name: "Mark cleared, hand to transport" }).click();
    await expect(anil.getByText("Enter the date the duty was paid.")).toBeVisible();
    await expect(anil.getByText("Enter the date it was cleared.")).toBeVisible();
    await field(anil, "Duty paid on").fill(today());
    await field(anil, "Cleared on").fill(today());
    await anil.getByRole("button", { name: "Mark cleared, hand to transport" }).dblclick();
    await expect(toast(anil, "Container cleared and handed to transport").first()).toBeVisible();
    await expect(anil).toHaveURL("/clearing");
    await anil.getByRole("searchbox", { name: "Search container or PO" }).fill(number);
    await expect(rowOf(anil, number)).toContainText(`Cleared ${shortDate(today())}`);
    await expect(rowOf(anil, number)).toContainText("₹21,400");
    expect(await stage()).toBe(4);

    // Complete: read-only, and the API refuses another save.
    await anil.goto(`/clearing/${container.id}`);
    await expect(anil.getByText(CLOSED)).toBeVisible();
    await expect(anil.getByRole("button", { name: "Mark cleared, hand to transport" })).toHaveCount(0);
    await expect(anil.getByRole("combobox", { name: "Clearing agent" })).toBeDisabled();
    const again = await api.request.put(`/api/v1/clearings/${container.id}`, { data: { clearingAgentId: "00000000-0000-4000-8000-000000000000", arrivedOn: today() } });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe("record_closed");
    await anil.close();
  });

  await test.step("Transport: the cleared container is ready; loading moves the order to stage 5; short bundles need a remark", async () => {
    const anil = await as(ANIL);
    await anil.goto("/transport");
    // Only the "Ready for transport" rows link the container number.
    await expect(anil.getByText("Ready for transport")).toBeVisible();
    await anil.getByRole("link", { name: number }).click();
    await expect(anil).toHaveURL(`/transport/${container.id}`);
    await expect(anil.getByText("This container hasn't been cleared yet.")).toHaveCount(0);

    await anil.getByRole("combobox", { name: "Transport name" }).selectOption({ label: "Kerala Roadways" });
    await field(anil, "LR number").fill(lr);
    await field(anil, "Vehicle number").fill("KL 07 E2E 1");
    await field(anil, "Driver phone").fill("+91 94470 55123");
    await expect(field(anil, "Bundles loaded")).toHaveValue("4");
    await expect(field(anil, /^Loaded on$/)).toHaveValue(today());
    await anil.getByRole("textbox", { name: "Freight" }).fill("2200");
    await anil.getByRole("button", { name: "Save draft" }).click();
    await expect(toast(anil, "Transport draft saved").first()).toBeVisible();
    expect(await stage()).toBe(5);

    await anil.reload();
    await expect(field(anil, "LR number")).toHaveValue(lr);
    await field(anil, "Unloaded on").fill(today());
    await field(anil, "Bundles received").fill("3");
    await field(anil, "Received by").fill("Joseph M");
    await anil.getByRole("button", { name: "Save and mark unloaded" }).click();
    await expect(anil.getByText("Add a remark about the short bundles.")).toBeVisible();
    await field(anil, "Short remark").fill("One bundle torn at the port");
    await anil.getByRole("button", { name: "Save and mark unloaded" }).dblclick();
    await expect(toast(anil, "Trip marked as unloaded").first()).toBeVisible();
    await expect(anil).toHaveURL("/transport");
    await anil.getByRole("searchbox", { name: "Search vehicle, LR or PO" }).fill(lr);
    await expect(rowOf(anil, lr)).toContainText("3 of 4");
    await expect(rowOf(anil, lr)).toContainText("₹2,200");
    expect(await stage()).toBe(5);

    await anil.goto(`/transport/${container.id}`);
    await expect(anil.getByText(CLOSED)).toBeVisible();
    await expect(anil.getByRole("button", { name: "Save and mark unloaded" })).toHaveCount(0);
    await anil.close();
  });

  await test.step("Warehouse: the unloaded trip waits to be received; adding it to stock moves the order to stage 6", async () => {
    const joseph = await as(JOSEPH);
    await joseph.goto("/warehouse");
    await joseph.getByRole("link", { name: new RegExp(lr) }).click();
    await expect(joseph).toHaveURL(/\/warehouse\/receive\/[0-9a-f-]{36}$/);
    await expect(joseph.getByRole("heading", { level: 1, name: "Receive goods" })).toBeVisible();
    await expect(field(joseph, /^Container$/)).toHaveValue(number);
    await expect(field(joseph, "Bundles received")).toHaveValue("3");
    // Warehouse staff see quantities, not costs.
    await expect(joseph.getByText("Cost so far")).toHaveCount(0);

    await joseph.getByRole("textbox", { name: "Retail team, Denim jeans" }).fill("60");
    const summary = joseph.getByRole("status").filter({ hasText: "given to teams" });
    await expect(summary).toContainText("60 of 100 pcs given to teams");
    await expect(summary).toContainText("40 pcs left unassigned");
    await joseph.getByRole("button", { name: "Save draft" }).click();
    await expect(toast(joseph, "Receipt draft saved").first()).toBeVisible();
    expect(await stage()).toBe(5);
    await joseph.reload();
    await expect(joseph.getByRole("textbox", { name: "Retail team, Denim jeans" })).toHaveValue("60");

    await joseph.getByRole("textbox", { name: "Wholesale team, Denim jeans" }).fill("40");
    await expect(summary).toContainText("Nothing left unassigned");
    await joseph.getByRole("button", { name: "Save and add to stock" }).dblclick();
    await expect(toast(joseph, "Goods added to stock").first()).toBeVisible();
    await expect(joseph).toHaveURL("/warehouse");
    await joseph.getByRole("searchbox", { name: "Search item or PO" }).fill(order.po);
    await expect(rowOf(joseph, order.po)).toContainText(number);
    await expect(rowOf(joseph, order.po)).toContainText("100");
    await expect(joseph.getByRole("columnheader", { name: "Cost per piece" })).toHaveCount(0);
    expect(await stage()).toBe(6);
    await joseph.close();
  });

  await test.step("Management sees the cost; the records are complete after a reload", async () => {
    await page.goto("/warehouse");
    await page.getByRole("searchbox", { name: "Search item or PO" }).fill(order.po);
    await expect(rowOf(page, order.po)).toContainText("60");
    await expect(rowOf(page, order.po)).toContainText("40");
    await expect(page.getByRole("columnheader", { name: "Cost per piece" })).toBeVisible();

    const { rows } = await api.get<{ rows: { po: string; transportId: string }[] }>("/warehouse-receipts");
    const tripId = rows.find((r) => r.po === order.po)!.transportId;
    await page.goto(`/warehouse/receive/${tripId}`);
    await expect(page.getByText(CLOSED)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save and add to stock" })).toHaveCount(0);
    await expect(page.getByText("Cost so far")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Wholesale team, Denim jeans" })).toHaveValue("40");
    expect(await stage()).toBe(6);
  });
});
