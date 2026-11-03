import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContainersScreen } from "@/features/order-detail/containers/containers-screen";
import type { OrderContainer, OrderReceipt, OrderView } from "@/features/order-detail/data/queries";
import { ReceivingScreen } from "@/features/order-detail/receiving/receiving-screen";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/formatters";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
// The frame reads the session (server only); the strip above each tab isn't under test here.
vi.mock("@/features/order-detail/shared/order-detail-frame", () => ({ OrderContextStrip: () => null }));
const remove = vi.mocked(apiClient.delete);

const order = {
  po: "PO-2051",
  quantity: 100,
  received: 90,
  unit: "pcs",
  lines: [{ id: "l1", position: 0, item: { id: "i1", name: "Denim jeans" }, unit: "pcs", quantity: 100, rateCny: 10, valueCny: 1000, received: 90, loaded: 70 }],
} as OrderView;
const receipt = (id: string, receivedOn: string, quantity: number, bundles: number): OrderReceipt => ({
  id,
  receivedOn,
  office: "Guangzhou office",
  bundles,
  deliveryNote: "",
  shortRemark: "",
  receivedBy: "Wang Fang",
  lines: [{ orderLineId: "l1", item: "Denim jeans", unit: "pcs", quantity }],
});
const receipts = [receipt("r1", "2026-10-03", 60, 6), receipt("r2", "2026-10-05", 30, 3)];
const container = (orders: string[]): OrderContainer => ({
  id: "c1",
  number: "TCLU6000001",
  status: "loading",
  terms: "FOB",
  agent: { id: "a1", name: "Sino Freight" },
  loadedOn: "2026-10-06",
  sailedOn: null,
  eta: "2026-10-30",
  orders,
  lines: [{ orderLineId: "l1", item: "Denim jeans", unit: "pcs", bundles: 7, quantity: 70 }],
});

const firstReceipt = `Delete receipt of ${formatDate("2026-10-03")}, 60 pcs Denim jeans`;
async function askReceipt() {
  const user = userEvent.setup();
  render(<ReceivingScreen order={order} receipts={receipts} canDelete />);
  await user.click(screen.getByRole("button", { name: firstReceipt }));
  const dialog = await screen.findByRole("alertdialog", { name: "Delete Goods Receipt?" });
  return { user, dialog, confirm: within(dialog).getByRole("button", { name: "Delete receipt" }) };
}
async function askContainer(orders = ["PO-2051", "PO-2052"]) {
  const user = userEvent.setup();
  render(<ContainersScreen order={order} containers={[container(orders)]} linkContainers canDelete />);
  await user.click(screen.getByRole("button", { name: "Delete container TCLU6000001" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Delete Container?" });
  return { user, dialog, confirm: within(dialog).getByRole("button", { name: "Delete container" }) };
}

beforeEach(() => vi.clearAllMocks());

describe("Delete Goods Receipt (REC-4)", () => {
  it("is offered on each receipt only with receiving Full", () => {
    const { unmount } = render(<ReceivingScreen order={order} receipts={receipts} />);
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    unmount();
    render(<ReceivingScreen order={order} receipts={receipts} canDelete />);
    expect(screen.getAllByRole("button", { name: /^Delete receipt of/ })).toHaveLength(2);
  });

  it("shows the receipt's date, office, quantity and bundles with the warning; Cancel sends nothing", async () => {
    const { user, dialog } = await askReceipt();
    expect(dialog).toHaveTextContent("Are you sure you want to delete this receipt from PO-2051? This can't be undone.");
    expect(dialog).toHaveTextContent(`Received on${formatDate("2026-10-03")}OfficeGuangzhou officeReceived60 pcs Denim jeansBundles6`);
    expect(dialog).toHaveTextContent("If any of these goods are already in a container, delete that container first.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });

  it("a double-click sends one DELETE; 204 toasts and refreshes", async () => {
    let finish: () => void = () => {};
    remove.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const { user, confirm } = await askReceipt();
    await user.dblClick(confirm);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/receipts/r1");
    expect(confirm).toHaveTextContent("Deleting…");
    expect(confirm).toBeDisabled();
    finish();
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Receipt deleted");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("in use: the same dialog gives the API's reason with Close only, and nothing is refreshed", async () => {
    const reason = "This receipt can't be deleted: container TCLU6000001 already holds 30 pcs of Denim jeans from it. Delete that container first.";
    remove.mockRejectedValue(new ApiError(409, "in_use", reason));
    const { user, confirm } = await askReceipt();
    await user.click(confirm);
    const refused = await screen.findByRole("alertdialog", { name: "Can't delete receipt" });
    expect(refused).toHaveTextContent(reason);
    expect(within(refused).getAllByRole("button").map((button) => button.textContent)).toEqual(["Close"]);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("already deleted (404) ends like a delete", async () => {
    remove.mockRejectedValue(new ApiError(404, "not_found", "Receipt not found."));
    const { user, confirm } = await askReceipt();
    await user.click(confirm);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Receipt was already deleted."));
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("any other failure toasts and keeps the dialog open to try again", async () => {
    remove.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(undefined);
    const { user, dialog, confirm } = await askReceipt();
    await user.click(confirm);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(dialog).toBeInTheDocument();
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Receipt deleted"));
    expect(remove).toHaveBeenCalledTimes(2);
  });
});

describe("Delete Container (CON-6)", () => {
  it("is offered on each container only with containers Full", () => {
    const { unmount } = render(<ContainersScreen order={order} containers={[container(["PO-2051"])]} linkContainers />);
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    unmount();
    render(<ContainersScreen order={order} containers={[container(["PO-2051"])]} linkContainers canDelete />);
    expect(screen.getByRole("button", { name: "Delete container TCLU6000001" })).toBeInTheDocument();
  });

  it("shows the container, this order's goods and the other POs whose goods leave with it; Cancel sends nothing", async () => {
    const { user, dialog } = await askContainer();
    expect(dialog).toHaveTextContent("Are you sure you want to delete container TCLU6000001? This can't be undone.");
    expect(dialog).toHaveTextContent(`StatusLoadingTermsFOBShipping agentSino FreightLoaded on${formatDate("2026-10-06")}PO-2051 in it70 pcs Denim jeans · 7 bundles`);
    expect(dialog).toHaveTextContent("It also holds goods of PO-2052. They are taken out of the container too.");
    expect(dialog).toHaveTextContent("A container with clearing, transport or warehouse records can't be deleted.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });

  it("with only this order in it, says nothing of others; Delete container sends one DELETE", async () => {
    remove.mockResolvedValue(undefined);
    const { user, dialog, confirm } = await askContainer(["PO-2051"]);
    expect(dialog).not.toHaveTextContent("It also holds");
    await user.dblClick(confirm);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Container deleted"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/containers/c1");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("in use: says which records keep it, with Close only", async () => {
    const reason = "Container TCLU6000001 has a clearing record (Clearing in India), so it can't be deleted. Those records can't be removed in the app.";
    remove.mockRejectedValue(new ApiError(409, "in_use", reason));
    const { user, confirm } = await askContainer();
    await user.click(confirm);
    const refused = await screen.findByRole("alertdialog", { name: "Can't delete container" });
    expect(refused).toHaveTextContent(reason);
    expect(within(refused).getAllByRole("button").map((button) => button.textContent)).toEqual(["Close"]);
  });
});
