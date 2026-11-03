import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { TripListRow } from "@/lib/api/stages-types";

import type { TransportListData } from "./data/queries";
import { TransportListScreen } from "./transport-list-screen";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/transport" }));
const navigate = vi.fn();
vi.mock("@/components/layout/navigation-progress", async (original) => ({
  ...(await original<typeof import("@/components/layout/navigation-progress")>()),
  useNavigate: () => navigate,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);

const trip = (id: string, containerId: string, lrNumber: string, patch: Partial<TripListRow> = {}): TripListRow => ({
  id,
  containerId,
  container: `TCLU${containerId}`,
  vehicleNumber: "KL 07 CD 4821",
  lrNumber,
  company: { id: "k1", name: "Kerala Roadways" },
  orders: ["PO-2051"],
  bundlesLoaded: 4,
  loadedOn: "2026-10-26",
  unloadedOn: "2026-10-27",
  bundlesReceived: 4,
  status: "unloaded",
  costInr: 2650,
  warehouseReceipt: null,
  ...patch,
});
const data = (canDelete: boolean): TransportListData => ({
  kpis: { onTheWay: 0, deliveredLast30Days: 2, bundlesDeliveredLast30Days: 8, shortLast30Days: 0, transportCostLast30DaysInr: 5300 },
  rows: [trip("t1", "6000001", "LR-1001"), trip("t2", "6000002", "LR-1002", { warehouseReceipt: "stocked" })],
  ready: [],
  companies: [{ id: "k1", name: "Kerala Roadways" }],
  canEnter: true,
  canDelete,
});
const headers = () => screen.getAllByRole("columnheader").map((th) => th.textContent);

beforeEach(() => vi.clearAllMocks());

describe("Transport list: Actions (TRN-4)", () => {
  it("puts Actions right after the status column (Bundles received) for transport Full only, with Delete on every trip", () => {
    const { unmount } = render(<TransportListScreen data={data(false)} />);
    expect(headers()).not.toContain("Actions");
    unmount();

    render(<TransportListScreen data={data(true)} />);
    const all = headers();
    expect(all[all.indexOf("Bundles received") + 1]).toBe("Actions");
    expect(all.at(-1)).toBe("Transport cost");
    expect(screen.getAllByRole("button", { name: /^Delete trip/ }).map((b) => b.getAttribute("aria-label"))).toEqual(["Delete trip LR-1001", "Delete trip LR-1002"]);
  });

  it("Delete opens Delete Transport Trip? with the trip and what it affects, without opening the row; Cancel sends nothing", async () => {
    const user = userEvent.setup();
    render(<TransportListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete trip LR-1001" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Transport Trip?" });
    expect(dialog).toHaveTextContent("Are you sure you want to delete trip LR-1001 of container TCLU6000001? This can't be undone.");
    expect(dialog).toHaveTextContent("VehicleKL 07 CD 4821Transport companyKerala RoadwaysOrdersPO-2051");
    expect(dialog).toHaveTextContent("Bundles4 of 4 receivedTransport cost₹2,650");
    expect(dialog).toHaveTextContent("Its freight and handling leave the landed cost, and the container goes back to Ready for transport.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("names the warehouse receipt that depends on a trip, and shows the server's refusal", async () => {
    const reason = "Trip LR-1002 of container TCLU6000002 can't be deleted: its warehouse receipt depends on it. Warehouse receipts can't be removed in the app.";
    remove.mockRejectedValue(new ApiError(409, "in_use", reason));
    const user = userEvent.setup();
    render(<TransportListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete trip LR-1002" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Transport Trip?" });
    expect(dialog).toHaveTextContent("Its stocked warehouse receipt depends on this trip, so it can't be deleted");
    await user.click(within(dialog).getByRole("button", { name: "Delete trip" }));
    expect(await screen.findByRole("alertdialog", { name: "Can't delete trip" })).toHaveTextContent(reason);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("Delete trip sends one DELETE for the container, then refreshes the list", async () => {
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TransportListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete trip LR-1001" }));
    await user.dblClick(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete trip" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Trip deleted"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/transports/6000001");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
});
