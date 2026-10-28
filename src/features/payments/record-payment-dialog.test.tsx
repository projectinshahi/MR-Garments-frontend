import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { RecordPaymentDialog } from "./record-payment-dialog";
import { MESSAGES } from "./record-payment-form";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-10" }));

const post = vi.mocked(apiClient.post);
const ORDERS = [
  { orderId: "o1", po: "PO-3001", supplier: "Ningbo Knits" },
  { orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk" },
];
const AGENTS = [{ id: "a1", name: "Sino Freight" }];

async function open(fixed = false) {
  const user = userEvent.setup();
  render(
    <RecordPaymentDialog orders={fixed ? [ORDERS[1]!] : ORDERS} fixed={fixed} agents={AGENTS}>
      <Button>Open</Button>
    </RecordPaymentDialog>,
  );
  await user.click(screen.getByRole("button", { name: "Open" }));
  const dialog = screen.getByRole("dialog");
  // Prefix match: each label is followed by the required mark.
  const field = (label: string) => within(dialog).getByLabelText((text) => text.startsWith(label));
  const submit = within(dialog).getByRole("button", { name: "Record payment" });
  return { user, dialog, field, submit };
}

async function fill({ user, field }: Awaited<ReturnType<typeof open>>, fixed = false) {
  if (!fixed) await user.selectOptions(field("Order"), "o2");
  await user.selectOptions(field("Kind"), "Balance");
  await user.type(field("Amount (¥)"), "2,345.67");
  fireEvent.change(field("Paid on"), { target: { value: "2026-11-09" } });
  await user.type(field("Rate (₹ per ¥)"), "11.8765");
  await user.type(field("Mode"), "Bank transfer");
}

const BODY = {
  orderId: "o2",
  kind: "Balance",
  payeeRole: "supplier",
  agentId: null,
  amountCny: 2345.67,
  paidOn: "2026-11-09",
  rateInr: 11.8765,
  mode: "Bank transfer",
};

beforeEach(() => vi.clearAllMocks());

describe("RecordPaymentDialog", () => {
  it("records a supplier payment, showing INR as you type, then toasts, closes and refreshes", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const form = await open();
    expect(form.field("Paid on")).toHaveValue("2026-11-10");
    await fill(form);
    expect(within(form.dialog).getByRole("option", { name: "Hangzhou Silk (supplier)" })).toBeInTheDocument();
    expect(within(form.dialog).getByRole("status")).toHaveTextContent("₹27,858"); // whole rupees, as on New order

    await form.user.click(form.submit);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/payments", BODY);
    expect(toast.success).toHaveBeenCalledWith("Payment recorded for PO-3002");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pays a shipping agent", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const form = await open();
    await fill(form);
    await form.user.selectOptions(form.field("Paid to"), "a1");
    await form.user.click(form.submit);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/payments", { ...BODY, payeeRole: "agent", agentId: "a1" }));
  });

  it("from an order's card, records against that order only", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const form = await open(true);
    expect(within(form.dialog).getByRole("heading", { name: "Record payment for PO-3002" })).toBeInTheDocument();
    expect(form.field("Order")).toHaveValue("PO-3002 · Hangzhou Silk");
    expect(form.field("Order")).toHaveAttribute("readonly");
    await fill(form, true);
    await form.user.click(form.submit);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Payment recorded for PO-3002"));
    expect(post).toHaveBeenCalledWith("/payments", BODY);
  });

  it("checks the form before posting", async () => {
    const form = await open();
    fireEvent.change(form.field("Paid on"), { target: { value: "2026-11-11" } });
    await form.user.click(form.submit);
    for (const message of [MESSAGES.order, MESSAGES.kind, MESSAGES.amount, MESSAGES.paidOnFuture, MESSAGES.rateInr, MESSAGES.mode]) {
      expect(await within(form.dialog).findByText(message)).toBeInTheDocument();
    }
    expect(post).not.toHaveBeenCalled();
  });

  it("shows the API's field messages under their fields, toasts any other, and keeps the values", async () => {
    post.mockRejectedValue(
      new ApiError(422, "validation_failed", "Some fields need attention.", {
        agentId: "Choose a shipping agent from the list.",
        paidOn: "The payment date can't be in the future.",
        other: "Something only the API knows about.",
      }),
    );
    const form = await open();
    await fill(form);
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText("Choose a shipping agent from the list.")).toBeInTheDocument();
    expect(form.field("Paid to")).toHaveAttribute("aria-invalid", "true");
    expect(within(form.dialog).getByText("The payment date can't be in the future.")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Something only the API knows about.");
    expect(form.field("Amount (¥)")).toHaveValue("2,345.67");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("disables the button while saving, and opens empty again", async () => {
    let finish: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const form = await open();
    await fill(form);
    await form.user.click(form.submit);
    await waitFor(() => expect(form.submit).toBeDisabled());
    finish({ payment: { id: "p1" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await form.user.click(screen.getByRole("button", { name: "Open" }));
    expect(within(screen.getByRole("dialog")).getByLabelText((text) => text.startsWith("Amount (¥)"))).toHaveValue("");
  });
});
