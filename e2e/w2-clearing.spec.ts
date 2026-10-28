import { expect, test } from "@playwright/test";

// W2-clearing: Clearing (India) list (26_9.1) and the Stage 4 form (25_9). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("clearing list shows the KPIs, containers and totals and filters them on the client", async ({ page }) => {
  await page.goto("/clearing");
  await expect(page.getByRole("heading", { level: 1, name: "Clearing (India)" })).toBeVisible();
  for (const text of ["nothing waiting at port", "3.3 days", "port to cleared", "duty, taxes and charges"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(6);
  const caiu = table.getByRole("row", { name: /CAIU 2298076/ });
  for (const text of ["Kochi Clearing Services", "28 Sep", "BE-7710482", "PO-2028", "Cleared 1 Oct", "3 days", "₹3,70,500"]) {
    await expect(caiu).toContainText(text);
  }
  await expect(table.getByRole("row", { name: /HLXU 9034471/ })).toContainText("PO-2032, PO-2033");
  await expect(table.getByRole("row", { name: /Total, 4 containers/ })).toContainText("₹9,56,060");

  const chips = page.getByRole("group", { name: "Clearing status" });
  await chips.getByRole("button", { name: "Duty to pay" }).click();
  await expect(table.getByText("No containers match these filters.")).toBeVisible();
  await chips.getByRole("button", { name: "All" }).click();

  await page.getByRole("searchbox", { name: "Search container or PO" }).fill("po-2030");
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").nth(1)).toContainText("TCLU 6620148");
  await page.getByRole("searchbox", { name: "Search container or PO" }).fill("");

  await page.getByRole("button", { name: "Clearing agent: All agents" }).click();
  await page.getByRole("menuitemradio", { name: "Southern Port Agents" }).click();
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row", { name: /Total, 2 containers/ })).toContainText("₹2,99,560");

  await table.getByRole("button", { name: "MEDU 4470912" }).click();
  await expect(page.getByText("Clearing for MEDU 4470912 is not included in the current prototype.")).toBeVisible();

  await expect(page.getByRole("link", { name: "+ Record clearing" })).toHaveAttribute("href", "/clearing/CAIU-2298076");
  await page.getByRole("button", { name: "Clearing agent: Southern Port Agents" }).click();
  await page.getByRole("menuitemradio", { name: "All agents" }).click();
  await expect(table.getByRole("row")).toHaveCount(6);
  await table.getByRole("link", { name: "CAIU 2298076" }).click();
  await expect(page).toHaveURL(/\/clearing\/CAIU-2298076$/);
  await expect(page.getByRole("heading", { level: 1, name: "Container CAIU 2298076" })).toBeVisible();
});

test("clearing form recalculates the total clearing cost as charges change", async ({ page }) => {
  await page.goto("/clearing/CAIU-2298076");
  await expect(page.getByRole("heading", { level: 1, name: "Container CAIU 2298076" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/clearing");

  await expect(page.getByRole("combobox", { name: "Clearing agent" })).toHaveValue("Kochi Clearing Services");
  await expect(page.getByRole("textbox", { name: "Bill of entry no." })).toHaveValue("BE-7710482");
  const dutyPaid = page.getByRole("textbox", { name: "Duty paid on" });
  await expect(dutyPaid).toHaveValue("");
  await expect(dutyPaid).toHaveAttribute("placeholder", "Select date");
  const goodsValue = page.getByRole("textbox", { name: "Value of goods for duty" });
  await expect(goodsValue).toHaveValue("9,80,000");
  await expect(page.getByText("Waiting", { exact: true })).toBeVisible();
  await expect(page.getByText("Terms: CNF · Supplier: Guangzhou Textile Co.")).toBeVisible();
  // Total clearing cost and "Adds to landed cost".
  await expect(page.getByText("₹3,70,500", { exact: true })).toHaveCount(2);

  const port = page.getByRole("textbox", { name: "Port and terminal charges" });
  await port.fill("20000");
  await expect(port).toHaveValue("20,000");
  await expect(page.getByText("₹3,76,000", { exact: true })).toHaveCount(2);

  // The value of goods is not part of the clearing cost.
  await goodsValue.fill("1000000");
  await expect(goodsValue).toHaveValue("10,00,000");
  await expect(page.getByText("₹3,76,000", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Mark cleared, hand to transport" }).click();
  await expect(page.getByText("Mark cleared, hand to transport is not included in the current prototype.")).toBeVisible();
});

test("an unknown container shows the not-found page", async ({ page }) => {
  // Partial prerendering streams the shell first, so the HTTP status stays 200; assert the not-found UI instead.
  await page.goto("/clearing/MEDU-4470912");
  // The (app) not-found page added with the live five tabs.
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Container MEDU 4470912" })).toHaveCount(0);
});
