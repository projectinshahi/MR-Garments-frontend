import type { Page } from "@playwright/test";

import { addDays, ANITA, expect, freshSignIn, monthTitle, shortDate, test, today } from "./live-api";
import { PROCUREMENT_STATE, STAFF_STATE } from "./sessions";

// Delivery calendar (18 Month, 19 Week, 20 List) against CAL-1. The month and week tests use a random far-future year
// that no other spec books deliveries in, so their empty periods are truthful. No spec books a late Yiwu Trims Ltd.
// delivery, so that supplier with the Late chip is truthfully empty. Role/label locators only (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const YEAR = 2040 + Math.floor(Math.random() * 50);
const views = (page: Page) => page.getByRole("navigation", { name: "Calendar views" });
const listRows = (page: Page) => page.getByRole("table").getByRole("row");

async function chooseSupplier(page: Page, current: string, option: string) {
  await page.getByRole("button", { name: `Supplier: ${current}` }).click();
  await page.getByRole("menuitemradio", { name: option, exact: true }).click();
}

/** Monday of the week holding `iso`. */
const mondayOf = (iso: string) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
const weekTitle = (monday: string) => `${shortDate(monday)} – ${shortDate(addDays(monday, 6))} ${addDays(monday, 6).slice(0, 4)}`;

test("Month: deliveries on their day, ‹ › and Today, the supplier filter, empty months and PO links", async ({ page, api }) => {
  const march = `${YEAR}-03-10`;
  const foshan = await api.createOrder({ supplier: "Foshan Fabrics", deliveryDate: march });
  const yiwu = await api.createOrder({ supplier: "Yiwu Trims Ltd.", deliveryDate: march });
  const april = await api.createOrder({ supplier: "Foshan Fabrics", deliveryDate: `${YEAR}-04-20` });

  await page.goto(`/calendar?month=${YEAR}-03`);
  await expect(page.getByRole("heading", { level: 1, name: "Delivery Calendar" })).toBeVisible();
  await expect(views(page).getByRole("link", { name: "Month" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: `March ${YEAR}` })).toBeVisible();
  const grid = page.getByRole("table", { name: `March ${YEAR}` });
  const day = grid.getByRole("cell").filter({ has: page.getByRole("link", { name: foshan.po }) });
  await expect(day.getByRole("link")).toHaveCount(2);
  await expect(day.getByRole("link", { name: yiwu.po })).toBeVisible();
  await expect(day).toContainText("2 deliveries");
  await expect(grid.getByRole("link", { name: april.po })).toHaveCount(0);

  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page).toHaveURL(`/calendar?month=${YEAR}-04`);
  await expect(page.getByRole("table", { name: `April ${YEAR}` }).getByRole("link", { name: april.po })).toBeVisible();

  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(`/calendar?month=${YEAR}-03`);
  await expect(page.getByRole("heading", { level: 2, name: `March ${YEAR}` })).toBeVisible();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(`/calendar?month=${YEAR}-02`);
  await expect(page.getByText("No deliveries this month.")).toBeVisible();

  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL("/calendar");
  await expect(page.getByRole("heading", { level: 2, name: monthTitle(today()) })).toBeVisible();

  // Supplier filter (kept in the URL with the month).
  await page.goto(`/calendar?month=${YEAR}-03`);
  await chooseSupplier(page, "All suppliers", "Yiwu Trims Ltd.");
  await expect(page).toHaveURL(`/calendar?month=${YEAR}-03&supplier=Yiwu+Trims+Ltd.`);
  await expect(page.getByRole("table", { name: `March ${YEAR}` }).getByRole("link")).toHaveText([yiwu.po]);
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page).toHaveURL(`/calendar?month=${YEAR}-04&supplier=Yiwu+Trims+Ltd.`);
  await expect(page.getByText("No deliveries from Yiwu Trims Ltd. this month.")).toBeVisible();
  await chooseSupplier(page, "Yiwu Trims Ltd.", "All suppliers");
  await expect(page).toHaveURL(`/calendar?month=${YEAR}-04`);

  // A far-future month nobody delivers in.
  await page.goto(`/calendar?month=${YEAR + 1}-12`);
  await expect(page.getByText("No deliveries this month.")).toBeVisible();

  // The PO opens the order.
  await page.goto(`/calendar?month=${YEAR}-03`);
  await page.getByRole("table", { name: `March ${YEAR}` }).getByRole("link", { name: yiwu.po }).click();
  await expect(page).toHaveURL(`/orders/${yiwu.po}`);
});

test("Month: a busy day makes its week taller, so its chips stay in its cell and each opens its order", async ({ page, api }) => {
  const due = `${YEAR}-05-13`;
  const orders = [];
  for (let i = 0; i < 7; i++) orders.push(await api.createOrder({ supplier: "Yiwu Trims Ltd.", deliveryDate: due }));

  await page.goto(`/calendar?month=${YEAR}-05`);
  const day = page.getByRole("table", { name: `May ${YEAR}` }).getByRole("cell").filter({ has: page.getByRole("link", { name: orders[0]!.po }) });
  const cell = (await day.boundingBox())!;
  for (const { po } of orders) {
    const chip = (await day.getByRole("link", { name: po }).boundingBox())!;
    expect(chip.y + chip.height, po).toBeLessThanOrEqual(cell.y + cell.height);
  }
  const last = orders.at(-1)!;
  await day.getByRole("link", { name: last.po }).click();
  await expect(page).toHaveURL(`/orders/${last.po}`);
});

test("Week: delivery cards, ‹ › and Today, an empty week, the late banner and the Month late card", async ({ page, api }) => {
  const due = `${YEAR}-06-17`;
  const order = await api.createOrder({ supplier: "Yiwu Trims Ltd.", lines: [{ item: "Kids t-shirts", quantity: 600, rateCny: 3 }], deliveryDate: due });
  const monday = mondayOf(due);

  await page.goto(`/calendar/week?week=${due}`);
  await expect(views(page).getByRole("link", { name: "Week" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: weekTitle(monday) })).toBeVisible();
  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: order.po }) });
  for (const text of ["Yiwu Trims Ltd.", "Kids t-shirts · 600 pcs", "On track"]) await expect(card).toContainText(text);

  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(`/calendar/week?week=${addDays(monday, 7)}`);
  await expect(page.getByRole("heading", { level: 2, name: weekTitle(addDays(monday, 7)) })).toBeVisible();
  await expect(page.getByText("No deliveries this week.")).toBeVisible();
  await expect(page.getByText("No deliveries", { exact: true }).filter({ visible: true })).toHaveCount(7);

  await page.getByRole("link", { name: "Previous week" }).click();
  await expect(page).toHaveURL(`/calendar/week?week=${monday}`);
  await expect(page.getByRole("link", { name: order.po })).toBeVisible();

  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL("/calendar/week");
  await expect(page.getByRole("heading", { level: 2, name: weekTitle(mondayOf(today())) })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /· Today/ })).toBeVisible();

  // A delivery due before this week shows in the late banner (Week) and the late card (Month).
  const late = await api.createOrder({ orderDate: today(-30), deliveryDate: today(-10) });
  const older = await api.createOrder({ orderDate: today(-60), deliveryDate: today(-45) }); // always an earlier month
  await page.reload();
  await expect(page.getByText("Late from before this week:")).toBeVisible();
  await expect(page.getByText(`${late.po} Foshan Fabrics (due ${shortDate(today(-10))}, 10 days late)`)).toBeVisible();
  await page.goto("/calendar");
  const lateCard = page.getByRole("list", { name: "Late deliveries" }).getByRole("listitem").filter({ has: page.getByRole("link", { name: late.po }) });
  await expect(lateCard).toContainText(`Foshan Fabrics · due ${shortDate(today(-10))}`);
  await expect(lateCard).toContainText("10 days");

  // Today's month lists every delivery still late; any other month only its own late ones (DEF-12).
  const lateList = page.getByRole("list", { name: "Late deliveries" });
  await expect(lateList.getByRole("link", { name: older.po })).toBeVisible();
  await page.goto(`/calendar?month=${today(-45).slice(0, 7)}`);
  await expect(lateList.getByRole("link", { name: older.po })).toBeVisible();
  await expect(lateList.getByRole("link", { name: late.po })).toHaveCount(0);
  await page.goto(`/calendar?month=${YEAR}-06`);
  await expect(page.getByText("No late deliveries.")).toBeVisible();
});

test("List: date range, status chips, supplier filter carried across views, and PO links", async ({ page, api }) => {
  const late = await api.createOrder({ orderDate: today(-20), deliveryDate: today(-4), lines: [{ item: "Men's shorts", quantity: 120, rateCny: 9 }] });
  const soon = await api.createOrder({ deliveryDate: today(3) });
  const month = await api.createOrder({ deliveryDate: today(20) });
  const far = await api.createOrder({ supplier: "Yiwu Trims Ltd.", deliveryDate: `${YEAR}-09-09` });

  await page.goto("/calendar/list");
  await expect(views(page).getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "page");
  const row = (po: string) => listRows(page).filter({ hasText: po });
  await expect(row(late.po).getByRole("cell")).toHaveText([shortDate(today(-4)), late.po, "Foshan Fabrics", "Men's shorts", "120 pcs", "4 days late"]);
  await expect(row(soon.po)).toContainText("Due in 3 days");
  await expect(row(month.po)).toContainText("On track");
  await expect(row(far.po)).toContainText(shortDate(`${YEAR}-09-09`));

  // Date range (in the URL).
  await page.getByRole("button", { name: "Date range: All dates" }).click();
  await page.getByRole("menuitemradio", { name: "Next 7 days" }).click();
  await expect(page).toHaveURL("/calendar/list?range=next-7");
  await expect(row(soon.po)).toBeVisible();
  for (const po of [late.po, month.po, far.po]) await expect(row(po)).toHaveCount(0);
  await page.getByRole("button", { name: "Date range: Next 7 days" }).click();
  await page.getByRole("menuitemradio", { name: "Next 30 days" }).click();
  await expect(page).toHaveURL("/calendar/list?range=next-30");
  await expect(row(month.po)).toBeVisible();
  await expect(row(far.po)).toHaveCount(0);
  await page.getByRole("button", { name: "Date range: Next 30 days" }).click();
  await page.getByRole("menuitemradio", { name: "All dates" }).click();
  await expect(page).toHaveURL("/calendar/list");

  // Status chips, with counts that match the rows.
  const chips = page.getByRole("group", { name: "Delivery status" });
  for (const [label, member, other] of [
    ["Late", late, soon],
    ["Due within 7 days", soon, late],
    ["On track", month, soon],
  ] as const) {
    const chip = chips.getByRole("button", { name: new RegExp(`^${label} \\(\\d+\\)$`) });
    const count = Number((await chip.textContent())!.match(/\((\d+)\)/)![1]);
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(listRows(page)).toHaveCount(count + 1);
    await expect(row(member.po)).toBeVisible();
    await expect(row(other.po)).toHaveCount(0);
  }
  await chips.getByRole("button", { name: /^All \(\d+\)$/ }).click();

  // The header supplier filter applies here too, and the view tabs carry it.
  await chooseSupplier(page, "All suppliers", "Yiwu Trims Ltd.");
  await expect(page).toHaveURL("/calendar/list?supplier=Yiwu+Trims+Ltd.");
  await expect(row(far.po)).toBeVisible();
  await expect(row(late.po)).toHaveCount(0);
  // No spec books a late Yiwu Trims delivery.
  await chips.getByRole("button", { name: /^Late \(0\)$/ }).click();
  await expect(page.getByText("No deliveries match these filters.")).toBeVisible();
  await views(page).getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL("/calendar/week?supplier=Yiwu+Trims+Ltd.");
  await expect(page.getByRole("button", { name: "Supplier: Yiwu Trims Ltd." })).toBeVisible();
  // Yiwu Trims deliveries are booked 30+ days out or in far-future years, so none falls in this week.
  await expect(page.getByText("No deliveries from Yiwu Trims Ltd. this week.")).toBeVisible();

  // The PO opens the order.
  await page.goto("/calendar/list");
  await row(soon.po).getByRole("link", { name: soon.po }).click();
  await expect(page).toHaveURL(`/orders/${soon.po}`);
});

test("a partly received order stays on the calendar; it leaves once fully received or loaded into a container", async ({ page, api }) => {
  const order = await api.createOrder({ deliveryDate: today(5) });
  const late = await api.createOrder({ orderDate: today(-20), deliveryDate: today(-3) });
  const twoLines = await api.createOrder({
    deliveryDate: today(6),
    lines: [
      { item: "Denim jeans", quantity: 100, rateCny: 10 },
      { item: "Kids t-shirts", quantity: 50, rateCny: 3 },
    ],
  });
  const row = (po: string) => listRows(page).filter({ hasText: po });
  await page.goto("/calendar/list");
  await expect(row(order.po)).toBeVisible();

  await api.receive(order.po, { "Denim jeans": 40 });
  await api.receive(late.po, { "Denim jeans": 40 });
  await api.receive(twoLines.po, { "Denim jeans": 100 }); // the main line in full, the t-shirts still awaited
  await page.reload();
  await expect(row(order.po)).toContainText("Due in 5 days"); // stage 2, 60 pcs still awaited
  await expect(row(late.po)).toContainText("3 days late");
  await expect(row(twoLines.po)).toContainText("Due in 6 days");

  // The rest arrives: nothing is awaited from the supplier any more, although the order is still at stage 2.
  await api.receive(order.po, { "Denim jeans": 60 }, { shortRemark: "" });
  await api.load([{ po: late.po, item: "Denim jeans", quantity: 40 }]);
  await api.receive(twoLines.po, { "Kids t-shirts": 50 }, { shortRemark: "" });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Delivery Calendar" })).toBeVisible();
  await expect(row(order.po)).toHaveCount(0);
  await expect(row(late.po)).toHaveCount(0); // stage 3
  await expect(row(twoLines.po)).toHaveCount(0);
  await page.goto(`/calendar?month=${today(5).slice(0, 7)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Delivery Calendar" })).toBeVisible();
  await expect(page.getByRole("link", { name: order.po })).toHaveCount(0);
});

test.describe("Procurement (calendar Full)", () => {
  test.use({ storageState: PROCUREMENT_STATE });

  test("opens the calendar with PO links", async ({ page, api }) => {
    const order = await api.createOrder({ deliveryDate: today(6) });
    await page.goto("/calendar/list");
    await expect(listRows(page).filter({ hasText: order.po }).getByRole("link", { name: order.po })).toHaveAttribute("href", `/orders/${order.po}`);
  });
});

test.describe("Accounts (no calendar access)", () => {
  test.use({ storageState: freshSignIn(ANITA) });

  test("the calendar goes to the dashboard", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL("/");
  });
});

test.describe("China staff (no calendar access)", () => {
  test.use({ storageState: STAFF_STATE });

  test("the calendar goes to the staff home", async ({ page }) => {
    await page.goto("/calendar/list");
    await expect(page).toHaveURL("/home");
  });
});
