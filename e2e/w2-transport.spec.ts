import { expect, test } from "@playwright/test";

// W2-transport: Transport list (28_10.1) and the Stage 5 form for CAIU 2298076 (27_10). Role/label locators only
// (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

test("transport list shows the KPIs, vehicles and totals and filters them on the client", async ({ page }) => {
  await page.goto("/transport");
  await expect(page.getByRole("heading", { level: 1, name: "Transport" })).toBeVisible();
  for (const text of ["no vehicle on the road", "all counts matched", "freight, loading, unloading"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("316", { exact: true })).toBeVisible();

  const table = page.getByRole("table");
  // Header, four vehicles, totals.
  await expect(table.getByRole("row")).toHaveCount(6);
  const first = table.getByRole("row").nth(1);
  for (const text of ["KL 07 CD 4821", "LR-558214", "Kerala Roadways", "CAIU 2298076", "PO-2028", "1 Oct", "3 Oct", "50 of 50", "₹26,500"]) {
    await expect(first).toContainText(text);
  }
  const totals = table.getByRole("row").last();
  await expect(totals).toContainText("Total, 4 vehicles");
  await expect(totals).toContainText("₹1,07,500");

  const status = page.getByRole("group", { name: "Transport status" });
  await status.getByRole("button", { name: "On the way" }).click();
  await expect(table.getByText("No vehicles match these filters.")).toBeVisible();
  await status.getByRole("button", { name: "All" }).click();

  await page.getByRole("searchbox", { name: "Search vehicle, LR or PO" }).fill("PO-2033");
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").last()).toContainText("₹34,000");
  await page.getByRole("searchbox", { name: "Search vehicle, LR or PO" }).fill("");

  await page.getByRole("button", { name: "Transport company: All transport companies" }).click();
  await page.getByRole("menuitemradio", { name: "Malabar Carriers" }).click();
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").last()).toContainText("Total, 1 vehicle");

  await page.getByRole("button", { name: /KL 11 BT 3308/ }).click();
  await expect(page.getByText("Transport for KL 11 BT 3308 is not included in the current prototype.")).toBeVisible();

  await expect(page.getByRole("link", { name: "+ Record transport" })).toHaveAttribute("href", "/transport/CAIU-2298076");
});

test("the KL 07 CD 4821 row opens the transport form, which keeps typed values", async ({ page }) => {
  await page.goto("/transport");
  await page.getByRole("link", { name: /KL 07 CD 4821/ }).click();
  await expect(page).toHaveURL(/\/transport\/CAIU-2298076$/);
  await expect(page.getByRole("heading", { level: 1, name: "Container CAIU 2298076" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/transport");

  await expect(page.getByLabel("Transport name")).toHaveValue("Kerala Roadways");
  await expect(page.getByLabel("LR number")).toHaveValue("LR-558214");
  await expect(page.getByLabel("Driver phone")).toHaveValue("+91 94470 55123");
  await expect(page.getByLabel("Loaded on", { exact: true })).toHaveValue("1 Oct 2026");
  await expect(page.getByLabel("Unloaded on")).toHaveValue("");
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting", { exact: true })).toBeVisible();
  await expect(page.getByText(/fewer than the 50 loaded/)).toBeVisible();
  await expect(page.getByText("On the way to warehouse")).toBeVisible();
  await expect(page.getByRole("row", { name: /PO-2028/ })).toContainText("2,500 pcs");
  // Role locator: the visited list stays mounted (hidden <Activity>) with its own ₹26,500 cell.
  await expect(page.getByRole("definition").filter({ hasText: "₹26,500" })).toBeVisible();

  await page.getByLabel("Bundles received").fill("48");
  await page.getByLabel("Received by").fill("Anil M");
  await expect(page.getByLabel("Bundles received")).toHaveValue("48");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Save draft is not included in the current prototype.")).toBeVisible();
  await page.getByRole("button", { name: "Save and mark unloaded" }).click();
  await expect(page.getByText("Save and mark unloaded is not included in the current prototype.")).toBeVisible();
});

test("an unknown container has no transport form", async ({ page }) => {
  // Partial prerendering streams the shell first, so the HTTP status stays 200; assert the not-found UI instead.
  await page.goto("/transport/MEDU-4470912");
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Container/ })).toHaveCount(0);
});
