import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { downloadReport } from "@/features/reports/report-files";

import type { ShippingAgentRow } from "@/lib/api/types";
import { shippingAgents as sampleAgents } from "@/mocks/data/master";

import { ItemsScreen } from "./items-screen";
import { ShippingAgentsScreen } from "./shipping-agents-screen";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/shipping-agents",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/reports/report-files", async (actual) => ({ ...(await actual<typeof import("@/features/reports/report-files")>()), downloadReport: vi.fn() }));

// The Settings tabs render exactly the rows MD-4 (and the other list endpoints) return: no sample records.
const apiRow = (patch: Partial<ShippingAgentRow> = {}): ShippingAgentRow => ({
  id: "ship-api-1",
  name: "API Test Freight",
  contactPerson: "Ms. Test Contact",
  phone: "+86 20 0000 0001",
  officeCity: "Ningbo",
  activeContainers: 0,
  status: "Active",
  ...patch,
});

describe("Settings list (40-46)", () => {
  it("shows the API's records and none of the old sample records", () => {
    render(<ShippingAgentsScreen rows={[apiRow()]} />);
    expect(screen.getByText("API Test Freight")).toBeInTheDocument();
    for (const sample of sampleAgents) expect(screen.queryByText(sample.name)).not.toBeInTheDocument();
  });

  it("links Edit to the row's edit dialog on the tab's own path", () => {
    render(<ShippingAgentsScreen rows={[apiRow()]} />);
    expect(screen.getByRole("link", { name: "Edit API Test Freight" })).toHaveAttribute(
      "href",
      "/settings/shipping-agents?dialog=edit&id=ship-api-1",
    );
  });

  it("says there are none yet when the API returns no records", () => {
    render(<ShippingAgentsScreen rows={[]} />);
    expect(screen.getByText("No shipping agents yet.")).toBeInTheDocument();
  });

  it("says nothing matches when the status chips hide every record", () => {
    // The Active chip is selected on open, so an inactive-only list shows the filter message.
    render(<ShippingAgentsScreen rows={[apiRow({ status: "Inactive" })]} />);
    expect(screen.getByText("No shipping agents match these filters.")).toBeInTheDocument();
  });
});

describe("Settings report download", () => {
  it("Item list: the records the search and status chips keep, the master price labelled as a default rate, not a PO rate", async () => {
    const item = (id: string, name: string, status: "Active" | "Inactive") => ({ id, name, countedIn: "Pieces", price: 12.5, usedInOrders: ["PO-2051"], status });
    render(<ItemsScreen rows={[item("i1", "Denim jeans", "Active"), item("i2", "Old item", "Inactive")]} units={[]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Download report" }));
    await user.click(screen.getByRole("menuitem", { name: "Download Excel (.xlsx)" }));
    await waitFor(() => expect(downloadReport).toHaveBeenCalledOnce());
    const [file, format] = vi.mocked(downloadReport).mock.calls[0]!;
    expect(format).toBe("xlsx");
    expect(file).toMatchObject({ title: "Item list", filters: "Status: Active" });
    expect(file.sections[0]!.columns.map((c) => c.header)).toEqual(["Item", "Unit (counted in)", "Item price (master default rate per unit)", "Used in orders", "Status"]);
    expect(file.sections[0]!.rows).toEqual([["Denim jeans", "Pieces", 12.5, "PO-2051", "Active"]]);
    expect(file.notes!.join(" ")).toMatch(/not a historical rate/);
  });
});
