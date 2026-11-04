import type { Page } from "@playwright/test";

import { expect, longDate, test, toast, today } from "./live-api";
import { PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Deleting a China receipt from the Receiving (China) list (REC-4), against the live API. Role/label locators only
// (hidden <Activity> routes stay in the DOM). Each test makes its own order.

const table = (page: Page) => page.getByRole("table");
const rowsOf = (page: Page, po: string) => table(page).getByRole("row").filter({ hasText: po });
async function openList(page: Page, po: string) {
  await page.goto("/receiving");
  await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
}
/** A DELETE sent the way the app sends it (Origin and JSON), so the same-site check passes and the API decides. */
const apiDelete = (page: Page, baseURL: string | undefined, path: string) =>
  page.request.delete(`/api/v1${path}`, { headers: { Origin: baseURL ?? "" }, data: {} });
function deletesOf(page: Page) {
  const deletes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") deletes.push(new URL(request.url()).pathname);
  });
  return deletes;
}

test.describe("Management", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a receipt whose goods are in a container explains what to delete first; one the others cover is deleted", async ({ page, api }) => {
    // 60 then 40 received, 50 loaded: without the first only 40 is left, so it holds 10 of the loaded goods; the
    // second is covered by the first's 60. The order keeps its deposit.
    const { po } = await api.createOrder({ deposits: [{ amountCny: 300, rateInr: 12 }] });
    const first = (await api.receive(po, { "Denim jeans": 60 }, { receivedOn: today(-1) })).receipt.id;
    const second = (await api.receive(po, { "Denim jeans": 40 })).receipt.id;
    const container = await api.load([{ po, item: "Denim jeans", quantity: 50 }]);
    await openList(page, po);
    expect((await table(page).getByRole("columnheader").allTextContents()).slice(-2)).toEqual(["Status", "Actions"]);
    await expect(rowsOf(page, po)).toHaveCount(2);
    const deletes = deletesOf(page);

    // The first: refused up front, naming the container. Nothing is sent.
    await page.getByRole("button", { name: `Delete receipt of ${po} on ${longDate(today(-1))}, 60 pcs Denim jeans` }).click();
    const refused = page.getByRole("alertdialog", { name: "Can't delete receipt" });
    await expect(refused).toContainText(`This receipt from ${po} can't be deleted: container ${container.number} already holds goods from it.`);
    await expect(refused).toContainText("Delete that container first.");
    await refused.getByRole("button", { name: "Close" }).click();
    await expect(refused).toBeHidden();

    // The second: its facts and what changes; Escape and Cancel send nothing.
    const secondDelete = page.getByRole("button", { name: `Delete receipt of ${po} on ${longDate(today())}, 40 pcs Denim jeans` });
    const ask = page.getByRole("alertdialog", { name: "Delete Goods Receipt?" });
    await secondDelete.click();
    await expect(ask).toContainText(second);
    await expect(ask).toContainText(`${po} · Foshan Fabrics`);
    await expect(ask).toContainText("In containersNone");
    await expect(ask).toContainText(`${po}'s received quantity goes down by 40 pcs Denim jeans. Its other receipts stay.`);
    await page.keyboard.press("Escape");
    await expect(ask).toBeHidden();
    await secondDelete.click();
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(ask).toBeHidden();
    expect(deletes).toEqual([]);

    // A double-click deletes it once; the row goes, the order stays loaded with its deposit and the other receipt.
    await secondDelete.click();
    await ask.getByRole("button", { name: "Delete receipt" }).dblclick();
    await expect(toast(page, "Receipt deleted").first()).toBeVisible();
    await expect(rowsOf(page, po)).toHaveCount(1);
    expect(deletes).toEqual([`/api/v1/receipts/${second}`]);
    const order = await api.order(po);
    expect(order.receipts?.map((r) => r.id)).toEqual([first]);
    expect(order).toMatchObject({ stage: 3, received: 60 });
    expect(order.payments).toHaveLength(1);
  });

  test("on a phone, Delete stays in view; the order's only receipt sends it back to waiting to be received", async ({ page, api, baseURL }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const { po } = await api.createOrder();
    const { id } = (await api.receive(po, { "Denim jeans": 30 })).receipt;
    // No search box below 640 px: the newest receipt is the first row.
    await page.goto("/receiving");
    await expect(table(page).getByRole("row").nth(1)).toContainText(po);
    const button = page.getByRole("button", { name: new RegExp(`^Delete receipt of ${po} `) });
    await expect(button).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    await button.click();
    const ask = page.getByRole("alertdialog", { name: "Delete Goods Receipt?" });
    await expect(ask).toContainText("It is the order's only receipt, so the order goes back to waiting to be received.");
    await expect(ask.getByRole("button", { name: "Delete receipt" })).toBeInViewport();
    await ask.getByRole("button", { name: "Delete receipt" }).click();
    await expect(toast(page, "Receipt deleted").first()).toBeVisible();
    await expect(rowsOf(page, po)).toHaveCount(0);
    expect(await api.order(po)).toMatchObject({ stage: 1, received: 0, receipts: [] });
    // Deleted already: 404.
    const again = await apiDelete(page, baseURL, `/receipts/${id}`);
    expect([again.status(), (await again.json()).error.code]).toEqual([404, "not_found"]);
  });
});

for (const [role, state] of [
  ["China staff (receiving Enter)", STAFF_STATE],
  ["Procurement (receiving View)", PROCUREMENT_STATE],
] as const) {
  test.describe(role, () => {
    test.use({ storageState: state, viewport: { width: 1440, height: 900 } });

    test("sees receipts but no Actions or Delete, and the API refuses the delete", async ({ page, api, baseURL }) => {
      const { po } = await api.createOrder();
      const { id } = (await api.receive(po, { "Denim jeans": 30 })).receipt;
      await openList(page, po);
      await expect(rowsOf(page, po)).toHaveCount(1);
      await expect(table(page).getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Delete receipt/ })).toHaveCount(0);
      const refused = await apiDelete(page, baseURL, `/receipts/${id}`);
      expect([refused.status(), (await refused.json()).error.code]).toEqual([403, "forbidden"]);
      expect((await api.order(po)).receipts).toHaveLength(1);
    });
  });
}
