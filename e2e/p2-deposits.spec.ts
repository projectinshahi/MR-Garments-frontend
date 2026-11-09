import { type Api, cny, expect, kpi, longDate, test, today } from "./live-api";

// Deposits (docs/phase2-contracts.md section 3), against the live API as Management. Scenario 6: an order deposit on
// the Deposits page. Scenario 7: a supplier's deposits to give and to receive, partly settled, kept apart; the
// statement's export downloads. Role/label locators only (hidden <Activity> routes stay in the DOM); each test makes
// its own records and finds them by PO or by a supplier of its own.

test.use({ viewport: { width: 1440, height: 900 } });

/** A supplier of this test's own (MD-2), so its statement holds only what the test records. */
async function newSupplier(api: Api) {
  const name = `Deposit Test ${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
  const response = await api.post("/suppliers", { name, currency: "CNY" });
  expect(response.status(), await response.text()).toBe(201);
  const { supplier } = (await response.json()) as { supplier: { id: string; name: string } };
  return supplier;
}

test("Scenario 6: an order's partial deposit shows as Paid on the Deposits page, under All and Paid, not under Pending", async ({ page, api }) => {
  // ¥1,000 order with a ¥300 deposit, so the deposit is partial against the order value.
  const { po } = await api.createOrder({ deposits: [{ amountCny: 300, rateInr: 12 }] });

  await page.goto("/deposits");
  await expect(page.getByRole("heading", { level: 1, name: "Deposits" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search PO" }).fill(po);
  const row = page.getByRole("table").getByRole("row").filter({ hasText: po });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Order deposit");
  await expect(row).toContainText(cny(300));
  await expect(row.getByText("Paid", { exact: true })).toBeVisible();
  // Payables only: the ¥300 deposit is paid, nothing pending, nothing to receive.
  await expect(kpi(page, "Deposits to pay")).toContainText(`${cny(300)}1 deposit`);
  await expect(kpi(page, "Paid")).toContainText(cny(300));
  await expect(kpi(page, "Pending to pay")).toContainText(cny(0));
  await expect(kpi(page, "To receive")).toContainText("0 deposits");

  await page.getByRole("link", { name: "Paid" }).click();
  await page.getByRole("searchbox", { name: "Search PO" }).fill(po);
  await expect(page.getByRole("table").getByRole("row").filter({ hasText: po })).toHaveCount(1);

  await page.getByRole("link", { name: "Pending" }).click();
  await page.getByRole("searchbox", { name: "Search PO" }).fill(po);
  await expect(page.getByText("No deposits match these filters.")).toBeVisible();
});

test("Scenario 7: a deposit to give with a partial payment and one to receive with a partial receipt stay apart; the statement exports", async ({ page, api }) => {
  const supplier = await newSupplier(api);
  await page.goto(`/deposits/suppliers/${supplier.id}`);
  await expect(page.getByRole("heading", { level: 1, name: supplier.name })).toBeVisible();
  await expect(page.getByText(`No deposits with ${supplier.name} yet.`)).toBeVisible();

  // Open a ¥1,000 deposit to give through the dialog.
  await page.getByRole("button", { name: "+ New deposit" }).click();
  let dialog = page.getByRole("dialog", { name: `New deposit for ${supplier.name}` });
  await dialog.getByLabel(/^Direction/).selectOption("give");
  await dialog.getByLabel(/^Amount/).fill("1000");
  await dialog.getByLabel(/^Reference/).fill("Tooling advance");
  await dialog.getByRole("button", { name: "Open deposit" }).click();
  await expect(dialog).toBeHidden();
  const give = page.getByRole("article", { name: /^To give/ });
  await expect(give).toContainText("Open");

  // Pay ¥300 of it: the amount comes prefilled with the pending ¥1,000.
  await give.getByRole("button", { name: "Record payment" }).click();
  dialog = page.getByRole("dialog", { name: "Record payment" });
  await expect(dialog.getByLabel(/^Amount/)).toHaveValue("1000");
  await dialog.getByLabel(/^Amount/).fill("300");
  await dialog.getByLabel(/^Mode/).fill("Bank transfer");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();
  await expect(give).toContainText("Partly settled");
  await expect(give.getByRole("list", { name: "Payments" })).toContainText(`1. ${longDate(today())} · ${cny(300)} · Bank transfer`);

  // Open a ¥500 deposit to receive and receive ¥100 of it.
  await page.getByRole("button", { name: "+ New deposit" }).click();
  dialog = page.getByRole("dialog", { name: `New deposit for ${supplier.name}` });
  await dialog.getByLabel(/^Direction/).selectOption("receive");
  await dialog.getByLabel(/^Amount/).fill("500");
  await dialog.getByRole("button", { name: "Open deposit" }).click();
  await expect(dialog).toBeHidden();
  const receive = page.getByRole("article", { name: /^To receive/ });
  await receive.getByRole("button", { name: "Record receipt" }).click();
  dialog = page.getByRole("dialog", { name: "Record receipt" });
  await dialog.getByLabel(/^Amount/).fill("100");
  await dialog.getByLabel(/^Mode/).fill("Cash");
  await dialog.getByRole("button", { name: "Record receipt" }).click();
  await expect(dialog).toBeHidden();

  // Six figures, never netted: give 1,000 / 300 / 700; receive 500 / 100 / 400.
  await expect(kpi(page, "To give")).toContainText(cny(1000));
  await expect(kpi(page, "Given")).toContainText(cny(300));
  await expect(kpi(page, "Pending to give")).toContainText(cny(700));
  await expect(kpi(page, "To receive")).toContainText(cny(500));
  await expect(kpi(page, "Received")).toContainText(cny(100));
  await expect(kpi(page, "Pending to receive")).toContainText(cny(400));

  // The API refuses more than what is pending, under the field.
  await give.getByRole("button", { name: "Record payment" }).click();
  dialog = page.getByRole("dialog", { name: "Record payment" });
  await dialog.getByLabel(/^Amount/).fill("700.01");
  await dialog.getByLabel(/^Mode/).fill("Cash");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog.getByText("Only ¥700 left to settle.")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // The Suppliers tab shows the same six figures on the supplier's line; the Pending tab lists both deposits.
  await page.goto("/deposits/suppliers");
  const line = page.getByRole("table").getByRole("row").filter({ hasText: supplier.name });
  await expect(line.getByRole("cell")).toHaveText([supplier.name, cny(1000), cny(300), cny(700), cny(500), cny(100), cny(400), "Statement"]);
  await page.getByRole("link", { name: "Pending" }).click();
  await expect(page.getByRole("table").getByRole("row").filter({ hasText: supplier.name })).toHaveCount(2);

  // An export button downloads a file.
  await page.goto(`/deposits/suppliers/${supplier.id}`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/^supplier-deposits-deposit-test-\d{6}-\d{4}-\d{2}-\d{2}\.xlsx$/);

  // Leave nothing behind (the Suppliers tab pages by 10): each transaction (SD-4), each deposit (SD-5), then the supplier.
  const statement = await api.get<{ deposits: { id: string; transactions: { id: string }[] }[] }>(`/suppliers/${supplier.id}/deposits`);
  const remove = async (path: string) => expect((await api.request.delete(`/api/v1${path}`, { data: {} })).status(), path).toBe(204);
  for (const deposit of statement.deposits) {
    for (const transaction of deposit.transactions) await remove(`/supplier-deposit-transactions/${transaction.id}`);
    await remove(`/supplier-deposits/${deposit.id}`);
  }
  await remove(`/suppliers/${supplier.id}`);
});
