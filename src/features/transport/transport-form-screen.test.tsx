import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { TransportForm } from "@/lib/api/stages-types";

import { TransportFormScreen } from "./transport-form-screen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/transport/c1" }));
const put = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { put: (...args: unknown[]) => put(...args) } }));
const success = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({
  ...(await original<typeof import("@/lib/feedback")>()),
  notifySuccess: (m: string) => success(m),
  notifyError: vi.fn(),
}));

const trip: NonNullable<TransportForm["trip"]> = {
  id: "t1",
  transportCompanyId: "kr",
  destinationId: "w1",
  lrNumber: "LR-558214",
  vehicleNumber: "KL 07 CD 4821",
  driverName: "Suresh P",
  driverPhone: "+91 94470 55123",
  bundlesLoaded: 50,
  loadedOn: "2026-10-01",
  loadedFrom: "Kochi port yard",
  loadedBy: "Ravi K",
  unloadedOn: null,
  bundlesReceived: null,
  receivedBy: "",
  shortRemark: "",
  freightInr: 22000,
  handlingInr: 4500,
  status: "on_road",
};
const form: TransportForm = {
  container: { id: "c1", number: "CAIU 2298076", status: "arrived", terms: "CNF" },
  clearing: { status: "cleared", clearedOn: "2026-10-01", agent: { id: "a1", name: "Kochi Clearing Services" } },
  trip,
  goods: [{ orderLineId: "l1", orderId: "o1", po: "PO-2028", item: "Denim jeans", unit: "pcs", bundles: 50, quantity: 2500 }],
  suppliers: ["Guangzhou Textile Co."],
  companies: [{ id: "kr", name: "Kerala Roadways" }],
  warehouses: [{ id: "w1", name: "Main warehouse" }],
};
const view = (patch: Partial<TransportForm> = {}, canEnter = true) => render(<TransportFormScreen data={{ form: { ...form, ...patch }, today: "2026-10-05", canEnter }} />);
const draftButton = () => screen.queryByRole("button", { name: "Save draft" });
const unloadButton = () => screen.queryByRole("button", { name: "Save and mark unloaded" });

beforeEach(() => vi.clearAllMocks());

describe("TransportFormScreen", () => {
  it("saves a draft (complete: false) and refreshes", async () => {
    put.mockResolvedValue({ trip: { id: "t1", status: "on_road" } });
    const user = userEvent.setup();
    view();
    await user.click(draftButton()!);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/transports/c1", {
      ...Object.fromEntries(Object.entries(trip).filter(([key]) => key !== "id" && key !== "status")),
      complete: false,
    });
    expect(success).toHaveBeenCalledWith("Transport draft saved");
    expect(push).not.toHaveBeenCalled();
  });

  it("asks for a short remark when fewer bundles arrive, then marks unloaded and goes to the list", async () => {
    put.mockResolvedValue({ trip: { id: "t1", status: "unloaded" } });
    const user = userEvent.setup();
    view();
    expect(screen.queryByLabelText(/Short remark/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Unloaded on"), "2026-10-03");
    await user.type(screen.getByLabelText("Bundles received"), "48");
    await user.type(screen.getByLabelText("Received by"), "Joseph M");
    const remark = screen.getByLabelText(/Short remark/);
    expect(remark).toHaveAttribute("aria-required", "true");
    await user.type(remark, "Two bundles torn");
    await user.click(unloadButton()!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/transport"));
    expect(put).toHaveBeenCalledWith(
      "/transports/c1",
      expect.objectContaining({ unloadedOn: "2026-10-03", bundlesReceived: 48, receivedBy: "Joseph M", shortRemark: "Two bundles torn", complete: true }),
    );
    expect(success).toHaveBeenCalledWith("Trip marked as unloaded");
  });

  it("shows the API's short-remark message under the remark", async () => {
    put.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { shortRemark: "Add a remark about the short bundles." }));
    const user = userEvent.setup();
    view({ trip: { ...trip, bundlesReceived: 48 } });
    await user.click(unloadButton()!);
    expect(await screen.findByText("Add a remark about the short bundles.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Short remark/)).toHaveAttribute("aria-invalid", "true");
  });

  it("is read-only once unloaded, before clearing, and without transport Enter", () => {
    const done = view({ trip: { ...trip, unloadedOn: "2026-10-03", bundlesReceived: 50, receivedBy: "Joseph M", status: "unloaded" } });
    expect(unloadButton()).not.toBeInTheDocument();
    expect(draftButton()).not.toBeInTheDocument();
    expect(screen.getByText("This record is complete and can't be changed.")).toBeInTheDocument();
    done.unmount();

    const waiting = view({ clearing: null, trip: null });
    expect(screen.getByText("This container hasn't been cleared yet.")).toBeInTheDocument();
    expect(unloadButton()).not.toBeInTheDocument();
    waiting.unmount();

    view({}, false);
    expect(unloadButton()).not.toBeInTheDocument();
    expect(screen.getByLabelText(/LR number/)).toBeDisabled();
  });
});
