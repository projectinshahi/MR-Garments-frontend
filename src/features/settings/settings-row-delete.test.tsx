import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ClearingAgentRow, ItemRow, LocationRow, ShippingAgentRow, SupplierRow, TeamRow, TransportCompanyRow } from "@/lib/api/types";

import { ClearingAgentsScreen } from "./clearing-agents-screen";
import { supplierDraft } from "./data/fixtures";
import { ItemsScreen } from "./items-screen";
import { OfficesScreen } from "./offices-screen";
import { ShippingAgentsScreen } from "./shipping-agents-screen";
import { SuppliersScreen } from "./suppliers-screen";
import { TeamsScreen } from "./teams-screen";
import { TransportCompaniesScreen } from "./transport-companies-screen";

const nav = vi.hoisted(() => ({ path: "/settings/suppliers", router: { replace: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => nav.router, useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn(), patch: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);
const patch = vi.mocked(apiClient.patch);

const contact = { contactPerson: "Mr. Li", phone: "+86 20 1111 2222", status: "Active" as const };
const supplier: SupplierRow = { id: "s-1", name: "ABC Textiles", ...contact, city: "Guangzhou", address: "", notes: "", currency: "CNY", openOrders: 2 };
const ask = () => screen.getByRole("alertdialog", { name: "Delete supplier?" });
const renderSuppliers = (row: SupplierRow = supplier) => {
  nav.path = "/settings/suppliers";
  render(<SuppliersScreen suppliers={[row]} draft={supplierDraft} />);
  return userEvent.setup();
};

beforeEach(() => vi.clearAllMocks());

describe("Settings: Delete on each table row", () => {
  it("sits next to Edit (which is unchanged) and asks first with the record's facts; Cancel and Escape send nothing", async () => {
    const user = renderSuppliers();
    const row = screen.getByRole("row", { name: /ABC Textiles/ });
    expect(within(row).getByRole("link", { name: "Edit ABC Textiles" })).toHaveAttribute("href", "/settings/suppliers?dialog=edit&id=s-1");
    await user.click(within(row).getByRole("button", { name: "Delete ABC Textiles" }));
    const facts = [...ask().querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(facts).toEqual([
      ["Type", "Supplier"],
      ["Name", "ABC Textiles"],
      ["Reference", "s-1"],
      ["Contact person", "Mr. Li"],
      ["Phone / WeChat", "+86 20 1111 2222"],
      ["City", "Guangzhou"],
      ["Currency", expect.stringContaining("yuan")],
      ["Open orders", "2"],
      ["Status", "Active"],
    ]);
    expect(ask()).toHaveTextContent("If it is used by any orders, it can't be deleted and you'll be offered to deactivate it instead");
    await user.click(within(ask()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Delete ABC Textiles" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("a double-click on Delete supplier sends one DELETE, then toasts and reloads the list", async () => {
    remove.mockResolvedValue(undefined);
    const user = renderSuppliers();
    await user.click(screen.getByRole("button", { name: "Delete ABC Textiles" }));
    await user.dblClick(within(ask()).getByRole("button", { name: "Delete supplier" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(remove.mock.calls).toEqual([["/suppliers/s-1"]]);
    expect(toast.success).toHaveBeenCalledWith("Supplier deleted");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("in use: the API's reason (what uses it) and Deactivate instead, which only patches the status", async () => {
    remove.mockRejectedValue(new ApiError(409, "in_use", "This supplier is used by 3 orders, so it can't be deleted. Deactivate it instead."));
    patch.mockResolvedValue({});
    const user = renderSuppliers();
    await user.click(screen.getByRole("button", { name: "Delete ABC Textiles" }));
    await user.click(within(ask()).getByRole("button", { name: "Delete supplier" }));
    const instead = await screen.findByRole("alertdialog", { name: "Deactivate supplier instead?" });
    expect(instead).toHaveTextContent("This supplier is used by 3 orders, so it can't be deleted.");
    expect(instead).toHaveTextContent("It won't appear when a new order is created. Orders that already use it keep it.");
    await user.click(within(instead).getByRole("button", { name: "Deactivate supplier" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch.mock.calls).toEqual([["/suppliers/s-1", { status: "Inactive" }]]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("in use and already inactive: explains, Close only; another failure toasts and keeps the dialog", async () => {
    const user = renderSuppliers({ ...supplier, status: "Inactive" });
    await user.click(screen.getByRole("button", { name: "Inactive" })); // the Status chip: show inactive rows
    remove.mockRejectedValueOnce(new ApiError(403, "forbidden", "You don't have access to do that."));
    await user.click(screen.getByRole("button", { name: "Delete ABC Textiles" }));
    await user.click(within(ask()).getByRole("button", { name: "Delete supplier" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(ask()).toBeInTheDocument();

    remove.mockRejectedValueOnce(new ApiError(409, "in_use", "This supplier is used by 1 order, so it can't be deleted. Deactivate it instead."));
    await user.click(within(ask()).getByRole("button", { name: "Delete supplier" }));
    const refused = await screen.findByRole("alertdialog", { name: "Can't delete supplier" });
    expect(refused).toHaveTextContent("This supplier is used by 1 order, so it can't be deleted.");
    expect(within(refused).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);
    expect(patch).not.toHaveBeenCalled();
    expect(nav.router.refresh).not.toHaveBeenCalled();
  });

  // Every tab: its row's Delete deletes through its own API path, naming its type, what can use it and its details.
  const active = { status: "Active" as const };
  const tabs: [string, string, () => React.ReactElement, string, string, string][] = [
    [
      "shipping agent",
      "/settings/shipping-agents",
      () => <ShippingAgentsScreen rows={[{ id: "a-1", name: "Sino Freight", ...contact, officeCity: "Ningbo", activeContainers: 1 } satisfies ShippingAgentRow]} />,
      "/shipping-agents/a-1",
      "containers or agent payments",
      "Office cityNingboActive containers1",
    ],
    [
      "clearing agent",
      "/settings/clearing-agents",
      () => <ClearingAgentsScreen rows={[{ id: "c-1", name: "Kochi Clear", ...contact, port: "Kochi", containersCleared: 4 } satisfies ClearingAgentRow]} />,
      "/clearing-agents/c-1",
      "container clearings",
      "PortKochiContainers cleared4",
    ],
    [
      "transport company",
      "/settings/transport-companies",
      () => <TransportCompaniesScreen rows={[{ id: "t-1", name: "Road Kings", ...contact, tripsSoFar: 7 } satisfies TransportCompanyRow]} />,
      "/transport-companies/t-1",
      "trips",
      "Trips so far7",
    ],
    [
      "office or warehouse",
      "/settings/offices",
      () => (
        <OfficesScreen rows={[{ id: "l-1", name: "Kochi warehouse", type: "Warehouse", country: "India", address: "", staff: [], ...active } satisfies LocationRow]} />
      ),
      "/locations/l-1",
      "users, China receipts, trips or warehouse receipts",
      "Office typeWarehouseCountryIndiaAddress–StaffNone",
    ],
    [
      "team",
      "/settings/teams",
      () => <TeamsScreen rows={[{ id: "tm-1", name: "Retail team", piecesInStock: 0, landedCostOfStockInr: 0, averagePerPieceInr: null, ...active } satisfies TeamRow]} />,
      "/teams/tm-1",
      "warehouse receipts",
      "Pieces in stock0",
    ],
    [
      "item",
      "/settings/items",
      () => (
        <ItemsScreen rows={[{ id: "i-1", name: "Polo shirts", countedIn: "Pieces", perBundle: 50, bundleLabel: null, usedInOrders: [], ...active } satisfies ItemRow]} />
      ),
      "/items/i-1",
      "orders",
      "Counted inPiecesPieces per bundle50Used in ordersNone",
    ],
  ];
  it("keeps a long list short in the confirmation: the first five and how many more", async () => {
    nav.path = "/settings/items";
    const user = userEvent.setup();
    const pos = Array.from({ length: 7 }, (_, i) => `PO-${2050 + i}`);
    render(<ItemsScreen rows={[{ id: "i-2", name: "Denim jeans", countedIn: "Pieces", perBundle: 50, bundleLabel: null, usedInOrders: pos, status: "Active" }]} />);
    await user.click(screen.getByRole("button", { name: "Delete Denim jeans" }));
    expect(screen.getByRole("alertdialog", { name: "Delete item?" })).toHaveTextContent("Used in ordersPO-2050, PO-2051, PO-2052, PO-2053, PO-2054 and 2 more");
  });

  it.each(tabs)("%s: its row deletes through its own API path", async (noun, path, screenFor, apiPath, usedBy, details) => {
    nav.path = path;
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(screenFor());
    await user.click(screen.getByRole("button", { name: /^Delete / }));
    const confirm = screen.getByRole("alertdialog", { name: `Delete ${noun}?` });
    expect(confirm).toHaveTextContent(details);
    expect(confirm).toHaveTextContent(`If it is used by any ${usedBy}, it can't be deleted`);
    await user.click(within(confirm).getByRole("button", { name: `Delete ${noun}` }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(remove.mock.calls).toEqual([[apiPath]]);
  });
});
