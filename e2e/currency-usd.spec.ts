import type { Page } from "@playwright/test";

import { amountCell, expect, field, kpi, kv, test, toast, today } from "./live-api";

// QA "Support USD, CNY and INR": one order in US dollars, end to end against the live API. It is placed on New order
// (15) for a seeded CNY supplier with the currency changed to USD, gets a deposit and a balance at their own typed INR
// rates, and then shows dollars on the order's tabs, Deposits & Payments and Payments per supplier, converted to INR only
// at those rates and never added to yuan. It leaves a USD order in the shared test database; the "Payments by order"
// checks elsewhere use amountCell for that.

test.use({ viewport: { width: 1440, height: 900 } });

const combo = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

test("a USD order is placed in dollars, paid at typed INR rates and shown in $ everywhere", async ({ page, api }) => {
  test.setTimeout(120_000);

  await test.step("New order: the supplier's currency is the default, changed to USD; labels and totals follow", async () => {
    await page.goto("/orders/new");
    await combo(page, "Supplier").selectOption({ label: "Yiwu Trims Ltd." });
    await expect(combo(page, "Currency")).toHaveValue("CNY");
    await combo(page, "Currency").selectOption("USD");
    await field(page, "Delivery date").fill(today(20));
    await combo(page, "Item, line 1").selectOption({ label: "Denim jeans" });
    await box(page, "Rate ($), line 1").fill("2.5");
    await box(page, "Quantity, line 1").fill("400");
    await expect(page.getByRole("status", { name: "Order total" })).toHaveText("$ 1,000.00");
    await page.getByRole("button", { name: "+ Add deposit" }).click();
    await box(page, "Amount ($), deposit 1").fill("300");
    await field(page, "Rate to INR").fill("88");
    await field(page, "Mode").fill("Wire");
    await expect(kv(page, "Deposits paid")).toHaveText("$ 300");
    await expect(kv(page, "Deposits in INR")).toHaveText("₹26,400");
    await expect(kv(page, "Balance to pay")).toHaveText("$ 700");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/orders\/PO-\d+$/);
  });
  const po = new URL(page.url()).pathname.split("/").pop()!;
  await expect(toast(page, `Order ${po} placed`)).toBeVisible();
  expect(await api.order(po)).toMatchObject({ currency: "USD", orderValueCny: 1000, paidCny: 300, paidInr: 26400, balanceCny: 700 });

  await test.step("Items tab: the order's currency and its rates in dollars", async () => {
    await page.goto(`/orders/${po}/items`);
    await expect(kv(page, "Currency")).toHaveText("$ US dollar");
    await expect(page.getByRole("cell", { name: "$2.50 / pcs" })).toBeVisible();
  });

  await test.step("Deposits & Payments: the $700 balance at 88.50 is ₹61,950; the row is in dollars", async () => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "+ Record payment", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Record payment" });
    await form.getByRole("combobox", { name: "Order", exact: true }).selectOption({ label: `${po} · Yiwu Trims Ltd.` });
    await form.getByRole("combobox", { name: "Kind", exact: true }).selectOption("Balance");
    await form.getByRole("textbox", { name: "Amount ($)", exact: true }).fill("700");
    await form.getByRole("textbox", { name: "Rate (₹ per $)", exact: true }).fill("88.5");
    await expect(form.getByRole("status")).toHaveText("₹61,950");
    await form.getByRole("textbox", { name: "Mode", exact: true }).fill("Wire");
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(page, `Payment recorded for ${po}`)).toBeVisible();

    await page.getByRole("searchbox", { name: "Search PO or supplier" }).fill(po);
    const row = page.getByRole("table").getByRole("row").filter({ hasText: po });
    await expect(row.getByRole("cell")).toHaveText([
      `${po}Yiwu Trims Ltd.`,
      amountCell("1,000", "$"),
      amountCell("1,000", "$"),
      "₹88,350",
      amountCell("0", "$"),
      "Not yet due",
      // Management (payments Full): the Delete menu of the order's payments.
      "Delete",
    ]);
  });

  await test.step("The order's payments tab: dollars, each payment changed to INR at its own rate", async () => {
    await page.goto(`/orders/${po}/payments`);
    await expect(kpi(page, "Order value")).toContainText("$1,000");
    await expect(kpi(page, "Paid to supplier")).toContainText("$1,000");
    await expect(kpi(page, "Balance to supplier")).toContainText("Fully paid");
    await expect(kv(page, "Paid to supplier in INR")).toHaveText("₹88,350");
  });

  await test.step("Payments per supplier: a USD row of its own, never added to the yuan figures", async () => {
    await page.goto("/reports/payments-per-supplier");
    await expect(page.getByRole("table").getByRole("row").filter({ hasText: po })).toContainText("$1,000");
    await expect(kpi(page, "Order value")).toContainText("$1,000");
  });
});
