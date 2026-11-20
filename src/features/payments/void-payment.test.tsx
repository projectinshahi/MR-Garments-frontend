import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { VOID_TEXT, VoidPaymentButton, type VoidablePayment } from "./void-payment";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));

const remove = vi.mocked(apiClient.delete);
const PAYMENT: VoidablePayment = {
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
  dueDate: null,
  rateInr: 12,
  amountInr: 60000,
  mode: "Wire",
  reference: "UTR 1",
};

async function openVoid(payment = PAYMENT) {
  const user = userEvent.setup();
  render(<VoidPaymentButton payment={payment} />);
  await user.click(screen.getByRole("button", { name: "Void payment of 4 Nov 2026, ¥5,000" }));
  const dialog = screen.getByRole("dialog");
  return { user, dialog, reason: within(dialog).getByLabelText(/Reason/), confirm: within(dialog).getByRole("button", { name: "Void payment" }) };
}

beforeEach(() => vi.clearAllMocks());

describe("VoidPaymentButton (PAY-3: a void with a reason, never a delete)", () => {
  it("needs a reason, then sends it and shows the API's balance before and after", async () => {
    remove.mockResolvedValue({ payment: { id: "p1", voided: true }, ledger: { supplierId: "s1", currency: "CNY", balanceBefore: 2000, balanceAfter: -3000 } });
    const { user, dialog, reason, confirm } = await openVoid();
    expect(within(dialog).getByRole("heading", { name: "Void payment?" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("The payment stays listed, marked voided, and leaves every total.");
    expect(dialog).toHaveTextContent("None (supplier account)");

    await user.click(confirm);
    expect(await within(dialog).findByText(VOID_TEXT.reason)).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();

    await user.type(reason, "  Entered twice ");
    await user.click(confirm);
    await waitFor(() => expect(remove).toHaveBeenCalledWith("/payments/p1", { reason: "Entered twice" }));
    const done = await screen.findByRole("heading", { name: "Payment voided" });
    expect(done.closest("[role=dialog]")).toHaveTextContent("Hangzhou Silk's CNY account: Available with supplier ¥2,000.00 before, Payable to supplier ¥3,000.00 after.");
    expect(toast.success).toHaveBeenCalledWith(VOID_TEXT.voided);
    // The page refreshes when the result is closed, not while it is shown (a refresh could replace it).
    expect(router.refresh).not.toHaveBeenCalled();
    await user.click(within(done.closest("[role=dialog]") as HTMLElement).getAllByRole("button", { name: "Close" })[0]!);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("says a sea freight void doesn't touch the supplier's account (no ledger change)", async () => {
    remove.mockResolvedValue({ payment: { id: "p2", voided: true }, ledger: null });
    const { user, dialog, reason, confirm } = await openVoid({ ...PAYMENT, id: "p2", payeeRole: "agent", payee: "Sino Freight", kind: "Balance", po: "PO-3001" });
    expect(dialog).toHaveTextContent("It is a sea freight payment, so the supplier's account doesn't change.");
    await user.type(reason, "Wrong agent");
    await user.click(confirm);
    expect(await screen.findByText(/The supplier's account doesn't change\./)).toBeInTheDocument();
  });

  it("an already voided or unknown payment: toasts the API's message, closes and refreshes", async () => {
    remove.mockRejectedValue(new ApiError(409, "already_voided", "This payment is already voided."));
    const { user, reason, confirm } = await openVoid();
    await user.type(reason, "Twice");
    await user.click(confirm);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This payment is already voided."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("puts a 422 reason under the field and toasts a held account or maintenance, keeping the dialog", async () => {
    const { user, dialog, reason, confirm } = await openVoid();
    await user.type(reason, "x");
    remove.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { reason: "Enter the reason." }));
    await user.click(confirm);
    expect(await within(dialog).findByText("Enter the reason.")).toBeInTheDocument();

    remove.mockRejectedValueOnce(new ApiError(409, "account_held", "This supplier's account is pending review."));
    await user.click(confirm);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This supplier's account is pending review."));

    remove.mockRejectedValueOnce(new ApiError(503, "ledger_maintenance", "Paused."));
    await user.click(confirm);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Payments are paused for maintenance", { description: "Paused." }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
