import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentsTable, type PaymentRow } from "@/features/order-detail/payments/payments-table";
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

const deposit = { id: "6f1c2b9e-0000-4000-8000-000000000001", kind: "Deposit", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 5_000, status: "paid", paidOn: "2026-10-01", dueDate: null, rateInr: 12, mode: "Bank transfer" } as const;
const due = { id: "6f1c2b9e-0000-4000-8000-000000000002", kind: "Balance", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 15_000, status: "due", paidOn: null, dueDate: "2026-11-12", rateInr: null, mode: null } as const;
const freight = { id: "6f1c2b9e-0000-4000-8000-000000000003", kind: "Balance", payee: "Sino Freight", payeeRole: "agent", amountCny: 500, status: "paid", paidOn: "2026-10-05", dueDate: null, rateInr: 12.5, mode: "Cash" } as const;
const api: PaymentsResponse = {
  orders: [{ orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk", currency: "CNY", orderValueCny: 20_000, paidCny: 5_000, paidInr: 60_000, balanceCny: 15_000, nextDue: "2026-11-12" }],
  payments: [
    { ...due, orderId: "o2", po: "PO-3002", currency: "CNY" },
    { ...deposit, orderId: "o2", po: "PO-3002", currency: "CNY" },
  ],
};
const renderPage = (canDelete: boolean) => render(<PaymentsScreen data={{ ...toPaymentsData(api, "2026-11-10"), agents: null, linkPo: false, canDelete }} />);
const facts = { po: "PO-3002", supplier: "Hangzhou Silk", currency: "CNY" as const, paidCny: 5_500, balanceCny: 14_500 };
const rows: PaymentRow[] = [
  { ...deposit, inr: 60_000 },
  { ...freight, inr: 6_250 },
];
const renderTab = (canDelete: boolean) => render(<PaymentsTable rows={rows} totals={{ paidCny: 5_500, paidInr: 66_250, currency: "CNY" }} remove={canDelete ? facts : null} />);

beforeEach(() => vi.clearAllMocks());

describe("Delete deposits and payments (PAY-3)", () => {
  it("offers Delete on each payment only with payments Full, on Deposits & Payments and the order's tab", () => {
    const page = renderPage(false);
    expect(screen.queryByRole("button", { name: /^Delete (deposit|payment)/ })).toBeNull();
    page.unmount();
    renderPage(true);
    expect(screen.getAllByRole("button", { name: /^Delete (deposit|payment)/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete deposit of 1 Oct 2026, ¥5,000",
      "Delete payment of 12 Nov 2026, ¥15,000",
    ]);

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
    expect(dialog).toHaveTextContent("Paid so far for PO-3002 goes from ¥5,000 to ¥0, and the balance to pay from ¥15,000 to ¥20,000.");
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
    expect(agentDialog).toHaveTextContent("Paid so far for PO-3002 goes from ¥5,500 to ¥5,000, and the balance to pay from ¥14,500 to ¥15,000.");
    expect(agentDialog).toHaveTextContent("The order's sea freight cost follows; the supplier's paid and outstanding figures don't change.");
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
