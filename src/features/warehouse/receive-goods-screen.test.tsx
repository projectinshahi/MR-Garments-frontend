import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReceiveGoodsForm } from "@/lib/api/stages-types";

import { ReceiveGoodsScreen } from "./receive-goods-screen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/warehouse/receive/t1" }));
const put = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { put: (...args: unknown[]) => put(...args) } }));
const success = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({
  ...(await original<typeof import("@/lib/feedback")>()),
  notifySuccess: (m: string) => success(m),
  notifyError: vi.fn(),
}));

const form: ReceiveGoodsForm = {
  trip: {
    id: "t1",
    containerId: "c1",
    container: "CAIU 2298076",
    terms: "CNF",
    vehicleNumber: "KL 07 CD 4821",
    lrNumber: "LR-558214",
    bundlesLoaded: 4,
    bundlesReceived: 4,
    unloadedOn: "2026-10-03",
    destinationId: "w1",
    status: "unloaded",
  },
  receipt: null,
  lines: [{ orderLineId: "l1", orderId: "o1", po: "PO-2028", item: "Denim jeans", unit: "pcs", quantity: 100 }],
  teams: [
    { id: "retail", name: "Retail team" },
    { id: "wholesale", name: "Wholesale team" },
  ],
  warehouses: [{ id: "w1", name: "Main warehouse" }],
  cost: null,
  previousOutstanding: null,
};
const cost = { goodsInr: 12000, seaFreightInr: 0, clearingInr: 37050, transportInr: 2650, totalInr: 51700, orderedPieces: 100, final: false };
const view = (patch: Partial<ReceiveGoodsForm> = {}, canEnter = true) =>
  render(<ReceiveGoodsScreen data={{ form: { ...form, ...patch }, today: "2026-10-05", me: "Joseph M", canEnter }} />);
const stockButton = () => screen.queryByRole("button", { name: "Save and add to stock" });

beforeEach(() => vi.clearAllMocks());

describe("ReceiveGoodsScreen", () => {
  it("splits the line between the teams (never more than received) and adds it to stock", async () => {
    put.mockResolvedValue({ receipt: { id: "r1", status: "stocked" } });
    const user = userEvent.setup();
    view();
    expect(screen.queryByText("Cost so far")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Received by/)).toHaveValue("Joseph M");
    const retail = screen.getByRole("textbox", { name: "Retail team, Denim jeans" });
    const wholesale = screen.getByRole("textbox", { name: "Wholesale team, Denim jeans" });
    await user.clear(retail);
    await user.type(retail, "60");
    await user.clear(wholesale);
    await user.type(wholesale, "120");
    expect(wholesale).toHaveValue("40");
    expect(screen.getByRole("status")).toHaveTextContent("100 of 100 pcs given to teams");

    await user.clear(wholesale);
    expect(screen.getByRole("status")).toHaveTextContent("40 pcs left unassigned");
    await user.click(stockButton()!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/warehouse"));
    expect(put).toHaveBeenCalledWith("/warehouse-receipts/t1", {
      locationId: "w1",
      receivedOn: "2026-10-03",
      receivedBy: "Joseph M",
      bundlesReceived: 4,
      lines: [{ orderLineId: "l1", teamId: "retail", quantity: 60 }],
      complete: true,
    });
    expect(success).toHaveBeenCalledWith("Goods added to stock");
  });

  it("saves a draft and refreshes", async () => {
    put.mockResolvedValue({ receipt: { id: "r1", status: "draft" } });
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/warehouse-receipts/t1", expect.objectContaining({ lines: [], complete: false }));
    expect(push).not.toHaveBeenCalled();
  });

  it("pressing Enter in a field saves a draft, never the final action", async () => {
    put.mockResolvedValue({ receipt: { id: "r1", status: "draft" } });
    const user = userEvent.setup();
    view();
    await user.type(screen.getByLabelText(/Received by/), "{Enter}");
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/warehouse-receipts/t1", expect.objectContaining({ complete: false }));
  });

  it("shows the cost panels only when the API sends the cost", () => {
    view({ cost, receipt: { id: "r1", locationId: "w1", receivedOn: "2026-10-04", receivedBy: "Joseph M", bundlesReceived: 4, status: "draft", lines: [{ orderLineId: "l1", teamId: "retail", quantity: 100 }] } });
    expect(screen.getByText("Cost so far")).toBeInTheDocument();
    expect(screen.getByText("Estimate")).toBeInTheDocument();
    expect(screen.getByText("₹517.00")).toBeInTheDocument();
    expect(screen.getByText("Cost by team")).toBeInTheDocument();
  });

  it("shows the supplier's previous outstanding apart, per currency, and leaves the cost, per piece and team costs alone", () => {
    const receipt = { id: "r1", locationId: "w1", receivedOn: "2026-10-04", receivedBy: "Joseph M", bundlesReceived: 4, status: "draft" as const, lines: [{ orderLineId: "l1", teamId: "retail", quantity: 100 }] };
    const costTexts = () => ["₹51,700", "₹517.00", "₹51,700"].map((text) => screen.getAllByText(text).length);
    view({ cost, receipt });
    const without = costTexts();
    cleanup();

    view({
      cost,
      receipt,
      previousOutstanding: [
        {
          supplierId: "s1",
          supplier: "Guangzhou Textile Co.",
          currency: "CNY",
          orders: 3,
          byCurrency: [
            { currency: "CNY", amount: 1210.5 },
            { currency: "USD", amount: 200 },
          ],
        },
      ],
    });
    expect(screen.getByText("Previous supplier outstanding")).toBeInTheDocument();
    expect(screen.getByText("Guangzhou Textile Co. · 3 unpaid orders")).toBeInTheDocument();
    // Never added across currencies, never converted.
    expect(screen.getByText("¥1,210.50 · $200.00")).toBeInTheDocument();
    expect(screen.getByText("Unpaid orders placed before this trip. Not included in the cost above.")).toBeInTheDocument();
    // Total, cost per piece and Retail's team cost are the same figures as without it.
    expect(costTexts()).toEqual(without);
  });

  it("shows nothing owed as 0 in the supplier's currency, one row per supplier, and no row without the figures", () => {
    view({
      cost,
      previousOutstanding: [
        { supplierId: "s1", supplier: "Foshan Fabrics", currency: "USD", orders: 0, byCurrency: [] },
        { supplierId: "s2", supplier: "Yiwu Trims", currency: "CNY", orders: 1, byCurrency: [{ currency: "INR", amount: 5000 }] },
      ],
    });
    expect(screen.getAllByText("Previous supplier outstanding")).toHaveLength(2);
    expect(screen.getByText("Foshan Fabrics · 0 unpaid orders")).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText("Yiwu Trims · 1 unpaid order")).toBeInTheDocument();
    expect(screen.getByText("₹5,000.00")).toBeInTheDocument();
    cleanup();
    view({ cost, previousOutstanding: null });
    expect(screen.queryByText("Previous supplier outstanding")).not.toBeInTheDocument();
  });

  it("on a CNF container shows the sea freight its orders carry from a FOB container, not the CNF note", () => {
    view({ cost });
    expect(screen.getByText("In supplier price (CNF)")).toBeInTheDocument();
    cleanup();
    view({ cost: { ...cost, seaFreightInr: 5000, totalInr: 56700 } });
    expect(screen.queryByText("In supplier price (CNF)")).not.toBeInTheDocument();
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
  });

  it("is read-only once in stock, before unloading, and without warehouse Enter", () => {
    const receipt = { id: "r1", locationId: "w1", receivedOn: "2026-10-04", receivedBy: "Joseph M", bundlesReceived: 4, status: "stocked" as const, lines: [] };
    const stocked = view({ receipt });
    expect(stockButton()).not.toBeInTheDocument();
    expect(screen.getByText("This record is complete and can't be changed.")).toBeInTheDocument();
    stocked.unmount();

    const onRoad = view({ trip: { ...form.trip, status: "on_road", unloadedOn: null, bundlesReceived: null } });
    expect(screen.getByText("These goods haven't been unloaded yet.")).toBeInTheDocument();
    onRoad.unmount();

    view({}, false);
    expect(stockButton()).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Retail team, Denim jeans" })).toBeDisabled();
  });
});
