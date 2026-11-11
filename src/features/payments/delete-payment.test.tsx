import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderPayment } from "@/features/order-detail/data/queries";
import { PaymentsTable } from "@/features/order-detail/payments/payments-table";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { PaymentsResponse } from "@/lib/api/types";

import { toPaymentsData } from "./data/queries";
import { PaymentsScreen } from "./payments-screen";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/payments" }));
vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);

const deposit = { id: "6f1c2b9e-0000-4000-8000-000000000001", kind: "Deposit", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 5_000, status: "paid", paidOn: "2026-10-01", dueDate: null, rateInr: 12, mode: "Bank transfer", reference: "", notes: "", amountInr: 60_000 } as const;
const due = { id: "6f1c2b9e-0000-4000-8000-000000000002", kind: "Balance", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 15_000, status: "due", paidOn: null, dueDate: "2026-11-12", rateInr: null, mode: null, reference: "", notes: "", amountInr: null } as const;
const freight = { id: "6f1c2b9e-0000-4000-8000-000000000003", kind: "Balance", payee: "Sino Freight", payeeRole: "agent", amountCny: 500, status: "paid", paidOn: "2026-10-05", dueDate: null, rateInr: 12.5, mode: "Cash", reference: "", notes: "", amountInr: 6_250 } as const;
const noDeposit = { depositRequiredCny: null, depositPaidCny: 0, depositPendingCny: null, depositStatus: "none" } as const;
const api: PaymentsResponse = {
  orders: [{ orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk", currency: "CNY", supplierRate: null, orderValueCny: 20_000, paidCny: 5_000, paidInr: 60_000, supplierPaidCny: 5_000, supplierPaidInr: 60_000, balanceCny: 15_000, nextDue: "2026-11-12", ...noDeposit }],
  payments: [
    { ...due, orderId: "o2", po: "PO-3002", currency: "CNY" },
    { ...deposit, orderId: "o2", po: "PO-3002", currency: "CNY" },
  ],
};
const renderPage = (canDelete: boolean) => render(<PaymentsScreen data={{ ...toPaymentsData(api, "2026-11-10"), agents: null, linkPo: false, canDelete }} />);
// The balance counts supplier payments only (phase 2 fixes, 1): the agent's ¥500 leaves it at ¥15,000.
const facts = { po: "PO-3002", supplier: "Hangzhou Silk", currency: "CNY" as const, supplierPaidCny: 5_000, balanceCny: 15_000 };
const rows: OrderPayment[] = [deposit, freight];
const renderTab = (canDelete: boolean) => render(<PaymentsTable rows={rows} totals={{ paidCny: 5_500, paidInr: 66_250, currency: "CNY" }} remove={canDelete ? facts : null} />);

beforeEach(() => vi.clearAllMocks());

describe("Delete deposits and payments (PAY-3)", () => {
  it("with an older API that sent no supplier figures, the confirmation says so instead of guessing them", async () => {
    const user = userEvent.setup();
    render(<PaymentsTable rows={rows} totals={{ paidCny: 5_500, paidInr: 66_250, currency: "CNY" }} remove={{ ...facts, supplierPaidCny: null, balanceCny: null }} />);
    await user.click(screen.getAllByRole("button", { name: /^Delete deposit/ })[0]!);
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Deposit?" });
    expect(dialog).toHaveTextContent("The supplier's paid and balance figures for PO-3002 follow (–: not sent by this API yet).");
    expect(dialog).not.toHaveTextContent("goes from");
  });


  it("offers Delete on each payment only with payments Full, on Deposits & Payments and the order's tab", () => {
    const page = renderPage(false);
    expect(screen.queryByRole("button", { name: /^Delete (deposit|payment)/ })).toBeNull();
    page.unmount();
    const withDelete = renderPage(true);
    expect(screen.getAllByRole("button", { name: /^Delete (deposit|payment)/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete deposit of 1 Oct 2026, ¥5,000",
      "Delete payment of 12 Nov 2026, ¥15,000",
    ]);
    withDelete.unmount();

    const tabNone = renderTab(false);
    expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull();
    tabNone.unmount();
  });

  it("the order tab puts Actions last (no Status column) with a Delete per payment", () => {
    renderTab(true);
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent).at(-1)).toBe("Actions");
    expect(screen.getAllByRole("button", { name: /^Delete (deposit|payment)/ })).toHaveLength(2);
  });

  it("a paid deposit's confirmation shows the record and what it changes; Cancel and Escape send nothing", async () => {
    const user = userEvent.setup();
    renderPage(true);
    await user.click(screen.getByRole("button", { name: "Delete deposit of 1 Oct 2026, ¥5,000" }));
    let dialog = await screen.findByRole("alertdialog", { name: "Delete Deposit?" });
    expect(dialog).toHaveTextContent("Are you sure you want to delete this deposit of PO-3002? This can't be undone.");
    expect(dialog).toHaveTextContent(`TypeDepositReference${deposit.id}OrderPO-3002 · Hangzhou SilkPaid toHangzhou Silk`);
    expect(dialog).toHaveTextContent("Amount¥5,000 · ₹60,000 at");
    expect(dialog).toHaveTextContent("Paid on1 Oct 2026ModeBank transferStatusPaid");
    expect(dialog).toHaveTextContent("Paid to supplier for PO-3002 goes from ¥5,000 to ¥0, and the balance to supplier from ¥15,000 to ¥20,000.");
    expect(dialog).toHaveTextContent("The supplier's paid and outstanding figures and the order's goods cost in INR follow.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Delete deposit of 1 Oct 2026, ¥5,000" }));
    dialog = await screen.findByRole("alertdialog", { name: "Delete Deposit?" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });

  it("a due payment changes nothing paid; an agent payment moves sea freight, not the supplier's figures", async () => {
    const user = userEvent.setup();
    const page = renderPage(true);
    await user.click(screen.getByRole("button", { name: "Delete payment of 12 Nov 2026, ¥15,000" }));
    const dueDialog = await screen.findByRole("alertdialog", { name: "Delete Payment?" });
    expect(dueDialog).toHaveTextContent("TypeBalance payment");
    expect(dueDialog).toHaveTextContent("Due on12 Nov 2026StatusDue");
    expect(dueDialog).toHaveTextContent("Nothing paid changes: ¥15,000 due 12 Nov 2026 leaves the order's next due date and the due totals.");
    await user.keyboard("{Escape}");
    page.unmount();

    renderTab(true);
    await user.click(screen.getByRole("button", { name: "Delete payment of 5 Oct 2026, ¥500" }));
    const agentDialog = await screen.findByRole("alertdialog", { name: "Delete Payment?" });
    expect(agentDialog).toHaveTextContent("Paid toSino Freight (shipping agent)");
    expect(agentDialog).toHaveTextContent("Paid to supplier for PO-3002 stays at ¥5,000 and the balance to supplier at ¥15,000.");
    expect(agentDialog).toHaveTextContent("The order's sea freight cost and the INR total paid follow; the supplier's paid and outstanding figures don't change.");
  });

  it("a double-click deletes once; done, it toasts and refreshes the figures", async () => {
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderTab(true);
    await user.click(screen.getByRole("button", { name: "Delete deposit of 1 Oct 2026, ¥5,000" }));
    await user.dblClick(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete deposit" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Deposit deleted"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(`/payments/${deposit.id}`);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("an already deleted deposit ends like a delete; any other error is shown and the dialog stays open", async () => {
    remove.mockRejectedValueOnce(new ApiError(404, "not_found", "Payment not found."));
    const user = userEvent.setup();
    renderPage(true);
    await user.click(screen.getByRole("button", { name: "Delete deposit of 1 Oct 2026, ¥5,000" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete deposit" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Deposit was already deleted."));

    remove.mockRejectedValueOnce(new ApiError(403, "forbidden", "You don't have access to this."));
    await user.click(screen.getByRole("button", { name: "Delete deposit of 1 Oct 2026, ¥5,000" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Deposit?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete deposit" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(dialog).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});

describe("Payments by order: Actions (PAY-3)", () => {
  const paid3 = { id: "6f1c2b9e-0000-4000-8000-000000000009", kind: "Balance", payee: "Ningbo Knits", payeeRole: "supplier", amountCny: 2_000, status: "paid", paidOn: "2026-10-20", dueDate: null, rateInr: 12, mode: "Cash", reference: "", notes: "", amountInr: 24_000 } as const;
  const byOrder: PaymentsResponse = {
    orders: [
      { orderId: "o1", po: "PO-3001", supplier: "Hangzhou Silk", currency: "CNY", supplierRate: null, orderValueCny: 9_000, paidCny: 0, paidInr: 0, supplierPaidCny: 0, supplierPaidInr: 0, balanceCny: 9_000, nextDue: null, ...noDeposit },
      api.orders[0]!,
      { orderId: "o3", po: "PO-3003", supplier: "Ningbo Knits", currency: "CNY", supplierRate: null, orderValueCny: 4_000, paidCny: 2_000, paidInr: 24_000, supplierPaidCny: 2_000, supplierPaidInr: 24_000, balanceCny: 2_000, nextDue: null, ...noDeposit },
    ],
    payments: [{ ...paid3, orderId: "o3", po: "PO-3003", currency: "CNY" }, ...api.payments],
  };
  const renderList = (canDelete: boolean) =>
    render(<PaymentsScreen data={{ ...toPaymentsData(byOrder, "2026-11-10"), agents: null, linkPo: false, canDelete }} />);
  const table = () => screen.getAllByRole("table")[0]!;
  const trigger = (po: string) => screen.getByRole("button", { name: `Delete a payment of ${po}` });
  const pick = async (user: ReturnType<typeof userEvent.setup>, po: string, choice: string) => {
    await user.click(trigger(po));
    await user.click(await screen.findByRole("menuitem", { name: choice }));
  };

  it("puts Actions last for payments Full only, with Delete on each order that has payments", () => {
    const accounts = renderList(false);
    expect(within(table()).queryByRole("columnheader", { name: "Actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete a payment of/ })).toBeNull();
    accounts.unmount();

    renderList(true);
    expect(within(table()).getAllByRole("columnheader").map((th) => th.textContent).at(-1)).toBe("Actions");
    // PO-3001 has no payments, so nothing to delete.
    expect(screen.getAllByRole("button", { name: /^Delete a payment of/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete a payment of PO-3002",
      "Delete a payment of PO-3003",
    ]);
  });

  it("lists the order's payments, oldest first; the one picked opens its usual dialog; Cancel and Escape send nothing", async () => {
    const user = userEvent.setup();
    renderList(true);
    await user.click(trigger("PO-3002"));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Deposit · 1 Oct 2026 · ¥5,000", "Balance · due 12 Nov 2026 · ¥15,000"]);
    await user.click(screen.getByRole("menuitem", { name: "Deposit · 1 Oct 2026 · ¥5,000" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Deposit?" });
    expect(dialog).toHaveTextContent(`TypeDepositReference${deposit.id}OrderPO-3002 · Hangzhou SilkPaid toHangzhou Silk`);
    expect(dialog).toHaveTextContent("Amount¥5,000 · ₹60,000 at");
    expect(dialog).toHaveTextContent("Paid to supplier for PO-3002 goes from ¥5,000 to ¥0, and the balance to supplier from ¥15,000 to ¥20,000.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    // Focus goes back to the menu's trigger, not to the page.
    await waitFor(() => expect(trigger("PO-3002")).toHaveFocus());

    await pick(user, "PO-3002", "Balance · due 12 Nov 2026 · ¥15,000");
    expect(await screen.findByRole("alertdialog", { name: "Delete Payment?" })).toHaveTextContent("StatusDue");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger("PO-3002")).toHaveFocus());
    expect(remove).not.toHaveBeenCalled();
  });

  it("sends one DELETE for the picked payment and refreshes; the selected order doesn't change", async () => {
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderList(true);
    // PO-3002 is selected on load (the first order with payments); deleting from PO-3003's row leaves it selected.
    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
    await pick(user, "PO-3003", "Balance · 20 Oct 2026 · ¥2,000");
    await user.dblClick(within(await screen.findByRole("alertdialog", { name: "Delete Payment?" })).getByRole("button", { name: "Delete payment" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Payment deleted"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(`/payments/${paid3.id}`);
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
    // The page is usable again: a row click still selects an order.
    await user.click(screen.getByRole("button", { name: "PO-3001" }));
    expect(screen.getByRole("heading", { level: 2, name: "PO-3001 payments" })).toBeInTheDocument();
  });

  it("an API error is shown and the dialog stays open to try again", async () => {
    remove.mockRejectedValueOnce(new ApiError(403, "forbidden", "You don't have access to this."));
    const user = userEvent.setup();
    renderList(true);
    await pick(user, "PO-3002", "Deposit · 1 Oct 2026 · ¥5,000");
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Deposit?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete deposit" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete deposit" })).toBeEnabled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
