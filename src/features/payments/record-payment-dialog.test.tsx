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
  { orderId: "o1", po: "PO-3001", supplier: "Ningbo Knits", currency: "CNY" as const, supplierRate: null },
  { orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk", currency: "CNY" as const, supplierRate: null },
  { orderId: "o3", po: "PO-3003", supplier: "Boston Denim", currency: "USD" as const, supplierRate: 88 },
  { orderId: "o4", po: "PO-3004", supplier: "Kochi Mills", currency: "INR" as const, supplierRate: 1 },
];
const AGENTS = [{ id: "a1", name: "Sino Freight" }];
// ORD-2's active suppliers, given on Deposits & Payments: the order is then optional.
const SUPPLIERS = [
  { id: "s1", name: "Ningbo Knits", currency: "CNY", exchangeRate: null },
  { id: "s2", name: "Boston Denim", currency: "USD", exchangeRate: 88 },
  { id: "s3", name: "Kochi Mills", currency: "INR", exchangeRate: 1 },
];

async function open(fixed = false, suppliers?: typeof SUPPLIERS) {
  const user = userEvent.setup();
  render(
    <RecordPaymentDialog orders={fixed ? [ORDERS[1]!] : ORDERS} fixed={fixed} agents={AGENTS} suppliers={suppliers}>
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

  it("says when the payment gave supplier advance back to the supplier's account (PAY-2 advance)", async () => {
    post.mockResolvedValue({ payment: { id: "p1" }, advance: { appliedCny: 1500, changeCny: -500, availableCny: 8500, balanceCny: 0, status: "full" } });
    const form = await open();
    await fill(form);
    await form.user.click(form.submit);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Payment recorded for PO-3002. ¥500.00 of supplier advance went back to the supplier's account");
  });

  it("sends the reference and notes when typed (trimmed), and leaves them out when empty", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const form = await open();
    await fill(form);
    await form.user.type(form.field("Reference"), " UTR 123 ");
    await form.user.type(form.field("Notes"), "Second half");
    await form.user.click(form.submit);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/payments", { ...BODY, reference: "UTR 123", notes: "Second half" }));
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

  it("fills the rate from the chosen order's supplier rate now, unless a rate was typed", async () => {
    const ui = await open();
    await ui.user.selectOptions(ui.field("Order"), "o3");
    expect(ui.field("Rate (₹ per $)")).toHaveValue("88");
    expect(within(ui.dialog).getByText("Supplier rate now: 1 USD = ₹88.00. Change it if this payment used another.")).toBeVisible();
    await ui.user.selectOptions(ui.field("Order"), "o1");
    expect(ui.field("Rate (₹ per ¥)")).toHaveValue("");
    expect(within(ui.dialog).getByText("No rate set on the supplier: enter this payment's.")).toBeVisible();
    await ui.user.type(ui.field("Rate (₹ per ¥)"), "11.9");
    await ui.user.selectOptions(ui.field("Order"), "o3");
    expect(ui.field("Rate (₹ per $)")).toHaveValue("11.9");
  });

  it("follows the chosen order's currency: $ labels for a USD order, no rate for an INR order", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const ui = await open();
    await ui.user.selectOptions(ui.field("Order"), "o3");
    expect(ui.field("Amount ($)")).toBeVisible();
    expect(ui.field("Rate (₹ per $)")).toBeVisible();

    await ui.user.selectOptions(ui.field("Order"), "o4");
    expect(within(ui.dialog).queryByLabelText((text) => text.startsWith("Rate"))).not.toBeInTheDocument();
    await ui.user.selectOptions(ui.field("Kind"), "Deposit");
    await ui.user.type(ui.field("Amount (₹)"), "50,000");
    await ui.user.type(ui.field("Mode"), "NEFT");
    expect(within(ui.dialog).getByText("₹50,000")).toBeVisible();
    await ui.user.click(ui.submit);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post.mock.calls[0]![1]).toEqual({ orderId: "o4", kind: "Deposit", payeeRole: "supplier", agentId: null, amountCny: 50000, paidOn: "2026-11-10", mode: "NEFT" });
  });
});

describe("RecordPaymentDialog on Deposits & Payments: the payment type comes first", () => {
  const optional = (label: string, dialog: HTMLElement) => within(dialog).queryByLabelText((text) => text.startsWith(label));
  const pick = (form: Awaited<ReturnType<typeof open>>, type: "order" | "advance") => form.user.selectOptions(form.field("Payment type"), type);

  it("opens with no payment type chosen: both types offered, no other field yet", async () => {
    const form = await open(false, SUPPLIERS);
    expect(form.field("Payment type")).toHaveValue("");
    expect(within(form.field("Payment type")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Select payment type", "Order payment", "Supplier advance (no order)"]);
    for (const label of ["Order", "Supplier", "Kind", "Paid to", "Amount", "Paid on", "Rate", "Mode", "Reference", "Notes"]) {
      expect(optional(label, form.dialog), label).not.toBeInTheDocument();
    }
    expect(within(form.dialog).queryByRole("status")).not.toBeInTheDocument();
  });

  it("saves nothing until a payment type is chosen, then checks that type's fields", async () => {
    const form = await open(false, SUPPLIERS);
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText(MESSAGES.target)).toBeInTheDocument();
    expect(form.field("Payment type")).toHaveAttribute("aria-invalid", "true");
    expect(post).not.toHaveBeenCalled();

    await pick(form, "order");
    await form.user.click(form.submit);
    for (const message of [MESSAGES.order, MESSAGES.kind, MESSAGES.amount, MESSAGES.rateInr, MESSAGES.mode]) {
      expect(await within(form.dialog).findByText(message)).toBeInTheDocument();
    }
    expect(within(form.dialog).queryByText(MESSAGES.target)).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("Order payment: the order, kind and payee as before, and the same PAY-2 body", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const form = await open(false, SUPPLIERS);
    await pick(form, "order");
    expect(optional("Supplier", form.dialog)).not.toBeInTheDocument();
    expect(form.field("Order")).toHaveValue("");
    await fill(form);
    await form.user.click(form.submit);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith("/payments", BODY);
    expect(toast.success).toHaveBeenCalledWith("Payment recorded for PO-3002");
  });

  it("Supplier advance: one ADV-2 receipt for the chosen supplier (its currency and rate now), never a payment", async () => {
    post.mockResolvedValue({ advance: { id: "adv-1" } });
    const form = await open(false, SUPPLIERS);
    await pick(form, "advance");
    expect(within(form.dialog).getByText(/Recorded as a deposit on the supplier's advance, not against an order/)).toBeVisible();
    for (const label of ["Order", "Kind", "Paid to"]) expect(optional(label, form.dialog), label).not.toBeInTheDocument();

    await form.user.selectOptions(form.field("Supplier"), "s2");
    expect(form.field("Rate (₹ per $)")).toHaveValue("88");
    expect(within(form.dialog).getByText("Supplier rate now: 1 USD = ₹88.00. Change it if this payment used another.")).toBeVisible();
    await form.user.type(form.field("Amount ($)"), "1,200.50");
    fireEvent.change(form.field("Paid on"), { target: { value: "2026-11-09" } });
    await form.user.type(form.field("Mode"), "Wire");
    await form.user.type(form.field("Reference"), "UTR-9");
    expect(within(form.dialog).getByRole("status")).toHaveTextContent("₹1,05,644"); // 1,200.50 x 88, whole rupees
    await form.user.click(form.submit);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith("/suppliers/s2/advances", { amount: 1200.5, paidOn: "2026-11-09", rateInr: 88, mode: "Wire", reference: "UTR-9" });
    expect(toast.success).toHaveBeenCalledWith("Deposit recorded as supplier advance for Boston Denim. New orders for this supplier use it automatically");
  });

  it("Supplier advance needs the supplier, and a rate when the supplier has none; an INR supplier takes no rate", async () => {
    post.mockResolvedValue({ advance: { id: "adv-1" } });
    const form = await open(false, SUPPLIERS);
    await pick(form, "advance");
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText(MESSAGES.supplier)).toBeInTheDocument();
    expect(within(form.dialog).queryByText(MESSAGES.order)).not.toBeInTheDocument();
    expect(within(form.dialog).queryByText(MESSAGES.kind)).not.toBeInTheDocument();

    await form.user.selectOptions(form.field("Supplier"), "s1");
    expect(form.field("Rate (₹ per ¥)")).toHaveValue("");
    expect(within(form.dialog).getByText("No rate set on the supplier: enter this payment's.")).toBeVisible();
    await form.user.type(form.field("Amount (¥)"), "5,000");
    await form.user.type(form.field("Mode"), "Cash");
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText(MESSAGES.rateInr)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await form.user.selectOptions(form.field("Supplier"), "s3");
    expect(optional("Rate", form.dialog)).not.toBeInTheDocument();
    expect(form.field("Amount (₹)")).toHaveValue("5,000");
    await form.user.click(form.submit);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/suppliers/s3/advances", { amount: 5000, paidOn: "2026-11-10", mode: "Cash" }));
    expect(post).toHaveBeenCalledOnce();
  });

  it("a newly chosen supplier, order or type brings its rate, never over a typed one", async () => {
    const form = await open(false, SUPPLIERS);
    await pick(form, "advance");
    await form.user.selectOptions(form.field("Supplier"), "s2");
    expect(form.field("Rate (₹ per $)")).toHaveValue("88");
    await form.user.selectOptions(form.field("Supplier"), "s1");
    expect(form.field("Rate (₹ per ¥)")).toHaveValue("");
    await form.user.selectOptions(form.field("Supplier"), "s2");
    // Order payment: no order chosen yet, so no rate; the USD order brings 88 again.
    await pick(form, "order");
    expect(form.field("Rate (₹ per ¥)")).toHaveValue("");
    await form.user.selectOptions(form.field("Order"), "o3");
    expect(form.field("Rate (₹ per $)")).toHaveValue("88");
    await form.user.clear(form.field("Rate (₹ per $)"));
    await form.user.type(form.field("Rate (₹ per $)"), "11.9");
    await pick(form, "advance");
    expect(form.field("Rate (₹ per $)")).toHaveValue("11.9");
  });

  it("shows ADV-2's field messages under the form's fields", async () => {
    post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { amount: "Enter an amount above 0, with at most 2 decimals." }));
    const form = await open(false, SUPPLIERS);
    await pick(form, "advance");
    await form.user.selectOptions(form.field("Supplier"), "s2");
    await form.user.type(form.field("Amount ($)"), "10.555");
    await form.user.type(form.field("Mode"), "Wire");
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText("Enter an amount above 0, with at most 2 decimals.")).toBeInTheDocument();
    expect(form.field("Amount ($)")).toHaveAttribute("aria-invalid", "true");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("opens again with no type, supplier or amount after Cancel, and after a save", async () => {
    post.mockResolvedValue({ advance: { id: "adv-1" } });
    const form = await open(false, SUPPLIERS);
    await pick(form, "advance");
    await form.user.selectOptions(form.field("Supplier"), "s3");
    await form.user.type(form.field("Amount (₹)"), "700");
    await form.user.click(within(form.dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await form.user.click(screen.getByRole("button", { name: "Open" }));
    let dialog = screen.getByRole("dialog");
    const field = (label: string) => within(dialog).getByLabelText((text) => text.startsWith(label));
    expect(field("Payment type")).toHaveValue("");
    expect(optional("Amount", dialog)).not.toBeInTheDocument();
    await form.user.selectOptions(field("Payment type"), "advance");
    expect(field("Supplier")).toHaveValue("");
    expect(field("Amount (¥)")).toHaveValue("");

    // A saved advance closes the dialog; it opens with nothing chosen again.
    await form.user.selectOptions(field("Supplier"), "s3");
    await form.user.type(field("Amount (₹)"), "700");
    await form.user.type(field("Mode"), "Cash");
    await form.user.click(within(dialog).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await form.user.click(screen.getByRole("button", { name: "Open" }));
    dialog = screen.getByRole("dialog");
    expect(field("Payment type")).toHaveValue("");
    expect(optional("Supplier", dialog)).not.toBeInTheDocument();
  });

  it("an order's card never asks the type: it records against that order only", async () => {
    const form = await open(true, SUPPLIERS);
    expect(optional("Payment type", form.dialog)).not.toBeInTheDocument();
    expect(form.field("Order")).toHaveAttribute("readonly");
    expect(optional("Supplier", form.dialog)).not.toBeInTheDocument();
    expect(form.field("Kind")).toBeInTheDocument();
  });

  it("without suppliers (none active, or an older API) it stays the order payment form", async () => {
    const form = await open(false, []);
    expect(optional("Payment type", form.dialog)).not.toBeInTheDocument();
    expect(form.field("Order")).toHaveValue("");
    expect(form.field("Kind")).toBeInTheDocument();
  });
});
