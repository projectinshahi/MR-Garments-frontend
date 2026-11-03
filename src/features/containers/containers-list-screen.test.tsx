import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { ContainersListScreen } from "./containers-list-screen";
import type { ContainerRow, ContainersListData } from "./data/queries";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/containers" }));
const navigate = vi.fn();
vi.mock("@/components/layout/navigation-progress", async (original) => ({
  ...(await original<typeof import("@/components/layout/navigation-progress")>()),
  useNavigate: () => navigate,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);

const row = (id: string, number: string, orders: string[]): ContainerRow => ({
  id,
  number,
  agent: "Sino Freight",
  terms: "FOB",
  orders: orders.map((po) => ({ po, part: false })),
  bundles: 15,
  loadedOn: "2026-10-06",
  sailedOn: null,
  etaIndia: "2026-10-30",
  etaEstimated: false,
  status: "loading",
});
const data = (canDelete: boolean): ContainersListData => ({
  containers: [row("c1", "TCLU6000001", ["PO-2051", "PO-2052"]), row("c2", "TCLU6000002", ["PO-2053"])],
  kpis: { active: 2, arrivingThisWeek: [], loadingNow: ["TCLU6000001", "TCLU6000002"], arrivedInClearing: [] },
  footnote: "",
  agents: ["Sino Freight"],
  canEnter: true,
  canDelete,
  linkPos: true,
});
const headers = () => screen.getAllByRole("columnheader").map((th) => th.textContent);

beforeEach(() => vi.clearAllMocks());

describe("Containers list: Actions (CON-6)", () => {
  it("puts Actions right after Status, with Delete on every row, only for containers Full", () => {
    const { unmount } = render(<ContainersListScreen data={data(false)} />);
    expect(headers().at(-1)).toBe("Status");
    expect(screen.queryByRole("button", { name: /^Delete container/ })).toBeNull();
    unmount();

    render(<ContainersListScreen data={data(true)} />);
    expect(headers().slice(-2)).toEqual(["Status", "Actions"]);
    expect(screen.getAllByRole("button", { name: /^Delete container/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete container TCLU6000001",
      "Delete container TCLU6000002",
    ]);
  });

  it("Delete opens the Delete Container dialog without opening the row; Cancel sends nothing", async () => {
    const user = userEvent.setup();
    render(<ContainersListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete container TCLU6000001" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Container?" });
    expect(dialog).toHaveTextContent("Are you sure you want to delete container TCLU6000001? This can't be undone.");
    expect(dialog).toHaveTextContent("Orders insidePO-2051, PO-2052Bundles15");
    expect(dialog).toHaveTextContent("The goods of every order in it are taken out of the container.");
    expect(dialog).toHaveTextContent("A container with clearing, transport or warehouse records can't be deleted.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("Delete container sends one DELETE through the existing API, then refreshes the list", async () => {
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ContainersListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete container TCLU6000002" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Container?" });
    await user.dblClick(within(dialog).getByRole("button", { name: "Delete container" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Container deleted"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/containers/c2");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a refusal shows the server's reason with Close only", async () => {
    const reason = "Container TCLU6000001 has a clearing record (Clearing in India), so it can't be deleted. Those records can't be removed in the app.";
    remove.mockRejectedValue(new ApiError(409, "in_use", reason));
    const user = userEvent.setup();
    render(<ContainersListScreen data={data(true)} />);
    await user.click(screen.getByRole("button", { name: "Delete container TCLU6000001" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete container" }));
    const refused = await screen.findByRole("alertdialog", { name: "Can't delete container" });
    expect(refused).toHaveTextContent(reason);
    expect(within(refused).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);
    expect(router.refresh).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a click elsewhere on the row still opens the container", async () => {
    const user = userEvent.setup();
    render(<ContainersListScreen data={data(true)} />);
    await user.click(screen.getByText("TCLU6000002").closest("tr")!.querySelector("td:nth-child(2)")!);
    expect(navigate).toHaveBeenCalledWith("/containers/c2");
  });
});
