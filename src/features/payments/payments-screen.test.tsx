import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PaymentsResponse } from "@/lib/api/types";

import { toPaymentsData } from "./data/queries";
import { PaymentsScreen } from "./payments-screen";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const noDeposit = { depositRequiredCny: null, depositPaidCny: 0, depositPendingCny: null, depositStatus: "none" } as const;
const api: PaymentsResponse = {
  orders: [
    { orderId: "o1", po: "PO-3001", supplier: "Ningbo Knits", currency: "CNY", orderValueCny: 10_000, paidCny: 0, paidInr: 0, supplierPaidCny: 0, supplierPaidInr: 0, balanceCny: 10_000, nextDue: null, ...noDeposit },
    { orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk", currency: "CNY", orderValueCny: 20_000, paidCny: 5_000, paidInr: 60_000, supplierPaidCny: 5_000, supplierPaidInr: 60_000, balanceCny: 15_000, nextDue: "2026-11-12", ...noDeposit },
  ],
  // PAY-1 order: newest first by coalesce(paidOn, dueDate).
  payments: [
    { id: "p2", orderId: "o2", po: "PO-3002", currency: "CNY", kind: "Balance", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 15_000, status: "due", paidOn: null, dueDate: "2026-11-12", rateInr: null, mode: null, reference: "", notes: "" },
    { id: "p1", orderId: "o2", po: "PO-3002", currency: "CNY", kind: "Deposit", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 5_000, status: "paid", paidOn: "2026-10-01", dueDate: null, rateInr: 12, mode: "Bank transfer", reference: "", notes: "" },
  ],
};
type Access = { agents: { id: string; name: string }[] | null; linkPo: boolean; canDelete: boolean };
const renderScreen = (response = api, access: Access = { agents: null, linkPo: false, canDelete: false }) =>
  render(<PaymentsScreen data={{ ...toPaymentsData(response, "2026-11-10"), ...access }} />);

describe("PaymentsScreen", () => {
  it("renders the API rows, KPIs and the first order with payments, and no reference fixtures", () => {
    renderScreen();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /PO-3001/ })).toHaveTextContent("Not yet due");
    expect(within(table).getByRole("row", { name: /PO-3002/ })).toHaveTextContent("₹60,000");
    expect(screen.getByText("Paid so far (INR)").nextSibling).toHaveTextContent("₹60,000");
    expect(screen.getByText("across 1 order · all payees")).toBeInTheDocument(); // the orders the paid total comes from
    expect(screen.getByText("1 payment · PO-3002 on 12 Nov")).toBeInTheDocument();
    expect(screen.getAllByText("¥15,000")).toHaveLength(2); // due in 7 and 30 days, in CNY

    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
    // Numbered oldest first, as in 16.
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["1. Deposit", "2. Balance"]);
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
    expect(screen.getByText("Due 12 Nov")).toBeInTheDocument();
    expect(screen.getByText("Balance to supplier").nextSibling).toHaveTextContent("¥ 15,000");

    for (const fixture of ["PO-2041", "PO-2049", "Foshan Fabrics", "₹25,15,000"]) {
      expect(screen.queryByText(new RegExp(fixture))).not.toBeInTheDocument();
    }
  });

  it("shows the clicked order's payments, or says it has none", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "PO-3001" }));
    expect(screen.getByRole("heading", { level: 2, name: "PO-3001 payments" })).toBeInTheDocument();
    expect(screen.getByText("No payments recorded for PO-3001 yet.")).toBeInTheDocument();
  });

  it("hides the selected order's card while the search hides its row, and shows it again after", async () => {
    renderScreen();
    const search = screen.getByRole("searchbox", { name: "Search PO or supplier" });
    await userEvent.type(search, "Ningbo");
    expect(screen.queryByRole("heading", { level: 2, name: "PO-3002 payments" })).not.toBeInTheDocument();
    await userEvent.clear(search);
    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
  });

  it("offers Record payment only to users who can record, and links the PO when Orders opens", async () => {
    renderScreen();
    expect(screen.queryByRole("button", { name: /Record payment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "PO-3002" })).not.toBeInTheDocument();
    cleanup();

    renderScreen(api, { agents: [], linkPo: true, canDelete: false });
    expect(screen.getByRole("button", { name: "+ Record payment" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+ Record payment for PO-3002" }));
    expect(screen.getByRole("heading", { name: "Record payment for PO-3002" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("link", { name: "PO-3002" })).toHaveAttribute("href", "/orders/PO-3002");
  });

  it("keeps the reference's ¥ headers for one currency, and gives each amount its symbol when currencies differ", () => {
    renderScreen();
    expect(screen.getByText("Order value (¥)")).toBeInTheDocument();
    cleanup();
    const usd = { orderId: "o3", po: "PO-3003", supplier: "Boston Denim", currency: "USD" as const, orderValueCny: 1_200, paidCny: 200, paidInr: 17_600, supplierPaidCny: 200, supplierPaidInr: 17_600, balanceCny: 1_000, nextDue: null, ...noDeposit };
    renderScreen({ ...api, orders: [...api.orders, usd] });
    expect(screen.getByText("Order value")).toBeInTheDocument();
    expect(screen.queryByText("Order value (¥)")).not.toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getAllByText("¥20,000").length).toBeGreaterThan(0);
    expect(screen.getByText("Amounts in each order's currency and INR")).toBeInTheDocument();
  });

  it("shows the supplier's figures with the agents' sea freight apart, and the deposit the supplier asked for", () => {
    // ¥500 sea freight to an agent (phase 2 fixes, 1): in Paid (INR) and nowhere else; the supplier asked for ¥8,000 of deposit, ¥5,000 paid.
    const freight: PaymentsResponse["payments"][number] = { id: "p3", orderId: "o2", po: "PO-3002", currency: "CNY", kind: "Balance", payee: "Sino Freight", payeeRole: "agent", amountCny: 500, status: "paid", paidOn: "2026-10-05", dueDate: null, rateInr: 12.5, mode: "Cash", reference: "", notes: "" };
    const order = { ...api.orders[1]!, paidCny: 5_500, paidInr: 66_250, depositRequiredCny: 8_000, depositPaidCny: 5_000, depositPendingCny: 3_000, depositStatus: "partly" as const };
    renderScreen({ orders: [api.orders[0]!, order], payments: [freight, ...api.payments] });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["PO / Supplier", "Order value (¥)", "Paid to supplier (¥)", "Paid (INR)all payees", "Balance to supplier (¥)", "Next due"]);
    expect(within(table).getByRole("row", { name: /PO-3002/ })).toHaveTextContent("20,0005,000₹66,25015,000");
    expect(screen.getByText("Balance is what the supplier is still owed; agent payments are sea freight and count only in the INR total.")).toBeInTheDocument();
    expect(screen.getByText("Paid so far (INR)").nextSibling).toHaveTextContent("₹66,250");

    const value = (label: string) => screen.getByText(label).nextSibling;
    expect(value("Paid to supplier")).toHaveTextContent("¥ 5,000");
    expect(value("Paid to agents (sea freight)")).toHaveTextContent("¥ 500");
    expect(value("Paid (INR), all payees")).toHaveTextContent("₹66,250");
    expect(value("Balance to supplier")).toHaveTextContent("¥ 15,000");
    expect(value("Deposit required")).toHaveTextContent("¥ 8,000");
    expect(value("Deposit paid")).toHaveTextContent("¥ 5,000");
    expect(value("Deposit pending")).toHaveTextContent("¥ 3,000");
    expect(screen.getByText("Deposit partly paid")).toBeInTheDocument();
  });

  it("says so when the API has no orders", () => {
    renderScreen({ orders: [], payments: [] });
    expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /payments$/ })).not.toBeInTheDocument();
  });
});
