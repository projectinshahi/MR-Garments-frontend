import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ClearingListRow } from "@/lib/api/stages-types";

import { ClearingListScreen } from "./clearing-list-screen";
import type { ClearingListData } from "./data/queries";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/clearing" }));
const navigate = vi.fn();
vi.mock("@/components/layout/navigation-progress", async (original) => ({
  ...(await original<typeof import("@/components/layout/navigation-progress")>()),
  useNavigate: () => navigate,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);

const row = (containerId: string, number: string, patch: Partial<ClearingListRow> = {}): ClearingListRow => ({
  containerId,
  number,
  terms: "CNF",
  eta: "2026-10-20",
  agent: { id: "a1", name: "Kochi Clearing Services" },
  arrivedOn: "2026-10-21",
  handedOn: "2026-10-22",
  billOfEntry: "BE-7710482",
  dutyPaidOn: null,
  clearedOn: null,
  orders: ["PO-2051"],
  status: "in_clearing",
  clearingCostInr: 37050,
  trip: null,
  ...patch,
});
const rows = [
  row("c1", "TCLU6000001"),
  row("c2", "TCLU6000002", { trip: { lrNumber: "LR-558214", status: "on_road", warehouseReceipt: null }, status: "cleared", clearedOn: "2026-10-25", dutyPaidOn: "2026-10-24" }),
  row("c3", "TCLU6000003", { agent: null, arrivedOn: null, handedOn: null, billOfEntry: "", status: "waiting", clearingCostInr: 0 }),
];
const data = (canDelete: boolean): ClearingListData => ({
  kpis: { inClearingNow: 2, clearedLast30Days: 1, averageDaysToClear: 4, clearingCostLast30DaysInr: 37050 },
  rows,
  agents: [{ id: "a1", name: "Kochi Clearing Services" }],
  today: "2026-10-30",
  canEnter: true,
  canDelete,
});
const headers = () => screen.getAllByRole("columnheader").map((th) => th.textContent);
const deleteFor = (number: string) => screen.getByRole("button", { name: `Delete clearing of container ${number}` });

beforeEach(() => vi.clearAllMocks());

describe("Clearing list: Actions (CLR-4)", () => {
  it("puts Actions right after Status for clearing Full only, with Delete on each container that has a clearing", () => {
    const { unmount } = render(<ClearingListScreen data={data(false)} />);
    expect(headers()).not.toContain("Actions");
    unmount();

    render(<ClearingListScreen data={data(true)} />);
    const all = headers();
    expect(all[all.indexOf("Status") + 1]).toBe("Actions");
    expect(screen.getAllByRole("button", { name: /^Delete clearing/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete clearing of container TCLU6000001",
      "Delete clearing of container TCLU6000002",
    ]);
  });

  it("Delete opens Delete Clearing? with the record and what it affects, without opening the row; Cancel sends nothing", async () => {
    const user = userEvent.setup();
    render(<ClearingListScreen data={data(true)} />);
    await user.click(deleteFor("TCLU6000001"));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Clearing?" });
    expect(dialog).toHaveTextContent("Are you sure you want to delete the clearing of container TCLU6000001? This can't be undone.");
    expect(dialog).toHaveTextContent("Clearing agentKochi Clearing Services");
    expect(dialog).toHaveTextContent("Bill of entryBE-7710482Clearing cost₹37,050OrdersPO-2051");
    expect(dialog).toHaveTextContent("Its duty and charges leave the landed cost, and the container goes back to waiting for clearing.");
    expect(dialog).toHaveTextContent("Payments aren't affected.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("names the trip that depends on a clearing, and shows the server's refusal", async () => {
    const reason = "The clearing of container TCLU6000002 can't be deleted: transport trip LR-558214 depends on it. Delete that trip first.";
    remove.mockRejectedValue(new ApiError(409, "in_use", reason));
    const user = userEvent.setup();
    render(<ClearingListScreen data={data(true)} />);
    await user.click(deleteFor("TCLU6000002"));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Clearing?" });
    expect(dialog).toHaveTextContent("Transport trip LR-558214 (on the way) depends on this clearing, so it can't be deleted until that trip is deleted.");
    await user.click(within(dialog).getByRole("button", { name: "Delete clearing" }));
    const refused = await screen.findByRole("alertdialog", { name: "Can't delete clearing" });
    expect(refused).toHaveTextContent(reason);
    expect(router.refresh).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("Delete clearing sends one DELETE for the container, then refreshes the list", async () => {
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ClearingListScreen data={data(true)} />);
    await user.click(deleteFor("TCLU6000001"));
    await user.dblClick(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete clearing" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Clearing deleted"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/clearings/c1");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a click elsewhere on the row still opens the clearing form", async () => {
    const user = userEvent.setup();
    render(<ClearingListScreen data={data(true)} />);
    await user.click(screen.getByText("TCLU6000001").closest("tr")!.querySelector("td:nth-child(2)")!);
    expect(navigate).toHaveBeenCalledWith("/clearing/c1");
  });
});
