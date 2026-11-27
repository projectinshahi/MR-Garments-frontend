import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { EDIT_TEXT, EditPaymentButton, type EditablePayment } from "./edit-payment";
import { HELD_MESSAGE } from "./money";
import { MESSAGES } from "./record-payment-form";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: vi.fn() } }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-10" }));

const patch = vi.mocked(apiClient.patch);
const KEY = "00000000-0000-4000-8000-000000000001";
const PAYMENT: EditablePayment = {
  id: "p1",
  po: null,
  supplier: "Hangzhou Silk",
  currency: "CNY",
  kind: "Payment",
  payee: "Hangzhou Silk",
  payeeRole: "supplier",
  amountCny: 5000,
  status: "paid",
  paidOn: "2026-11-04",
  rateInr: 12,
  mode: "Wire",
  reference: "UTR 1",
  notes: "",
  voided: false,
};

async function openEdit(payment = PAYMENT) {
  const user = userEvent.setup();
  render(<EditPaymentButton payment={payment} />);
  await user.click(screen.getByRole("button", { name: "Edit payment of 4 Nov 2026, ¥5,000" }));
  const dialog = screen.getByRole("dialog", { name: "Edit payment" });
  const field = (label: string) => within(dialog).getByLabelText((text) => text.startsWith(label));
  return { user, dialog, field, save: within(dialog).getByRole("button", { name: "Save changes" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(KEY);
});
afterEach(() => vi.restoreAllMocks());

describe("EditPaymentButton (PAY-4)", () => {
  it("prefills the payment; a mode or reference change sends no reason and refreshes the page", async () => {
    patch.mockResolvedValue({ payment: { id: "p1" }, replaced: null, ledger: null });
    const { user, dialog, field, save } = await openEdit();
    expect(field("Amount")).toHaveValue("5000");
    expect(field("Paid on")).toHaveValue("2026-11-04");
    expect(field("Rate")).toHaveValue("12");
    expect(field("Mode")).toHaveValue("Wire");
    expect(save).toBeDisabled();
    expect(within(dialog).queryByLabelText(/Reason for the correction/)).not.toBeInTheDocument();
    await user.clear(field("Mode"));
    await user.type(field("Mode"), "Cash");
    await user.click(save);
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/payments/p1", { amount: 5000, paidOn: "2026-11-04", rateInr: 12, mode: "Cash", reference: "UTR 1", notes: "", clientRequestId: KEY }),
    );
    expect(toast.success).toHaveBeenCalledWith(EDIT_TEXT.updated);
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a new amount asks for the reason; a final landed cost needs the approval, resent with the same key; the balance is toasted", async () => {
    patch
      .mockRejectedValueOnce(new ApiError(409, "final_settlement_approval", "Changing this payment changes the payments that settle PO-2049, whose landed cost is already final."))
      .mockResolvedValueOnce({ payment: { id: "p2" }, replaced: "p1", ledger: { supplierId: "s1", currency: "CNY", balanceBefore: -1000, balanceAfter: -500 } });
    const { user, dialog, field, save } = await openEdit();
    await user.clear(field("Amount"));
    await user.type(field("Amount"), "5,500");
    await user.click(save);
    expect(await within(dialog).findByText(MESSAGES.reason)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    await user.type(field("Reason for the correction"), "Bank statement");
    await user.click(save);
    const approve = await screen.findByRole("dialog", { name: "Approve a change to a final landed cost?" });
    await user.type(within(approve).getByRole("textbox", { name: /Reason/ }), "Supplier confirmed");
    await user.click(within(approve).getByRole("button", { name: "Approve and save" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    const body = { amount: 5500, paidOn: "2026-11-04", rateInr: 12, mode: "Wire", reference: "UTR 1", notes: "", reason: "Bank statement", clientRequestId: KEY };
    expect(patch.mock.calls[0]![1]).toEqual(body);
    expect(patch.mock.calls[1]![1]).toEqual({ ...body, finalSettlementApproval: { reason: "Supplier confirmed" } });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Payment corrected. Balance: Payable to supplier ¥1,000.00 → Payable to supplier ¥500.00"));
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("puts a 422 under its field and keeps the dialog open", async () => {
    patch.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { rateInr: "Enter an INR rate above 0." }));
    const { user, dialog, field, save } = await openEdit();
    await user.type(field("Notes"), "Paid at the office");
    await user.click(save);
    expect(await within(dialog).findByText("Enter an INR rate above 0.")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("is disabled with the reason on a legacy row or a held account, and absent on a voided or due payment", () => {
    const { rerender } = render(<EditPaymentButton payment={{ ...PAYMENT, kind: "Deposit", po: "PO-3001" }} />);
    expect(screen.getByRole("button", { name: `Edit unavailable: ${EDIT_TEXT.legacy}` })).toBeDisabled();
    rerender(<EditPaymentButton payment={{ ...PAYMENT, held: true }} />);
    expect(screen.getByRole("button", { name: `Edit unavailable: ${HELD_MESSAGE}` })).toHaveAttribute("title", HELD_MESSAGE);
    rerender(<EditPaymentButton payment={{ ...PAYMENT, voided: true }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<EditPaymentButton payment={{ ...PAYMENT, payeeRole: "agent", kind: "Balance", po: "PO-3001", status: "due" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
