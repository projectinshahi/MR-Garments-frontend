import { expect, test, type Page } from "@playwright/test";

// W1-calendar: Delivery Calendar Month / Week / List (18_6.a_Month, 19_6.b_Week, 20_6.c_List).
// Role/label locators only: visited routes stay in the DOM hidden by <Activity>.

test.use({ viewport: { width: 1440, height: 900 } });

const toast = (page: Page, action: string) => page.getByText(`${action} is not included in the current prototype.`);

async function expectTab(page: Page, label: string) {
  await expect(page.getByRole("heading", { level: 1, name: "Delivery Calendar" })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Calendar views" });
  await expect(tabs.getByRole("link")).toHaveText(["aMonth", "bWeek", "cList"]);
  await expect(tabs.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
}

test("month view shows October 2026 with PO chips and the side cards", async ({ page }) => {
  await page.goto("/calendar");
  await expectTab(page, "Month");
  await expect(page.getByText("Today, 30 Sep 2026")).toBeVisible();

  const grid = page.getByRole("table", { name: "October 2026" });
  await expect(grid.getByRole("columnheader")).toHaveText(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  await expect(grid.getByRole("cell")).toHaveCount(35);
  await expect(grid.getByRole("button", { name: /^PO-/ })).toHaveCount(14);
  await expect(grid.getByRole("cell").nth(3)).toContainText("1 Oct2 deliveriesPO-2047PO-2053");
  await expect(grid.getByRole("cell").nth(34)).toHaveText("1 Nov");

  const chart = page.getByRole("figure", { name: "Deliveries per day, next 7 days" });
  await expect(chart).toBeVisible();
  // All seven day labels, at the side card's 11 px size (two used to be dropped as overlapping).
  for (const day of ["Thu 1", "Fri 2", "Sat 3", "Sun 4", "Mon 5", "Tue 6", "Wed 7"]) {
    await expect(chart.getByText(day, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("list", { name: "Late deliveries" }).getByRole("listitem")).toHaveText([
    /PO-2041Guangzhou Textile Co\. · due 26 Sep4 days/,
    /PO-2038Yiwu Trims Ltd\. · due 27 Sep3 days/,
    /PO-2044Shenzhen Apparel · due 29 Sep1 day/,
  ]);
  await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();

  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(toast(page, "Previous month")).toBeVisible();
  await grid.getByRole("button", { name: "PO-2047" }).click();
  await expect(toast(page, "Order PO-2047")).toBeVisible();
});

test("week view shows the late banner, today's column and the delivery cards", async ({ page }) => {
  await page.goto("/calendar/week");
  await expectTab(page, "Week");
  await expect(page.getByText("PO-2041 Guangzhou Textile Co. (due 26 Sep, 4 days late) · PO-2038")).toHaveText(
    "Late from before this week: PO-2041 Guangzhou Textile Co. (due 26 Sep, 4 days late) · PO-2038 Yiwu Trims Ltd. (due 27 Sep, 3 days late)",
  );

  const week = page.getByRole("table", { name: "28 Sep – 4 Oct 2026" });
  await expect(week.getByRole("columnheader")).toHaveText([
    "Mon 28 Sep", "Tue 29 Sep", "Wed 30 Sep · Today", "Thu 1 Oct", "Fri 2 Oct", "Sat 3 Oct", "Sun 4 Oct",
  ]);
  await expect(week.getByRole("cell").filter({ hasText: "No deliveries" })).toHaveCount(3);
  const thursday = week.getByRole("cell").nth(3);
  await expect(thursday.getByRole("listitem")).toHaveText([
    "PO-2047Guangzhou Textile Co.Ladies leggings · 2,000 pcsDue in 1 day",
    "PO-2053Yiwu Trims Ltd.Labels and tags · 15,000 pcsDue in 1 day",
  ]);

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(toast(page, "Next week")).toBeVisible();
});

test("list view filters its 16 deliveries with the status chips", async ({ page }) => {
  await page.goto("/calendar/list");
  await expectTab(page, "List");

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(17);
  await expect(table.getByRole("row", { name: /PO-2038/ })).toContainText("30,000 sets");
  await expect(table.getByRole("row", { name: /PO-2050/ })).toContainText("On track");

  const chips = page.getByRole("group", { name: "Delivery status" });
  await expect(chips.getByRole("button")).toHaveText(["All (16)", "Late (3)", "Due within 2 days (3)", "On track (10)"]);
  await chips.getByRole("button", { name: "Late (3)" }).click();
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row", { name: /PO-2044/ })).toContainText("1 day late");
  await chips.getByRole("button", { name: "Due within 2 days (3)" }).click();
  await expect(table.getByRole("row")).toHaveCount(4);
  await chips.getByRole("button", { name: "On track (10)" }).click();
  await expect(table.getByRole("row")).toHaveCount(11);
  await chips.getByRole("button", { name: "All (16)" }).click();
  await expect(table.getByRole("row")).toHaveCount(17);
});

test("supplier and date-range filters are not in the prototype (D5)", async ({ page }) => {
  await page.goto("/calendar/list");
  await page.getByRole("button", { name: "Supplier: All suppliers" }).first().click();
  await page.getByRole("menuitemradio", { name: "Foshan Fabrics" }).click();
  await expect(toast(page, "Filter by supplier")).toBeVisible();
  await expect(page.getByRole("button", { name: "Supplier: All suppliers" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Date range: Next 30 days" })).toBeVisible();
});
