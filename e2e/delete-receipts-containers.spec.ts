import { expect, test, toast } from "./live-api";
import { PROCUREMENT_STATE } from "./sessions";

// Deleting an order's receipts and containers (REC-4, CON-6), then the order (ORD-6), against the live API. Role/label
// locators only (hidden <Activity> routes stay in the DOM). Each test makes its own order.

test.use({ viewport: { width: 1440, height: 900 } });

test("Management clears an order's container, then its receipt, then deletes the order", async ({ page, api }) => {
  const { po } = await api.createOrder();
  await api.receive(po, { "Denim jeans": 60 });
  const container = await api.load([{ po, item: "Denim jeans", quantity: 60, bundles: 6 }]);

  // The order is refused while it has them.
  await page.goto(`/orders/${po}`);
  await page.getByRole("button", { name: "Delete order" }).click();
  await page.getByRole("alertdialog", { name: "Delete order?" }).getByRole("button", { name: "Delete order" }).click();
  const orderRefused = page.getByRole("alertdialog", { name: "Can't delete order" });
  await expect(orderRefused).toContainText("This order has 1 receipt and 1 container, so it can't be deleted.");
  await orderRefused.getByRole("button", { name: "Close" }).click();

  // The receipt can't go first: its goods are in the container.
  await page.goto(`/orders/${po}/receiving`);
  await page.getByRole("button", { name: /^Delete receipt of / }).click();
  const askReceipt = page.getByRole("alertdialog", { name: "Delete Goods Receipt?" });
  await expect(askReceipt).toContainText("60 pcs Denim jeans");
  await askReceipt.getByRole("button", { name: "Delete receipt" }).click();
  const receiptRefused = page.getByRole("alertdialog", { name: "Can't delete receipt" });
  await expect(receiptRefused).toContainText(`container ${container.number} already holds 60 pcs of Denim jeans from it. Delete that container first.`);
  await receiptRefused.getByRole("button", { name: "Close" }).click();
  expect((await api.order(po)).receipts).toHaveLength(1);

  // The container: a double-click on Delete container sends one DELETE.
  await page.goto(`/orders/${po}/containers`);
  const deletes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") deletes.push(new URL(request.url()).pathname);
  });
  await page.getByRole("button", { name: `Delete container ${container.number}` }).click();
  const askContainer = page.getByRole("alertdialog", { name: "Delete Container?" });
  await expect(askContainer).toContainText(`${po} in it60 pcs Denim jeans · 6 bundles`);
  await askContainer.getByRole("button", { name: "Delete container" }).dblclick();
  await expect(toast(page, "Container deleted").first()).toBeVisible();
  await expect(page.getByText("Not loaded into a container yet.")).toBeVisible();
  expect(deletes).toEqual([`/api/v1/containers/${container.id}`]);
  expect((await api.order(po)).stage).toBe(2);

  // Then the receipt.
  await page.goto(`/orders/${po}/receiving`);
  await page.getByRole("button", { name: /^Delete receipt of / }).click();
  await page.getByRole("alertdialog", { name: "Delete Goods Receipt?" }).getByRole("button", { name: "Delete receipt" }).click();
  await expect(toast(page, "Receipt deleted").first()).toBeVisible();
  await expect(page.getByText("No receipts recorded yet.")).toBeVisible();
  expect((await api.order(po)).stage).toBe(1);

  // Then the order.
  await page.goto(`/orders/${po}`);
  await page.getByRole("button", { name: "Delete order" }).click();
  await page.getByRole("alertdialog", { name: "Delete order?" }).getByRole("button", { name: "Delete order" }).click();
  await expect(toast(page, "Order deleted").first()).toBeVisible();
  await expect(page).toHaveURL("/orders");
  expect((await api.request.get(`/api/v1/orders/${po}`)).status()).toBe(404);
});

test.describe("Procurement (receiving View, no containers)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("sees the receipts without Delete", async ({ page, api }) => {
    const { po } = await api.createOrder();
    await api.receive(po, { "Denim jeans": 40 });
    await page.goto(`/orders/${po}/receiving`);
    await expect(page.getByText("Receiving history")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  });
});
