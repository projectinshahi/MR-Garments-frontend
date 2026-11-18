import type { Page, TestInfo } from "@playwright/test";

import type { ContainerListItem } from "../src/lib/api/types";
import { containerNumber, expect, field, test, toast, today } from "./live-api";

// Container terms are chosen on the order (backend docs/order-container-terms.md): New order asks for them, Edit order
// changes them until a container holds the order, the Orders table shows them, and Load container takes them from the
// orders loaded (nothing to choose there), refusing orders with different terms. Screenshots go to SHOTS_DIR when set.

const out = (testInfo: TestInfo, name: string) => (process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${name}` : testInfo.outputPath(name));
const shot = (page: Page, testInfo: TestInfo, name: string, fullPage = true) => page.screenshot({ path: out(testInfo, name), fullPage });
const combo = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const settled = (page: Page) =>
  page.getByRole("dialog").evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
const termsCell = async (page: Page, po: string) => {
  const headers = await page.getByRole("columnheader").allTextContents();
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: po, exact: true }) })
    .getByRole("cell")
    .nth(headers.findIndex((header) => header === "Terms"));
};

test("terms chosen on New order and Edit order show on Orders and fill the container; mixed terms are refused", async ({ page, api }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  let po = "";

  await test.step("New order asks for the container terms (no default) and saves them", async () => {
    await page.goto("/orders/new");
    po = await box(page, "Purchase order no.").inputValue();
    await combo(page, "Supplier").selectOption({ label: "Foshan Fabrics" });
    await field(page, "Delivery date").fill(today(20));
    await combo(page, "Item, line 1").selectOption({ label: "Denim jeans" });
    await box(page, "Rate (¥), line 1").fill("12.5");
    await box(page, "Quantity, line 1").fill("100");
    await expect(combo(page, "Container terms")).toHaveValue("");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByText("Choose the container terms: FOB or CNF.")).toBeVisible();
    await combo(page, "Container terms").selectOption("CNF");
    await shot(page, testInfo, "new-order-terms-1440.png");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(`/orders/${po}`);
    expect((await api.order(po)).terms).toBe("CNF");
  });

  await test.step("Edit order shows them and changes them while no container holds the order", async () => {
    await page.getByRole("button", { name: "Edit order" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit order" });
    await expect(combo(page, "Container terms")).toHaveValue("CNF");
    await combo(page, "Container terms").selectOption("FOB");
    await settled(page);
    await shot(page, testInfo, "edit-order-terms-1440.png", false);
    const patch = page.waitForRequest((request) => request.method() === "PATCH" && request.url().endsWith(`/api/v1/orders/${po}`));
    await dialog.getByRole("button", { name: "Save order" }).click();
    expect((await patch).postDataJSON()).toEqual({ terms: "FOB" });
    await expect(toast(page, "Order saved")).toBeVisible();
    expect((await api.order(po)).terms).toBe("FOB");
  });

  const cnf = await api.createOrder({ lines: [{ item: "Polo shirts", quantity: 50, rateCny: 8 }], terms: "CNF" });
  const older = await api.createOrder({ lines: [{ item: "Track pants", quantity: 30, rateCny: 6 }] });
  await api.receive(po, { "Denim jeans": 100 });
  await api.receive(cnf.po, { "Polo shirts": 50 });

  await test.step("the Orders table shows each order's terms (a dash while not set)", async () => {
    await page.goto("/orders");
    await expect(page.getByRole("columnheader", { name: "Terms" })).toBeVisible();
    await expect(await termsCell(page, po)).toHaveText("FOB");
    await expect(await termsCell(page, cnf.po)).toHaveText("CNF");
    await expect(await termsCell(page, older.po)).toContainText("–");
    // The extra column keeps the table inside the page at 1440 px: Paid so far is in view, no sideways scroll.
    const paid = await page.getByRole("columnheader", { name: "Paid so far (INR)" }).boundingBox();
    expect(paid!.x + paid!.width).toBeLessThanOrEqual(1440 - 32);
    await shot(page, testInfo, "orders-terms-1440.png");
  });

  const number = containerNumber();
  await test.step("Load container: no terms to choose; the orders' terms fill the container's; a mix is refused", async () => {
    await page.goto("/containers/new");
    await expect(combo(page, "Container terms")).toHaveCount(0);
    await expect(box(page, "Container terms")).toHaveValue("");
    await expect(page.getByRole("row").filter({ hasText: po })).toContainText("FOB");
    await expect(page.getByRole("row").filter({ hasText: cnf.po })).toContainText("CNF");
    await box(page, "Container number").fill(number);
    await combo(page, "Shipping agent").selectOption({ label: "Sino Freight" });
    await field(page, "Expected arrival in India (ETA)").fill(today(21));
    await box(page, `Quantity, ${po} Denim jeans`).fill("100");
    await expect(box(page, "Container terms")).toHaveValue("FOB");
    await expect(page.getByText(`From ${po}.`)).toBeVisible();
    await shot(page, testInfo, "load-container-terms-1440.png");

    await box(page, `Quantity, ${cnf.po} Polo shirts`).fill("50");
    await expect(box(page, "Container terms")).toHaveValue("Different terms");
    await page.getByRole("button", { name: "Save container" }).click();
    await expect(page.getByText(`${po} is FOB and ${cnf.po} is CNF: one container holds orders with the same container terms.`)).toBeVisible();
    await shot(page, testInfo, "load-container-mixed-terms-1440.png");
    await box(page, `Quantity, ${cnf.po} Polo shirts`).fill("");
    await page.getByRole("button", { name: "Save container" }).click();
    await expect(page).toHaveURL("/containers");
    const saved = (await api.get<ContainerListItem[]>("/containers")).find((c) => c.number === number)!;
    expect(saved.terms).toBe("FOB");
  });

  await test.step("once loaded, the order's terms are fixed in Edit order", async () => {
    await page.goto(`/orders/${po}`);
    await page.getByRole("button", { name: "Edit order" }).click();
    await expect(combo(page, "Container terms")).toHaveCount(0);
    await expect(box(page, "Container terms")).toHaveValue("FOB");
    await expect(page.getByText("A container already holds this order, so its container terms are fixed.")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await test.step("phone: New order, Orders and Load container fit the screen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [path, name] of [
      ["/orders/new", "new-order-terms-390.png"],
      ["/orders", "orders-terms-390.png"],
      ["/containers/new", "load-container-terms-390.png"],
    ] as const) {
      await page.goto(path);
      if (path === "/orders/new") await combo(page, "Container terms").selectOption("FOB");
      if (path === "/containers/new") await box(page, `Quantity, ${cnf.po} Polo shirts`).fill("50");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
      await shot(page, testInfo, name);
    }
    await expect(box(page, "Container terms")).toHaveValue("CNF");
  });
});
