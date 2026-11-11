import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { SupplierDepositRow } from "@/lib/api/deposits-types";
import { ApiError } from "@/lib/api/errors";

import { NewDepositDialog, SettleDepositDialog } from "./deposit-dialogs";
import { MESSAGES } from "./deposit-forms";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-10" }));

const post = vi.mocked(apiClient.post);
const SUPPLIER = { id: "s1", name: "Foshan Fabrics", currency: "USD" as const };
const DEPOSIT: SupplierDepositRow = {
  id: "d1",
  supplierId: "s1",
  supplier: "Foshan Fabrics",
  direction: "give",
  currency: "CNY",
  exchangeRate: null,
  amount: 1000,
  settled: 300,
  pending: 700,
  status: "partly settled",
  openedOn: "2026-10-01",
  reference: "",
  notes: "",
  transactions: 1,
};

async function openDialog(ui: React.ReactElement, submitLabel: string) {
  const user = userEvent.setup();
  render(ui);
  await user.click(screen.getByRole("button", { name: "Open" }));
  const dialog = screen.getByRole("dialog");
  const field = (label: string) => within(dialog).getByLabelText((text) => text.startsWith(label));
  return { user, dialog, field, submit: within(dialog).getByRole("button", { name: submitLabel }) };
}
const newDeposit = () =>
  openDialog(
    <NewDepositDialog supplier={SUPPLIER}>
      <Button>Open</Button>
    </NewDepositDialog>,
    "Open deposit",
  );
const settle = (deposit = DEPOSIT) =>
  openDialog(
    <SettleDepositDialog deposit={deposit}>
      <Button>Open</Button>
    </SettleDepositDialog>,
    deposit.direction === "give" ? "Record payment" : "Record receipt",
  );

beforeEach(() => vi.clearAllMocks());

describe("NewDepositDialog (SD-2)", () => {
  it("is in the supplier's currency (shown, not chosen) and defaults to today; posts the deposit, toasts, closes and refreshes", async () => {
    post.mockResolvedValue({ deposit: DEPOSIT });
    const form = await newDeposit();
    expect(within(form.dialog).getByRole("heading", { name: "New deposit for Foshan Fabrics" })).toBeInTheDocument();
    expect(form.field("Currency")).toHaveValue("USD ($)");
    expect(form.field("Currency")).toHaveAttribute("readonly");
    expect(form.field("Agreed on")).toHaveValue("2026-11-10");
    expect(form.field("Amount ($)")).toBeVisible();
    await form.user.selectOptions(form.field("Direction"), "receive");
    await form.user.type(form.field("Amount ($)"), "1,234.5");
    fireEvent.change(form.field("Agreed on"), { target: { value: "2026-11-01" } });
    await form.user.type(form.field("Reference"), " INV-7 ");
    await form.user.type(form.field("Notes"), "Returned mould");

    await form.user.click(form.submit);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/suppliers/s1/deposits", { direction: "receive", amount: 1234.5, currency: "USD", openedOn: "2026-11-01", reference: "INV-7", notes: "Returned mould" });
    expect(toast.success).toHaveBeenCalledWith("Deposit opened");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("checks the form before posting, and shows the API's field messages under their fields", async () => {
    const form = await newDeposit();
    fireEvent.change(form.field("Agreed on"), { target: { value: "2026-11-11" } });
    await form.user.click(form.submit);
    for (const message of [MESSAGES.direction, MESSAGES.amount, MESSAGES.future]) expect(await within(form.dialog).findByText(message)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { openedOn: "The date can't be in the future.", other: "Only the API knows." }));
    await form.user.selectOptions(form.field("Direction"), "give");
    await form.user.type(form.field("Amount ($)"), "500");
    fireEvent.change(form.field("Agreed on"), { target: { value: "2026-11-10" } });
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText("The date can't be in the future.")).toBeInTheDocument();
    expect(form.field("Agreed on")).toHaveAttribute("aria-invalid", "true");
    expect(toast.error).toHaveBeenCalledWith("Only the API knows.");
    expect(form.field("Amount ($)")).toHaveValue("500");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("SettleDepositDialog (SD-3)", () => {
  it("records a payment against a deposit to give: today and the pending amount prefilled, then toasts and refreshes", async () => {
    post.mockResolvedValue({ transaction: { id: "t1" }, deposit: DEPOSIT });
    const form = await settle();
    expect(within(form.dialog).getByRole("heading", { name: "Record payment" })).toBeInTheDocument();
    expect(form.dialog).toHaveTextContent("against the deposit of ¥1,000; ¥700 is pending.");
    expect(form.field("Paid on")).toHaveValue("2026-11-10");
    expect(form.field("Amount (¥)")).toHaveValue("700");
    await form.user.type(form.field("Mode"), "Bank transfer");
    await form.user.type(form.field("Reference"), "TXN 1");
    await form.user.click(form.submit);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/supplier-deposits/d1/transactions", { paidOn: "2026-11-10", amount: 700, mode: "Bank transfer", reference: "TXN 1" });
    expect(toast.success).toHaveBeenCalledWith("Payment recorded");
  });

  it("records a receipt against a deposit to receive, and puts the API's over-settlement message under Amount", async () => {
    post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { amount: "Only $380 left to settle." }));
    const form = await settle({ ...DEPOSIT, direction: "receive", currency: "USD", amount: 500, settled: 120, pending: 380 });
    expect(within(form.dialog).getByRole("heading", { name: "Record receipt" })).toBeInTheDocument();
    expect(form.field("Received on")).toHaveValue("2026-11-10");
    expect(form.field("Amount ($)")).toHaveValue("380");
    await form.user.clear(form.field("Amount ($)"));
    await form.user.type(form.field("Amount ($)"), "400");
    await form.user.type(form.field("Mode"), "Cash");
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText("Only $380 left to settle.")).toBeInTheDocument();
    expect(form.field("Amount ($)")).toHaveAttribute("aria-invalid", "true");
    expect(post).toHaveBeenCalledWith("/supplier-deposits/d1/transactions", { paidOn: "2026-11-10", amount: 400, mode: "Cash" });
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("checks the form before posting", async () => {
    const form = await settle();
    await form.user.clear(form.field("Amount (¥)"));
    await form.user.click(form.submit);
    for (const message of [MESSAGES.amount, MESSAGES.mode]) expect(await within(form.dialog).findByText(message)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
