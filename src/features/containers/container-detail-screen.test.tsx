import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { ContainerDetail } from "@/lib/api/types";

import { ContainerDetailScreen } from "./container-detail-screen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }), usePathname: () => "/containers/c1" }));
const patch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: (...args: unknown[]) => patch(...args) } }));
const success = vi.fn();
const error = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({
  ...(await original<typeof import("@/lib/feedback")>()),
  notifySuccess: (m: string) => success(m),
  notifyError: (m: string) => error(m),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const container: ContainerDetail = {
  id: "c1",
  number: "FCIU 5527310",
  agent: { id: "a1", name: "Sino Freight" },
  terms: "FOB",
  loadedOn: "2026-10-20",
  sailedOn: null,
  eta: "2026-11-10",
  etaEstimated: false,
  status: "loading",
  bundles: 5,
  orders: [{ po: "PO-2035", part: true }],
  portOfLoading: "Nansha",
  portOfArrival: "Kochi",
  lines: [{ orderLineId: "l1", orderId: "o1", po: "PO-2035", item: "Men's jackets", unit: "pcs", bundles: 5, quantity: 400 }],
};
const view = (patchContainer: Partial<ContainerDetail> = {}, canEnter = true) =>
  render(<ContainerDetailScreen data={{ container: { ...container, ...patchContainer }, today: "2026-10-27", canEnter, linkPos: true }} />);
const buttons = () => within(screen.getByRole("banner")).queryAllByRole("button").map((b) => b.textContent);

beforeEach(() => vi.clearAllMocks());

describe("ContainerDetailScreen", () => {
  it("shows the facts and lines, and only the actions valid for the status to users with Enter", () => {
    const { unmount } = view();
    expect(screen.getByRole("heading", { level: 1, name: "FCIU 5527310" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PO-2035" })).toHaveAttribute("href", "/orders/PO-2035");
    expect(screen.getByText("400 pcs")).toBeInTheDocument();
    expect(buttons()).toEqual(["Mark as sailed", "Change ETA"]);
    unmount();

    view({ status: "sea", sailedOn: "2026-10-22" });
    expect(buttons()).toEqual(["Mark as arrived", "Change dates"]);
  });

  it("is read-only once arrived, and for users without Enter", () => {
    const { unmount } = view({ status: "arrived", sailedOn: "2026-10-22" });
    expect(buttons()).toEqual([]);
    expect(screen.getByText("This container has arrived and can't be changed.")).toBeInTheDocument();
    unmount();
    view({}, false);
    expect(buttons()).toEqual([]);
  });

  it("marks as sailed with a checked sailing date, prefilled with the saved one", async () => {
    patch.mockResolvedValue({ container: { id: "c1", status: "sea", sailedOn: "2026-10-27", eta: "2026-11-10" } });
    const user = userEvent.setup();
    view({ sailedOn: "2026-10-30" });
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Mark as sailed" }));
    const dialog = screen.getByRole("dialog");
    const sailed = within(dialog).getByLabelText("Sailing date");
    expect(sailed).toHaveValue("2026-10-30");
    await user.click(within(dialog).getByRole("button", { name: "Mark as sailed" }));
    expect(await within(dialog).findByText("The sailing date can't be after today.")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    await user.clear(sailed);
    await user.type(sailed, "2026-10-27");
    await user.click(within(dialog).getByRole("button", { name: "Mark as sailed" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(patch).toHaveBeenCalledWith("/containers/c1", { status: "sea", sailedOn: "2026-10-27" });
    expect(success).toHaveBeenCalledWith("Container marked as sailed");
  });

  it("a 409 means the page is stale: toast, close the dialog and refresh; a 422 keeps the dialog open", async () => {
    const user = userEvent.setup();
    view({ status: "sea", sailedOn: "2026-10-22" });
    const arrived = "This container has arrived and can't be changed.";
    patch.mockRejectedValueOnce(new ApiError(409, "container_arrived", arrived));
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Mark as arrived" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark as arrived" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(arrived));
    expect(patch).toHaveBeenCalledWith("/containers/c1", { status: "arrived" });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const before = "The ETA can't be before the sailing date.";
    patch.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { eta: before, status: "Other" }));
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Change dates" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Expected arrival in India (ETA)"));
    await user.type(within(dialog).getByLabelText("Expected arrival in India (ETA)"), "2026-11-12");
    await user.click(within(dialog).getByRole("button", { name: "Save dates" }));
    expect(await within(dialog).findByText(before)).toBeInTheDocument();
    expect(error).toHaveBeenCalledWith("Other");
    expect(patch).toHaveBeenLastCalledWith("/containers/c1", { eta: "2026-11-12" });
    expect(refresh).toHaveBeenCalledTimes(1); // still only the 409's refresh
  });
});
