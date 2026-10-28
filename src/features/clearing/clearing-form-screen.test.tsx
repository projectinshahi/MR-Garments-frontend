import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { ClearingForm } from "@/lib/api/stages-types";

import { ClearingFormScreen } from "./clearing-form-screen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/clearing/c1" }));
const put = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { put: (...args: unknown[]) => put(...args) } }));
const success = vi.fn();
const error = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({
  ...(await original<typeof import("@/lib/feedback")>()),
  notifySuccess: (m: string) => success(m),
  notifyError: (m: string) => error(m),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const form: ClearingForm = {
  container: { id: "c1", number: "CAIU 2298076", status: "arrived", terms: "CNF", loadedOn: "2026-09-01", eta: "2026-09-27" },
  clearing: {
    id: "k1",
    clearingAgentId: "a1",
    arrivedOn: "2026-09-28",
    handedOn: "2026-09-29",
    billOfEntry: "BE-7710482",
    dutyPaidOn: null,
    clearedOn: null,
    goodsValueInr: 980000,
    customsDutyInr: 196000,
    otherDutiesInr: 142000,
    agentChargesInr: 18000,
    portChargesInr: 14500,
    status: "in_clearing",
  },
  goods: [{ orderLineId: "l1", orderId: "o1", po: "PO-2028", item: "Denim jeans", unit: "pcs", bundles: 50, quantity: 2500 }],
  suppliers: ["Guangzhou Textile Co."],
  agents: [
    { id: "a1", name: "Kochi Clearing Services", contactPerson: "Mr. Anil Kumar", phone: "+91 98470 12345" },
    { id: "a2", name: "Southern Port Agents", contactPerson: "Mr. Rajesh Nair", phone: "+91 98950 44210" },
  ],
};
const view = (patch: Partial<ClearingForm> = {}, canEnter = true) => render(<ClearingFormScreen data={{ form: { ...form, ...patch }, today: "2026-10-05", canEnter }} />);
const draftButton = () => screen.queryByRole("button", { name: "Save draft" });
const clearButton = () => screen.queryByRole("button", { name: "Mark cleared, hand to transport" });

beforeEach(() => vi.clearAllMocks());

describe("ClearingFormScreen", () => {
  it("shows the saved clearing, the agent's contact from the master, the goods, total and progress", async () => {
    const user = userEvent.setup();
    view();
    expect(screen.getByRole("heading", { level: 1, name: "Container CAIU 2298076" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Arrived at port/)).toHaveValue("2026-09-28");
    expect(screen.getByLabelText("Agent contact person")).toHaveValue("Mr. Anil Kumar");
    expect(screen.getByLabelText("Agent contact person")).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Value of goods for duty" })).toHaveValue("9,80,000");
    // The total, "Adds to landed cost" and the saved "Duty calculated" step.
    expect(screen.getAllByText("₹3,70,500")).toHaveLength(3);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Terms: CNF · Supplier: Guangzhou Textile Co.")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Clearing agent" }), "a2");
    expect(screen.getByLabelText("Agent phone")).toHaveValue("+91 98950 44210");
    const port = screen.getByRole("textbox", { name: "Port and terminal charges" });
    await user.clear(port);
    await user.type(port, "20000.5");
    expect(port).toHaveValue("20,000.5");
    expect(screen.getAllByText("₹3,76,000.50")).toHaveLength(2);
  });

  it("saves a draft (complete: false) and refreshes; marks cleared (complete: true) and goes to the list", async () => {
    put.mockResolvedValue({ clearing: { id: "k1", status: "in_clearing" } });
    const user = userEvent.setup();
    view();
    await user.type(screen.getByLabelText("Duty paid on"), "2026-09-30");
    await user.click(draftButton()!);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/clearings/c1", {
      clearingAgentId: "a1",
      arrivedOn: "2026-09-28",
      handedOn: "2026-09-29",
      billOfEntry: "BE-7710482",
      dutyPaidOn: "2026-09-30",
      clearedOn: null,
      goodsValueInr: 980000,
      customsDutyInr: 196000,
      otherDutiesInr: 142000,
      agentChargesInr: 18000,
      portChargesInr: 14500,
      complete: false,
    });
    expect(success).toHaveBeenCalledWith("Clearing draft saved");
    expect(push).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Cleared on"), "2026-10-01");
    await user.click(clearButton()!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clearing"));
    expect(put).toHaveBeenLastCalledWith("/clearings/c1", expect.objectContaining({ clearedOn: "2026-10-01", complete: true }));
    expect(success).toHaveBeenLastCalledWith("Container cleared and handed to transport");
  });

  it("pressing Enter in a field saves a draft, never the final action", async () => {
    put.mockResolvedValue({ clearing: { id: "k1", status: "in_clearing" } });
    const user = userEvent.setup();
    view();
    await user.type(screen.getByRole("textbox", { name: "Port and terminal charges" }), "{Enter}");
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/clearings/c1", expect.objectContaining({ complete: false }));
  });

  it("shows 422 messages under their fields, and a 409 as a toast with a refresh", async () => {
    const user = userEvent.setup();
    view();
    put.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { dutyPaidOn: "Enter the date the duty was paid.", other: "Other" }));
    await user.click(clearButton()!);
    expect(await screen.findByText("Enter the date the duty was paid.")).toBeInTheDocument();
    expect(screen.getByLabelText("Duty paid on")).toHaveAttribute("aria-invalid", "true");
    expect(error).toHaveBeenCalledWith("Other");
    expect(refresh).not.toHaveBeenCalled();

    const closed = "This record is complete and can't be changed.";
    put.mockRejectedValueOnce(new ApiError(409, "record_closed", closed));
    await user.click(clearButton()!);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(closed));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
  });

  it("is read-only once cleared, before arrival, and without clearing Enter", () => {
    const cleared = { ...form.clearing!, dutyPaidOn: "2026-09-30", clearedOn: "2026-10-01", status: "cleared" as const };
    const { unmount } = view({ clearing: cleared });
    expect(clearButton()).not.toBeInTheDocument();
    expect(draftButton()).not.toBeInTheDocument();
    expect(screen.getByText("This record is complete and can't be changed.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Clearing agent" })).toBeDisabled();
    unmount();

    const atSea = view({ clearing: null, container: { ...form.container, status: "sea" } });
    expect(screen.getByText("This container hasn't arrived at the port yet.")).toBeInTheDocument();
    expect(clearButton()).not.toBeInTheDocument();
    atSea.unmount();

    view({}, false);
    expect(clearButton()).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Customs duty" })).toBeDisabled();
  });

  it("starts a new clearing with the first agent and the ETA as the arrival", () => {
    view({ clearing: null });
    expect(screen.getByRole("combobox", { name: "Clearing agent" })).toHaveValue("a1");
    expect(screen.getByLabelText(/Arrived at port/)).toHaveValue("2026-09-27");
    expect(screen.getByRole("textbox", { name: "Customs duty" })).toHaveValue("");
    expect(screen.getAllByText("₹0")).toHaveLength(2);
  });
});
