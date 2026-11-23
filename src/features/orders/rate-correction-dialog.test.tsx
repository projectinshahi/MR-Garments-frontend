import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { OrderDetail } from "@/lib/api/types";

import { correctableLines, RATE_CORRECTION_TEXT, RateCorrectionDialog } from "./rate-correction-dialog";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiClient: { post } }));

// ORD-8 (owner rule of 2026-11-23, 7): only received lines are corrected, with a reason; the API posts received x Δrate.
const line = (id: string, name: string, rateCny: number, received: number) => ({
  id,
  position: 0,
  item: { id: `i-${id}`, name },
  unit: "pcs" as const,
  quantity: 1000,
  rateCny,
  valueCny: received * rateCny,
  poValueCny: 1000 * rateCny,
  received,
  loaded: 0,
});
const order = { po: "PO-2050", currency: "CNY", lines: [line("l1", "Denim jeans", 12.5, 800), line("l2", "Cotton fabric", 8, 0)] } as Pick<OrderDetail, "po" | "currency" | "lines">;

beforeEach(() => {
  post.mockReset();
  router.refresh.mockReset();
  vi.mocked(toast.success).mockReset();
});

function open(onClose = vi.fn()) {
  render(<RateCorrectionDialog order={order} open onClose={onClose} />);
  const dialog = screen.getByRole("dialog", { name: "Correct rates" });
  return { user: userEvent.setup(), dialog, onClose, save: within(dialog).getByRole("button", { name: "Save correction" }) };
}

describe("Correct rates (ORD-8)", () => {
  it("lists only the lines with goods received", () => {
    expect(correctableLines(order).map((l) => l.id)).toEqual(["l1"]);
    const { dialog } = open();
    expect(within(dialog).getByRole("textbox", { name: "Rate, Denim jeans" })).toHaveValue("12.5");
    expect(within(dialog).queryByRole("textbox", { name: "Rate, Cotton fabric" })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("800 pcs received");
  });

  it("asks for a changed rate and a reason before calling the API", async () => {
    const { user, dialog, save } = open();
    await user.click(save);
    expect(within(dialog).getByText(RATE_CORRECTION_TEXT.unchanged)).toBeInTheDocument();
    expect(within(dialog).getByText(RATE_CORRECTION_TEXT.reason)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("previews received x the rate change, posts the changed lines with the reason, toasts the balance and refreshes", async () => {
    post.mockResolvedValue({ ledger: { currency: "CNY", changeCny: -400, balanceBefore: 0, balanceAfter: -400, finalOrders: [] } });
    const { user, dialog, save, onClose } = open();
    const rate = within(dialog).getByRole("textbox", { name: "Rate, Denim jeans" });
    await user.clear(rate);
    await user.type(rate, "13");
    expect(dialog).toHaveTextContent("More payable to the supplier by ¥400.00.");
    await user.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "Invoice rate 13, typed 12.5");
    await user.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/orders/PO-2050/rate-corrections", { lines: [{ id: "l1", rateCny: 13 }], reason: "Invoice rate 13, typed 12.5" });
    expect(toast.success).toHaveBeenCalledWith("Rates corrected. Supplier balance: Settled → Payable to supplier ¥400.00");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("names the final landed-cost orders the correction re-settled", async () => {
    post.mockResolvedValue({ ledger: { currency: "CNY", changeCny: 400, balanceBefore: -400, balanceAfter: 0, finalOrders: ["PO-2049"] } });
    const { user, dialog, save } = open();
    const rate = within(dialog).getByRole("textbox", { name: "Rate, Denim jeans" });
    await user.clear(rate);
    await user.type(rate, "12");
    await user.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "Agreed discount");
    await user.click(save);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(vi.mocked(toast.success).mock.calls[0]![0]).toContain("This changes the settlement of PO-2049, whose landed cost was final.");
  });

  // Owner review of 2026-11-23: a correction that changes a protected final landed cost needs the approval's reason too.
  it("asks for the approval when the API answers final_settlement_approval, then resends with it", async () => {
    const message = "This rate correction changes the payments that settle PO-2049, whose landed cost is already final. A Management user must approve it with a reason.";
    post
      .mockRejectedValueOnce(new ApiError(409, "final_settlement_approval", message))
      .mockResolvedValueOnce({ ledger: { currency: "CNY", changeCny: 400, balanceBefore: -400, balanceAfter: 0, finalOrders: ["PO-2049"] } });
    const { user, dialog, save, onClose } = open();
    const rate = within(dialog).getByRole("textbox", { name: "Rate, Denim jeans" });
    await user.clear(rate);
    await user.type(rate, "12");
    await user.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "Agreed discount");
    await user.click(save);
    const approval = await screen.findByRole("dialog", { name: "Approve a change to a final landed cost?" });
    expect(approval).toHaveTextContent(message);
    expect(onClose).not.toHaveBeenCalled();
    await user.type(within(approval).getByRole("textbox", { name: /Reason/ }), "Credit note from the supplier");
    await user.click(within(approval).getByRole("button", { name: "Approve and save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]![1]).not.toHaveProperty("finalSettlementApproval");
    expect(post.mock.calls[1]![1]).toEqual({ lines: [{ id: "l1", rateCny: 12 }], reason: "Agreed discount", finalSettlementApproval: { reason: "Credit note from the supplier" } });
  });

  it("shows the API's 422 under the fields and stays open", async () => {
    post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { lines: "Only a line with goods received is corrected here." }));
    const { user, dialog, save, onClose } = open();
    const rate = within(dialog).getByRole("textbox", { name: "Rate, Denim jeans" });
    await user.clear(rate);
    await user.type(rate, "11");
    await user.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "Fix");
    await user.click(save);
    expect(await within(dialog).findByText("Only a line with goods received is corrected here.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
