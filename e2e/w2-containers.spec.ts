import { expect, test } from "@playwright/test";

// W2-containers: Containers list (24_8.1) and Load container (23_8). Role/label locators only (hidden <Activity> routes).

test.use({ viewport: { width: 1440, height: 900 } });

test("containers list shows the KPIs and rows and filters them on the client", async ({ page }) => {
  await page.goto("/containers");
  await expect(page.getByRole("heading", { level: 1, name: "Containers" })).toBeVisible();
  for (const text of ["Active containers", "on the way or in port", "MSKU 4471203 · TGHU 8820156", "Arrived, in clearing"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/An order can be split across containers/)).toBeVisible();

  const table = page.getByRole("table");
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(7);
  const first = table.getByRole("row", { name: /FCIU 5527310/ });
  await expect(first).toContainText("Est. 24 Oct");
  await expect(first).toContainText("Loading");
  await expect(table.getByRole("row", { name: /MSKU 4471203/ })).toContainText("PO-2027, PO-2037 (part)");
  await expect(table.getByRole("row", { name: /CAIU 2298076/ })).toContainText("Arrived, in clearing");

  const chips = page.getByRole("group", { name: "Container status" });
  await chips.getByRole("button", { name: "On the way (4)" }).click();
  await expect(rows).toHaveCount(5);
  await chips.getByRole("button", { name: "Finished" }).click();
  await expect(table.getByText("No containers match these filters.")).toBeVisible();
  await chips.getByRole("button", { name: "Active (6)" }).click();

  await page.getByRole("searchbox", { name: "Search container or PO" }).fill("PO-2037");
  await expect(rows).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Search container or PO" }).fill("");

  await page.getByRole("button", { name: "Shipping agent: All agents" }).click();
  await page.getByRole("menuitemradio", { name: "Dragon Cargo" }).click();
  await expect(rows).toHaveCount(3);
  await page.getByRole("button", { name: "Terms: All terms" }).click();
  await page.getByRole("menuitemradio", { name: "CNF" }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("OOLU 6094412");

  await expect(page.getByRole("link", { name: "+ New container" })).toHaveAttribute("href", "/containers/new");
});

test("load container updates totals and loaded figures as lines change", async ({ page }) => {
  await page.goto("/containers/new");
  await expect(page.getByRole("heading", { level: 1, name: "Load container" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/containers");
  await expect(page.getByLabel("Container number")).toHaveValue("FCIU 5527310");
  await expect(page.getByLabel("Shipping agent")).toHaveValue("Sino Freight");
  await expect(page.getByLabel("Expected arrival in India (ETA)")).toHaveValue("24 Oct 2026");
  await expect(page.getByText("About 22 days at sea. Agent: Sino Freight.")).toBeVisible();

  const glance = page.getByRole("region", { name: "Contents at a glance" });
  await expect(glance.getByText("71", { exact: true })).toBeVisible();
  await expect(page.getByText("1,160 of 1,200")).toBeVisible();
  await expect(page.getByText("4,000 of 6,000")).toBeVisible();

  await page.getByLabel("Bundles, PO-2031 Kids t-shirts").fill("45");
  await expect(glance.getByText("76", { exact: true })).toBeVisible();
  await page.getByLabel("Quantity, PO-2031 Kids t-shirts").fill("4,500 pcs");
  await expect(page.getByText("4,500 of 6,000")).toBeVisible();
  await expect(page.getByRole("meter", { name: "PO-2031 · Kids t-shirts loaded" })).toHaveAttribute("aria-valuenow", "4500");

  const terms = page.getByLabel("Terms, PO-2035 Care labels");
  await expect(terms).toHaveValue("FOB");
  await terms.selectOption("CNF");
  await expect(terms).toHaveValue("CNF");

  await page.getByRole("button", { name: "+ Add item from another order" }).click();
  await expect(page.getByText("Add item from another order is not included in the current prototype.")).toBeVisible();
  await page.getByRole("button", { name: "Save container" }).click();
  await expect(page.getByText("Save container is not included in the current prototype.")).toBeVisible();
});
