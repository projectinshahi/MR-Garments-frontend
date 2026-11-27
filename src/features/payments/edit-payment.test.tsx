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

  it("on a held account (current or legacy row), a click opens the review reason and what to do, never the form or the API", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EditPaymentButton payment={{ ...PAYMENT, held: true }} />);
    const held = screen.getByRole("button", { name: `Edit unavailable: ${HELD_MESSAGE}` });
    expect(held).toBeEnabled(); // a disabled button answered no click (the production report of 2026-11-27)
    await user.click(held);
    const dialog = await screen.findByRole("dialog", { name: EDIT_TEXT.blockedTitle });
    expect(dialog).toHaveTextContent(EDIT_TEXT.heldNext);
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    // Close (the footer button and the corner X share the name; either closes it).
    await user.click(within(dialog).getAllByRole("button", { name: "Close" })[0]!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    rerender(<EditPaymentButton payment={{ ...LEGACY, held: true, settlement: null }} />);
    await user.click(screen.getByRole("button", { name: `Edit unavailable: ${HELD_MESSAGE}` }));
    expect(await screen.findByRole("dialog", { name: EDIT_TEXT.blockedTitle })).toHaveTextContent(EDIT_TEXT.heldNext);
    expect(patch).not.toHaveBeenCalled();
  });

  it("is absent on a voided or due payment", () => {
    const { rerender } = render(<EditPaymentButton payment={{ ...PAYMENT, voided: true }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<EditPaymentButton payment={{ ...PAYMENT, payeeRole: "agent", kind: "Balance", po: "PO-3001", status: "due" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // A due legacy row too (the API answers 409 not_editable).
    rerender(<EditPaymentButton payment={{ ...LEGACY, status: "due", settlement: null }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("a partly used legacy row with no saved rate (foreign currency) explains instead of opening a form it can't save", async () => {
    const user = userEvent.setup();
    render(<EditPaymentButton payment={{ ...LEGACY, rateInr: null, settlement: { ...PARTLY, usedBy: [...PARTLY.usedBy] } }} />);
    await user.click(screen.getByRole("button", { name: `Edit unavailable: ${EDIT_TEXT.noRate}` }));
    const dialog = await screen.findByRole("dialog", { name: EDIT_TEXT.blockedTitle });
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });
});

// Legacy supplier rows (Deposit or Balance recorded against a PO): every change is a correction with a reason, and the
// API's settlement decides what may change (owner decision, option A).
const UNUSED = { state: "unsettled", amountCny: 5000, usedCny: 0, freeCny: 5000, usedBy: [] } as const;
const PARTLY = { state: "partly", amountCny: 5000, usedCny: 3000, freeCny: 2000, usedBy: [{ po: "PO-11218", amountCny: 3000 }] } as const;
const SETTLED = { state: "settled", amountCny: 5000, usedCny: 5000, freeCny: 0, usedBy: [{ po: "PO-11218", amountCny: 3000 }, { po: null, amountCny: 2000 }] } as const;
const LEGACY: EditablePayment = { ...PAYMENT, kind: "Deposit", po: "PO-3001", settlement: { ...UNUSED, usedBy: [] } };

describe("EditPaymentButton (PAY-4), legacy Deposit/Balance", () => {
  it("unused: every field editable, the order and state shown, a reason required even for a text-only change", async () => {
    patch.mockResolvedValue({ payment: { id: "p2" }, replaced: "p1", ledger: { supplierId: "s1", currency: "CNY", balanceBefore: -1000, balanceAfter: -1000 } });
    const { user, dialog, field, save } = await openEdit(LEGACY);
    expect(dialog).toHaveTextContent("Deposit (legacy) paid to Hangzhou Silk's CNY account.");
    expect(dialog).toHaveTextContent("OrderPO-3001");
    expect(dialog).toHaveTextContent("SettlementUnused");
    for (const label of ["Amount", "Paid on", "Rate", "Mode", "Reference", "Notes"]) expect(field(label)).not.toHaveAttribute("readonly");
    // The reason is asked from the start; typing only the reason changes nothing, so Save stays off.
    await user.type(field("Reason for the correction"), "Bank statement");
    expect(save).toBeDisabled();
    await user.clear(field("Reason for the correction"));
    await user.type(field("Reference"), " (bank)");
    await user.click(save);
    expect(await within(dialog).findByText(MESSAGES.reasonLegacy)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    await user.type(field("Reason for the correction"), "Bank statement");
    await user.click(save);
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/payments/p1", {
        amount: 5000,
        paidOn: "2026-11-04",
        rateInr: 12,
        mode: "Wire",
        reference: "UTR 1 (bank)",
        notes: "",
        reason: "Bank statement",
        clientRequestId: KEY,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Payment corrected. Balance: Payable to supplier ¥1,000.00 → Payable to supplier ¥1,000.00");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("partly used: date and rate locked with a visible note, the amount at least what it paid, checked before the API", async () => {
    patch.mockResolvedValue({ payment: { id: "p2" }, replaced: "p1", ledger: null });
    const { user, dialog, field, save } = await openEdit({ ...LEGACY, settlement: { ...PARTLY, usedBy: [...PARTLY.usedBy] } });
    expect(dialog).toHaveTextContent("Partly used · ¥3,000.00 of ¥5,000.00, paid PO-11218");
    expect(field("Paid on")).toHaveAttribute("readonly");
    expect(field("Rate")).toHaveAttribute("readonly");
    expect(field("Amount")).not.toHaveAttribute("readonly");
    expect(field("Paid on")).toHaveAccessibleDescription("Locked: ¥3,000.00 of this payment already paid PO-11218.");
    expect(within(dialog).getAllByText("Locked: ¥3,000.00 of this payment already paid PO-11218.")).toHaveLength(2);
    expect(within(dialog).getByText("At least ¥3,000.00.")).toBeInTheDocument();
    await user.clear(field("Amount"));
    await user.type(field("Amount"), "2,999.99");
    await user.type(field("Reason for the correction"), "Short paid");
    await user.click(save);
    expect(await within(dialog).findByText("At least ¥3,000.00: that much of it already paid orders.")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    await user.clear(field("Amount"));
    await user.type(field("Amount"), "3000");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(patch.mock.calls[0]![1]).toMatchObject({ amount: 3000, paidOn: "2026-11-04", rateInr: 12, reason: "Short paid", clientRequestId: KEY });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Payment corrected"));
  });

  it("fully used: Edit opens what it paid and why it can't change, never the form or the API", async () => {
    const user = userEvent.setup();
    render(<EditPaymentButton payment={{ ...LEGACY, settlement: { ...SETTLED, usedBy: [...SETTLED.usedBy] } }} />);
    const reason = "Fully used: ¥5,000.00 paid PO-11218, a ledger adjustment, so it can't be edited.";
    await user.click(screen.getByRole("button", { name: `Edit unavailable: ${reason}` }));
    const dialog = await screen.findByRole("dialog", { name: EDIT_TEXT.blockedTitle });
    expect(dialog).toHaveTextContent(reason);
    const list = within(dialog).getByRole("list", { name: "What this payment paid" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["PO-11218¥3,000.00", "Ledger adjustment¥2,000.00"]);
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("without its settlement (unexpected), Edit explains and shows no form", async () => {
    const user = userEvent.setup();
    render(<EditPaymentButton payment={{ ...LEGACY, settlement: undefined }} />);
    await user.click(screen.getByRole("button", { name: `Edit unavailable: ${EDIT_TEXT.noSettlement}` }));
    const dialog = await screen.findByRole("dialog", { name: EDIT_TEXT.blockedTitle });
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("409 settled_payment: says so in the dialog, refreshes the row, and Save stays off", async () => {
    patch.mockRejectedValueOnce(new ApiError(409, "settled_payment", "This payment is fully used by PO-11218 now, so it can't be edited."));
    const { user, dialog, field, save } = await openEdit(LEGACY);
    await user.type(field("Notes"), "x");
    await user.type(field("Reason for the correction"), "Typo");
    await user.click(save);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This payment is fully used by PO-11218 now, so it can't be edited.");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(save).toBeDisabled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("409 settlement_change: the message stays in the open dialog and the form can be changed and saved again with the same key", async () => {
    patch
      .mockRejectedValueOnce(new ApiError(409, "settlement_change", "This change would change what paid PO-11218 and PO-11219."))
      .mockResolvedValueOnce({ payment: { id: "p2" }, replaced: "p1", ledger: null });
    const { user, dialog, field, save } = await openEdit(LEGACY);
    await user.clear(field("Amount"));
    await user.type(field("Amount"), "4000");
    await user.type(field("Reason for the correction"), "Refund");
    await user.click(save);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This change would change what paid PO-11218 and PO-11219.");
    expect(router.refresh).not.toHaveBeenCalled();
    await user.clear(field("Amount"));
    await user.type(field("Amount"), "5000");
    await user.type(field("Notes"), "Same amount");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1]![1]).toMatchObject({ amount: 5000, clientRequestId: KEY });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
  });

  it("422 puts reason and amount errors under their fields", async () => {
    patch.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { reason: "Say why.", amount: "At least ¥3,000.00." }));
    const { user, dialog, field, save } = await openEdit(LEGACY);
    await user.type(field("Notes"), "x");
    await user.type(field("Reason for the correction"), "Typo");
    await user.click(save);
    expect(await within(dialog).findByText("Say why.")).toBeInTheDocument();
    expect(within(dialog).getByText("At least ¥3,000.00.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit payment" })).toBeInTheDocument();
  });
});
