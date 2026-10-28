import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ShippingAgentRow } from "@/lib/api/types";
import { shippingAgents as sampleAgents } from "@/mocks/data/master";

import { ShippingAgentsScreen } from "./settings-screens";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/shipping-agents",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

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
