import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { RecordPaymentDialog, RecordSeaFreightDialog, type SupplierChoice } from "./record-payment-dialog";
import { MESSAGES } from "./record-payment-form";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-10" }));

const post = vi.mocked(apiClient.post);
// ADV-5: each supplier with its currencies (D10), signed balances and whether its own account is held.
const SUPPLIERS: SupplierChoice[] = [
  { id: "s1", name: "Ningbo Knits", currency: "CNY", exchangeRate: 12.1, held: false, currencyOptions: ["CNY"], balances: [{ currency: "CNY", balanceCny: -1000 }] },
  { id: "s2", name: "Boston Denim", currency: "USD", exchangeRate: 88, held: false, currencyOptions: ["CNY", "USD"], balances: [{ currency: "CNY", balanceCny: 300 }] },
  { id: "s3", name: "Kochi Mills", currency: "INR", exchangeRate: 1, held: false, currencyOptions: ["INR"], balances: [] },
  { id: "s4", name: "Shantou Toys", currency: "CNY", exchangeRate: 12, held: true, currencyOptions: [], balances: [] },
];
let ids = 0;

async function open(supplierId?: string) {
  const user = userEvent.setup();
  render(
    <RecordPaymentDialog suppliers={SUPPLIERS} supplierId={supplierId}>
      <Button>Open</Button>
    </RecordPaymentDialog>,
  );
  await user.click(screen.getByRole("button", { name: "Open" }));
  const dialog = screen.getByRole("dialog");
  const field = (label: string) => within(dialog).getByLabelText((text) => text.startsWith(label));
  const submit = within(dialog).getByRole("button", { name: "Record payment" });
  return { user, dialog, field, submit };
}

async function fill(form: Awaited<ReturnType<typeof open>>, supplier = "Ningbo Knits") {
  await form.user.type(form.field("Supplier"), supplier);
  await form.user.type(form.field("Amount"), "2,345.67");
  fireEvent.change(form.field("Paid on"), { target: { value: "2026-11-09" } });
  await form.user.type(form.field("Mode"), "Bank transfer");
}

beforeEach(() => {
  vi.clearAllMocks();
  ids = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-00000000000${++ids}` as `${string}-${string}-${string}-${string}-${string}`);
});
afterEach(() => vi.restoreAllMocks());

describe("RecordPaymentDialog (one supplier payment, no order)", () => {
  it("has no payment type, kind or order: supplier, currency, amount, rate, date, mode, reference and notes", async () => {
    const form = await open();
    for (const label of ["Supplier", "Currency", "Amount", "Paid on", "Mode", "Reference", "Notes"]) expect(form.field(label)).toBeInTheDocument();
    expect(within(form.dialog).queryByLabelText(/Payment type|Kind|Order/)).not.toBeInTheDocument();
    expect(form.field("Paid on")).toHaveValue("2026-11-10");
    expect(form.field("Paid on")).toHaveAttribute("max", "2026-11-10");
  });

  it("records against the supplier's account with its saved rate, shows INR and balance now → after, then toasts the API's before/after", async () => {
    post.mockResolvedValue({ payment: { id: "p1" }, ledger: { supplierId: "s1", currency: "CNY", balanceBefore: -1000, balanceAfter: 1345.67 } });
    const form = await open();
    await fill(form);
    expect(form.field("Rate (₹ per ¥)")).toHaveValue("12.1");
    expect(within(form.dialog).getByText(/Supplier rate now: 1 CNY = ₹12.10/)).toBeInTheDocument();
    expect(within(form.dialog).getByText("Amount in INR").nextSibling).toHaveTextContent("₹28,383");
    expect(within(form.dialog).getByLabelText("Balance now and after")).toHaveTextContent("Payable to supplier ¥1,000.00 → Available with supplier ¥1,345.67");

    await form.user.click(form.submit);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/payments", {
      supplierId: "s1",
      currency: "CNY",
      amount: 2345.67,
      paidOn: "2026-11-09",
      rateInr: 12.1,
      mode: "Bank transfer",
      clientRequestId: "00000000-0000-4000-8000-000000000001",
    });
    expect(toast.success).toHaveBeenCalledWith("Payment recorded for Ningbo Knits. Balance: Payable to supplier ¥1,000.00 → Available with supplier ¥1,345.67");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers the supplier's currency options only; another currency has no saved rate and needs one typed", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const form = await open();
    await fill(form, "Boston Denim");
    expect(within(form.field("Currency")).getAllByRole("option").map((o) => o.textContent)).toEqual(["CNY", "USD"]);
    expect(form.field("Currency")).toHaveValue("USD");
    expect(form.field("Rate (₹ per $)")).toHaveValue("88");

    await form.user.selectOptions(form.field("Currency"), "CNY");
    expect(form.field("Rate (₹ per ¥)")).toHaveValue("");
    expect(within(form.dialog).getByText("No saved rate for CNY: enter this payment's.")).toBeInTheDocument();
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText(MESSAGES.rateInr)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await form.user.type(form.field("Rate (₹ per ¥)"), "12.25");
    await form.user.click(form.submit);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/payments", expect.objectContaining({ supplierId: "s2", currency: "CNY", rateInr: 12.25 })));
  });

  it("asks no rate for INR and sends none", async () => {
    post.mockResolvedValue({ payment: { id: "p1" } });
    const form = await open();
    await fill(form, "Kochi Mills");
    expect(within(form.dialog).queryByLabelText(/Rate/)).not.toBeInTheDocument();
    await form.user.click(form.submit);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post.mock.calls[0]![1]).not.toHaveProperty("rateInr");
    expect(post.mock.calls[0]![1]).toMatchObject({ currency: "INR", amount: 2345.67 });
  });

  it("keeps one request id per open, reused when a lost answer is retried; a new open makes a new one", async () => {
    post.mockRejectedValueOnce(new ApiError(0, "network_error", "Something went wrong.")).mockResolvedValueOnce({ payment: { id: "p1" } });
    const form = await open();
    await fill(form);
    await form.user.click(form.submit);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await form.user.click(form.submit);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const [first, second] = post.mock.calls.map((call) => (call[1] as { clientRequestId: string }).clientRequestId);
    expect(first).toBe(second);

    await form.user.click(screen.getByRole("button", { name: "Open" }));
    await fill({ ...form, dialog: screen.getByRole("dialog"), field: (label) => within(screen.getByRole("dialog")).getByLabelText((t) => t.startsWith(label)) });
    post.mockResolvedValueOnce({ payment: { id: "p2" } });
    await form.user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    expect((post.mock.calls[2]![1] as { clientRequestId: string }).clientRequestId).not.toBe(first);
  });

  it("blocks a held supplier with the review message", async () => {
    const form = await open();
    await form.user.type(form.field("Supplier"), "Shantou Toys");
    expect(within(form.dialog).getByRole("alert")).toHaveTextContent("This supplier's account is pending review.");
    expect(form.submit).toBeDisabled();
  });

  it("from an order, the supplier is fixed", async () => {
    const form = await open("s2");
    expect(form.field("Supplier")).toHaveValue("Boston Denim");
    expect(form.field("Supplier")).toHaveAttribute("readonly");
    expect(form.field("Currency")).toHaveValue("USD");
  });

  it("checks the form before posting", async () => {
    const form = await open();
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText(MESSAGES.supplier)).toBeInTheDocument();
    expect(within(form.dialog).getByText(MESSAGES.amount)).toBeInTheDocument();
    expect(within(form.dialog).getByText(MESSAGES.mode)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("maps 422 fields under their inputs, toasts 409 held and 503 maintenance, and keeps the values", async () => {
    post.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { currency: MESSAGES.currency, payeeRole: "Reload the page." }));
    const form = await open();
    await fill(form);
    await form.user.click(form.submit);
    expect(await within(form.dialog).findByText(MESSAGES.currency)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Reload the page.");

    post.mockRejectedValueOnce(new ApiError(409, "account_held", "This supplier's account is pending review."));
    await form.user.click(form.submit);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This supplier's account is pending review."));

    post.mockRejectedValueOnce(new ApiError(503, "ledger_maintenance", "Payments and order money are paused for maintenance. Try again later."));
    await form.user.click(form.submit);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Payments are paused for maintenance", { description: "Payments and order money are paused for maintenance. Try again later." }),
    );
    expect(form.field("Amount")).toHaveValue("2,345.67");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("RecordSeaFreightDialog (shipping agent, on the order)", () => {
  it("records the agent body on the order, in its currency, with the saved rate", async () => {
    post.mockResolvedValue({ payment: { id: "p9" } });
    const user = userEvent.setup();
    render(
      <RecordSeaFreightDialog order={{ orderId: "o1", po: "PO-3001", currency: "CNY", exchangeRate: 12 }} agents={[{ id: "a1", name: "Sino Freight" }]}>
        <Button>Open</Button>
      </RecordSeaFreightDialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    const field = (label: string) => within(dialog).getByLabelText((text) => text.startsWith(label));
    expect(within(dialog).getByRole("heading", { name: "Record sea freight payment for PO-3001" })).toBeInTheDocument();
    await user.selectOptions(field("Shipping agent"), "a1");
    await user.selectOptions(field("Kind"), "Balance");
    await user.type(field("Amount"), "500");
    await user.type(field("Mode"), "Cash");
    expect(field("Rate (₹ per ¥)")).toHaveValue("12");
    await user.click(within(dialog).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sea freight payment recorded for PO-3001"));
    expect(post).toHaveBeenCalledWith("/payments", {
      orderId: "o1",
      payeeRole: "agent",
      agentId: "a1",
      kind: "Balance",
      amountCny: 500,
      paidOn: "2026-11-10",
      rateInr: 12,
      mode: "Cash",
      clientRequestId: "00000000-0000-4000-8000-000000000001",
    });
  });
});
