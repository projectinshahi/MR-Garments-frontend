import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { WarehouseListRow } from "@/lib/api/stages-types";

import type { WarehouseListData } from "./data/queries";
import { WarehouseListScreen } from "./warehouse-list-screen";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/warehouse" }));
const navigate = vi.fn();
vi.mock("@/components/layout/navigation-progress", async (original) => ({
  ...(await original<typeof import("@/components/layout/navigation-progress")>()),
  useNavigate: () => navigate,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);

const teams = [
  { id: "retail", name: "Retail team" },
  { id: "wholesale", name: "Wholesale team" },
  { id: "online", name: "Online team" },
];
const row = (orderId: string, po: string, item: string, split: Record<string, number>): WarehouseListRow => ({
  id: `r1:${orderId}`,
  receiptId: "r1",
  transportId: "t1",
  receivedOn: "2026-10-28",
  receivedBy: "Joseph M",
  container: "TCLU6000001",
  orderId,
  po,
  item,
  supplier: "Guangzhou Textile Co.",
  location: { id: "w1", name: "Main warehouse" },
  received: Object.values(split).reduce((sum, n) => sum + n, 0),
  teams: split,
  costPerPieceInr: 517,
  lrNumber: "LR-558214",
  bundlesReceived: 4,
});
const ready = (transportId: string, lrNumber: string, draft: boolean): WarehouseListData["ready"][number] => ({
  transportId,
  containerId: `c-${transportId}`,
  container: `TCLU600000${transportId.slice(-1)}`,
  vehicleNumber: "KL 07 CD 4821",
  lrNumber,
  unloadedOn: "2026-10-30",
  bundlesReceived: 4,
  destination: "Main warehouse",
  receiptStatus: draft ? "draft" : null,
  orders: ["PO-2053"],
  draft: draft ? { receivedOn: "2026-10-31", location: "Main warehouse", bundlesReceived: 4, received: 60, teams: { retail: 60 } } : null,
});
const data = (canDelete: boolean): WarehouseListData => ({
  rows: [row("o1", "PO-2051", "Denim jeans", { retail: 60, wholesale: 40 }), row("o2", "PO-2052", "Track pants", { online: 30 })],
  ready: [ready("t2", "LR-2002", true), ready("t3", "LR-2003", false)],
  teams,
  warehouses: [{ id: "w1", name: "Main warehouse" }],
  showCosts: true,
  canEnter: true,
  canDelete,
});
const headersOf = (table: HTMLElement) => within(table).getAllByRole("columnheader").map((th) => th.textContent);

beforeEach(() => vi.clearAllMocks());

describe("Warehouse list: Actions (WH-4)", () => {
  it("shows Actions only with warehouse Full: last on the stocked table, right after Status on the trips waiting", () => {
    const { unmount } = render(<WarehouseListScreen data={data(false)} />);
    expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    unmount();

    render(<WarehouseListScreen data={data(true)} />);
    const [stocked, waiting] = screen.getAllByRole("table");
    expect(headersOf(stocked!).at(-1)).toBe("Actions");
    const waitingHeads = headersOf(waiting!);
    expect(waitingHeads[waitingHeads.indexOf("Status") + 1]).toBe("Actions");
    // Every stocked row, and only the draft among the waiting trips (a trip not started has no receipt).
    expect(screen.getAllByRole("button", { name: /^Delete/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete warehouse receipt of PO-2051, container TCLU6000001",
      "Delete warehouse receipt of PO-2052, container TCLU6000001",
      "Delete draft warehouse receipt of trip LR-2002",
    ]);
  });

  it("a stocked receipt's confirmation covers all its orders and team quantities; Cancel sends nothing", async () => {
    const user = userEvent.setup();
    render(<WarehouseListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete warehouse receipt of PO-2052, container TCLU6000001" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Warehouse Receipt?" });
    expect(dialog).toHaveTextContent("Are you sure you want to delete the warehouse receipt of trip LR-558214 (container TCLU6000001)? This can't be undone.");
    expect(dialog).toHaveTextContent("StatusCompleted, in stockOrdersPO-2051, PO-2052WarehouseMain warehouse");
    expect(dialog).toHaveTextContent("Received130 pcs · 4 bundlesTeamsRetail 60 · Wholesale 40 · Online 30");
    expect(dialog).toHaveTextContent("Its goods leave stock: these team quantities are removed, the cost per piece of PO-2051, PO-2052 is no longer final");
    expect(dialog).toHaveTextContent("Payments, the trip and the clearing aren't affected.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });

  it("Delete warehouse receipt sends one DELETE for the trip, then refreshes the list", async () => {
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<WarehouseListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete warehouse receipt of PO-2051, container TCLU6000001" }));
    await user.dblClick(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete warehouse receipt" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Warehouse receipt deleted"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/warehouse-receipts/t1");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("a draft's confirmation shows its own values and that nothing in stock changes; Delete never opens the trip", async () => {
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<WarehouseListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete draft warehouse receipt of trip LR-2002" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Warehouse Receipt?" });
    expect(dialog).toHaveTextContent("Are you sure you want to delete the draft warehouse receipt of trip LR-2002 (container TCLU6000002)?");
    expect(dialog).toHaveTextContent("StatusDraftOrdersPO-2053WarehouseMain warehouse");
    expect(dialog).toHaveTextContent("Received60 pcs · 4 bundlesTeamsRetail 60");
    expect(dialog).toHaveTextContent("Only the draft goes: nothing of it is in stock, so stock, costs and order stages don't change.");
    await user.click(within(dialog).getByRole("button", { name: "Delete warehouse receipt" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("/warehouse-receipts/t2"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("an already deleted receipt ends like a delete; a click elsewhere on a waiting trip still opens it", async () => {
    remove.mockRejectedValue(new ApiError(404, "not_found", "Warehouse receipt not found."));
    const user = userEvent.setup();
    render(<WarehouseListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete draft warehouse receipt of trip LR-2002" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete warehouse receipt" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Warehouse receipt was already deleted."));
    expect(navigate).not.toHaveBeenCalled();

    await user.click(screen.getByText("TCLU6000003"));
    expect(navigate).toHaveBeenCalledWith("/warehouse/receive/t3");
  });
});
