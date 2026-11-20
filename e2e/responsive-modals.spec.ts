import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./live-api";

// Every dialog fits the screen (DialogContent in src/components/ui/dialog.tsx): never taller than the viewport, the
// body scrolls inside, the Close button and the footer actions stay on screen, nothing is clipped or scrolls sideways,
// and the page behind doesn't scroll. Representative short, medium and long dialogs at six screen sizes. Screenshots
// go to MODAL_SHOTS (default .visual/responsive-modals, git-ignored).

const SHOTS = process.env.MODAL_SHOTS ?? ".visual/responsive-modals";
const VIEWPORTS = [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
  [768, 1024],
  [390, 844],
  [360, 800],
] as const;

/** Whether the element at the centre of `locator` is the control itself (not the sticky footer or anything else). */
const onTop = (locator: Locator) =>
  locator.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === element || element.contains(hit));
  });

async function inViewport(page: Page, locator: Locator, what: string) {
  const { width, height } = page.viewportSize()!;
  const box = (await locator.boundingBox())!;
  expect(box, what).toBeTruthy();
  expect(box.x, `${what} left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${what} top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${what} right`).toBeLessThanOrEqual(width + 0.5);
  expect(box.y + box.height, `${what} bottom`).toBeLessThanOrEqual(height + 0.5);
}

/** The checks, with screenshots of the dialog scrolled to the top and to the bottom. */
async function checkDialog(page: Page, dialog: Locator, name: string, actions: string[]) {
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(250); // the open animation (zoom-in) is over
  const { width, height } = page.viewportSize()!;
  const body = dialog.locator('[data-slot="dialog-body"]');
  await inViewport(page, dialog, `${name} dialog`);

  // The page behind is locked, and the dialog doesn't scroll sideways (wide tables scroll inside their own box). The
  // page's own width is its business: /payments is 821 px wide at 768 px with or without a dialog.
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(4, height - 4); // the overlay, outside the dialog
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollY), "page behind scrolled").toBe(before);
  expect(await body.evaluate((el) => el.scrollWidth - el.clientWidth), "dialog body scrolls sideways").toBeLessThanOrEqual(0);

  const top = async () => {
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    if (await close.count()) {
      await inViewport(page, close, `${name} Close`);
      expect(await onTop(close), `${name} Close covered`).toBe(true);
    }
    for (const label of actions) {
      const button = dialog.getByRole("button", { name: label, exact: true });
      await inViewport(page, button, `${name} ${label}`);
      expect(await onTop(button), `${name} ${label} covered`).toBe(true);
    }
  };
  await top();
  const tag = `${name}-${width}x${height}`;
  await page.screenshot({ path: `${SHOTS}/${tag}-top.png` });

  // Every control can be reached: focusing it scrolls it into view, clear of the sticky footer.
  const controls = body.locator("input:not([type=hidden]), select, textarea, button, a[href]").filter({ visible: true });
  for (const control of await controls.all()) {
    await control.focus();
    const label = (await control.getAttribute("aria-label")) ?? (await control.getAttribute("id")) ?? (await control.textContent());
    await inViewport(page, control, `${name} control ${label}`);
    expect(await onTop(control), `${name} control ${label} covered`).toBe(true);
  }

  // Scrolled to the end: the last content sits above the footer, and the actions are still there.
  const scrolls = await body.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollHeight > el.clientHeight;
  });
  await page.waitForTimeout(100);
  await top();
  if (scrolls) await page.screenshot({ path: `${SHOTS}/${tag}-bottom.png` });
  return scrolls;
}

for (const [width, height] of VIEWPORTS) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("Add supplier (long form): fits, scrolls, Save and Close reachable; Cancel still closes", async ({ page }) => {
      await page.goto("/settings/suppliers");
      await page.getByRole("link", { name: "+ Add supplier" }).click();
      const dialog = page.getByRole("dialog", { name: "Add supplier" });
      const scrolls = await checkDialog(page, dialog, "add-supplier", ["Cancel", "Save supplier"]);
      if (height <= 768 || width <= 390) expect(scrolls, "Add supplier taller than the screen scrolls").toBe(true);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    test("Delete supplier? (short confirmation): fits, Cancel and Delete reachable", async ({ page }) => {
      await page.goto("/settings/suppliers");
      await page.getByRole("button", { name: /^Delete / }).first().click();
      const dialog = page.getByRole("alertdialog", { name: "Delete supplier?" });
      await checkDialog(page, dialog, "delete-supplier", ["Cancel", "Delete supplier"]);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    test("Record payment (medium form): fits, Record payment reachable; Close closes", async ({ page }) => {
      await page.goto("/payments");
      await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Record payment" });
      // The full supplier payment form: a supplier chosen, so the currency, rate and balance lines show too.
      const supplier = (await page.request.get("/api/v1/supplier-advances/suppliers").then((r) => r.json()) as { suppliers: { name: string }[] }).suppliers[0]!.name;
      await dialog.getByRole("combobox", { name: "Supplier", exact: true }).fill(supplier);
      await checkDialog(page, dialog, "record-payment", ["Cancel", "Record payment"]);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    test("Edit order with every item (long form with a table): fits, scrolls, Save reachable", async ({ page, api }) => {
      const items = (await api.options()).items;
      const { po } = await api.createOrder({ lines: items.map((item, i) => ({ item: item.name, quantity: 10 + i, rateCny: 5 })) });
      await page.goto(`/orders/${po}`);
      await page.getByRole("button", { name: "Edit order" }).click();
      const dialog = page.getByRole("dialog", { name: "Edit order" });
      const scrolls = await checkDialog(page, dialog, "edit-order", ["Cancel", "Save order"]);
      if (height <= 844) expect(scrolls, "Edit order with every item scrolls").toBe(true);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toBeHidden();
    });
  });
}
